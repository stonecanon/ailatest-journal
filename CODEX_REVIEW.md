# ailatest-journal · 技术全貌与登录故障排查包

> 用途：交给 Codex（或任何人）review 整站实现，聚焦定位"邮箱验证码登录失败"的根因。
>
> 站点：<https://journal.ailatest.org>
> API：  <https://api.ailatest.org>
> 仓库：`stonecanon/ailatest-journal`（GitHub）→ Cloudflare Pages 自动部署 main 分支
> 本文件对应 commit：`68f1bfc`（main HEAD 之前最后一次数据变动）
> 前端资源版本号：`v=20260513-07`
> Worker 当前版本：`325ebf3b`

---

## 1. 栈与部署拓扑

```
        浏览器（PWA）
            │
            │ journal.ailatest.org   ──►  Cloudflare Pages（静态）
            │                              └─ main 分支自动构建（无构建，直接托管）
            │
            │ api.ailatest.org        ──►  Cloudflare Worker（ailatest-journal-api）
            │                              └─ worker/src/index.js
            │                              └─ D1: ailatest-journal（861dd053-…）
            │                              └─ Secrets: JWT_SECRET / GITHUB_CLIENT_SECRET /
            │                                         GOOGLE_CLIENT_SECRET / RESEND_API_KEY / CODE_PEPPER
            │
            │ www.googletagmanager.com（GTM-NBNXL7FB）
            │ fonts.googleapis.com / fonts.gstatic.com（EB Garamond + JetBrains Mono）
            │
            └─ 无其他第三方依赖（详情页数据来自本地 data/*.json）
```

- 前端：**原生 HTML/CSS/JS，无框架**，ES 模块，fetch API
- 后端：**Cloudflare Worker + D1（SQLite）**，`compatibility_date = 2024-11-01`
- 邮件：**Resend**（`noreply@ailatest.org`，DKIM+SPF 验证通过）
- 身份：**JWT（HS256，30 天有效期）**，前端存 `localStorage.ailatest.user`
- 离线：**Service Worker**（v`20260513-01`）

---

## 2. 项目文件清单

```
ailatest-journal/
├─ index.html                ← 单页入口（234 行）
├─ sw.js                     ← Service Worker（89 行）
├─ manifest.json             ← PWA 清单
├─ css/app.css               ← 1125 行，牛皮纸学术风
├─ js/
│  ├─ app.js                 ← 主逻辑 1380 行（i18n / 过滤 / 抽屉 / 收藏 / 登录）
│  └─ journal.js             ← 详情页面辅助
├─ icons/                    ← PWA 图标 + favicon
├─ data/
│  ├─ journals.json          ← 24,214 本主库（7.87 MB）
│  ├─ domestic.json          ← 国内 6 源聚合
│  ├─ cnkx_records.json      ← 科协独立 9,998 条（中间产物）
│  ├─ oa.json                ← OpenAlex 合并（5.6 MB，39,310 ISSN）
│  ├─ meta.json              ← 元数据
│  ├─ esi_categories.json    ← ESI 22 大类
│  └─ locked/school_a.enc.json  ← AES-GCM 加密的学校 A 目录（2390 条）
├─ list/                     ← 原始数据（Ei xlsx 等）
├─ scripts/                  ← 数据构建脚本（Python）
└─ worker/
   ├─ wrangler.toml
   ├─ schema.sql
   ├─ README.md
   ├─ migrations/
   └─ src/index.js           ← 452 行，全部后端逻辑
```

---

## 3. 前端资源加载（index.html 摘要）

关键版本号必须一致，防止 SW 缓存旧版：

| 资源 | URL | 当前版本 |
|---|---|---|
| CSS | `/css/app.css?v=20260513-07` | 20260513-07 |
| JS  | `/js/app.js?v=20260513-07`   | 20260513-07 |
| SW  | `/sw.js`（无 querystring）   | `VERSION = 'v20260513-01'` ← ⚠️ **未跟随前端版本号变** |

SW 注册（`index.html:204-210`）：
```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
```

---

## 4. Service Worker 策略（sw.js 完整）

```js
const VERSION = 'v20260513-01';
const SHELL_CACHE = `shell-${VERSION}`;
const DATA_CACHE  = `data-${VERSION}`;

const SHELL_URLS = [
  '/', '/index.html', '/manifest.json',
  '/css/app.css', '/js/app.js',
  '/icons/icon-192.png', '/icons/icon-512.png',
];

// install: precache shell
// activate: delete old caches, claim clients
// fetch:
//   - 非 GET / 跨源 / Range → 放行
//   - /data/*.json         → network-first, cache fallback
//   - / 或 .html / /css/ / /js/ / /icons/ / manifest.json → stale-while-revalidate
//   - 其他                 → 放行（等同 network-only）
```

⚠️ **关键点 1**：`/js/app.js?v=20260513-07` 与 `/js/app.js` 是**同一个 Request key（带 search）**。SW 用 stale-while-revalidate 会先返回旧缓存再异步更新，**用户首次访问新版时仍会拿到旧 JS**。旧版 JS 里的端点可能是 `/auth/email/send` 而不是当前的 `/auth/email/request`——如果用户缓存中有上周版本，第一次点发送会打到一个不存在的路径。

⚠️ **关键点 2**：SW 不处理 `api.ailatest.org` 请求（因为 `url.origin !== location.origin`），这部分没问题。

---

## 5. 登录 UI（js/app.js:287-434 摘要）

### 5.1 API_BASE 约定（app.js:124）

```js
const API_BASE = (window.AILATEST_API_BASE
  || (location.hostname === 'localhost' ? 'http://localhost:8787' : 'https://api.ailatest.org'));
```

### 5.2 弹窗 DOM（app.js:291-330）

弹窗是**第一次点击"登录"时才 `document.createElement` 并 append**。三端并列：邮箱 form / GitHub / Google。

```html
<form class="login-email">
  <input type="email" name="email" required />
  <div class="login-code-row" hidden>
    <input type="text" name="code" inputmode="numeric" pattern="\d{6}" maxlength="6" />
  </div>
  <button class="login-btn-primary" data-step="request">发送验证码</button>
  <div class="login-msg" role="status"></div>
</form>
```

### 5.3 邮箱流（app.js:338-384）

```js
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('.login-btn-primary', form);
  const step = btn.dataset.step;        // 'request' | 'verify'

  if (step === 'request') {
    const r = await fetch(`${API_BASE}/auth/email/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailEl.value.trim().toLowerCase() }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || '发送失败');
    $('.login-code-row', form).hidden = false;
    btn.dataset.step = 'verify';
    btn.textContent = '登录';
  } else {
    const r = await fetch(`${API_BASE}/auth/email/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailEl.value.trim().toLowerCase(),
        code:  codeEl.value.trim(),
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || '验证失败');
    await finishLogin(d.token);
    closeLoginModal();
  }
});
```

⚠️ **注意**：fetch **没有带 `credentials` / `mode` / `Origin`**，走默认跨源 CORS simple/preflight；payload 字段名 `email` / `code`，与 Worker 一致。

### 5.4 OAuth 跳转（app.js:387-395）

```js
$$('.login-btn-oauth', modal).forEach(btn => {
  btn.addEventListener('click', () => {
    const p = btn.dataset.provider;           // 'github' | 'google'
    const state = Math.random().toString(36).slice(2);
    sessionStorage.setItem('ailatest.oauth_state', state);
    const redirect = encodeURIComponent(location.origin + location.pathname);
    location.href = `${API_BASE}/auth/${p}?state=${state}&redirect=${redirect}`;
  });
});
```

### 5.5 登录收尾（app.js:405-434）

```js
async function finishLogin(token) {
  const r = await fetch(`${API_BASE}/me`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!r.ok) throw new Error('用户信息获取失败');
  const me = await r.json();
  user = { ...me, token };
  localStorage.setItem('ailatest.user', JSON.stringify(user));
  await pullFavs();
  applyI18n();
}

// OAuth 回跳时从 ?token= 中提取并调 finishLogin
async function handleAuthCallback() { ... }
```

---

## 6. Worker 后端（worker/src/index.js 摘要）

### 6.1 CORS（第 33 行）

```js
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};
```

所有 JSON 响应与 204 OPTIONS 都会带这组头。

### 6.2 路由表（第 429-451 行 dispatcher）

| Method | Path | 函数 |
|---|---|---|
| OPTIONS | * | 204 + CORS |
| GET | `/` | `{ok:true, v:2}` |
| POST | `/auth/email/request` | `routeEmailRequest` |
| POST | `/auth/email/verify`  | `routeEmailVerify` |
| GET | `/auth/github`           | `routeAuthStart`（302 到 GitHub） |
| GET | `/auth/github/callback`  | `routeAuthCallback`（302 回前端 ?token=） |
| GET | `/auth/google`           | `routeGoogleStart` |
| GET | `/auth/google/callback`  | `routeGoogleCallback` |
| GET | `/me`                    | `routeMe`（Bearer） |
| GET | `/favorites`             | `routeGetFavs`（Bearer） |
| PUT | `/favorites`             | `routePutFavs`（Bearer） |
| * | 其他 | `err('not found', 404)` |

### 6.3 邮箱验证码流（第 171-234 行）

**/auth/email/request**：
1. `body.email` 清洗+正则校验；
2. 同一 email 60s 限流（查 `email_codes.created_at`）；
3. 生成 6 位随机码 → `sha256(code|email|CODE_PEPPER)` → 存 `email_codes`，10 分钟过期；
4. 调 Resend POST https://api.resend.com/emails 发送；失败返回 500 `发送邮件失败：...`；
5. 成功返回 `{ ok: true, expires_in: 600 }`。

**/auth/email/verify**：
1. `body.email` + `body.code`（6 位数字）校验；
2. 查 `email_codes`：不存在→`请先请求验证码`；过期→`验证码已过期`；`attempts >= 5`→429；
3. 计算 hash 对比；错→`attempts++`，返回 `验证码错误`；
4. 成功→删记录 + `upsertEmailUser` + `signJWT({uid, email})` → `{ token }`。

### 6.4 JWT（第 71-93 行）

```js
async function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = { iat: now, exp: now + 30d, ...payload };
  ...
}
```

---

## 7. D1 Schema（worker/schema.sql）

```sql
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT UNIQUE,
  github_id   INTEGER UNIQUE,
  google_id   TEXT UNIQUE,
  login       TEXT,
  name        TEXT,
  avatar_url  TEXT,
  provider    TEXT,                    -- 'email' | 'github' | 'google'
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id      INTEGER NOT NULL,
  journal_key  TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (user_id, journal_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_codes (
  email       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  attempts    INTEGER DEFAULT 0,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (email)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google   ON users(google_id);
```

---

## 8. wrangler.toml

```toml
name = "ailatest-journal-api"
main = "src/index.js"
compatibility_date = "2024-11-01"

routes = [
  { pattern = "api.ailatest.org", custom_domain = true }
]

[vars]
GITHUB_CLIENT_ID = "Ov23liKY2We6M23yTMJV"
GOOGLE_CLIENT_ID = ""                       # 未配
SITE_URL         = "https://journal.ailatest.org"
MAIL_FROM        = "noreply@ailatest.org"   # Resend 已验证

[[d1_databases]]
binding = "DB"
database_name = "ailatest-journal"
database_id   = "861dd053-c23a-4363-b62b-2559c06ec3fd"
```

**Secrets（均已配置）**：`JWT_SECRET` · `GITHUB_CLIENT_SECRET` · `GOOGLE_CLIENT_SECRET`（空值占位） · `RESEND_API_KEY` · `CODE_PEPPER`

---

## 9. 已验证的现网行为（curl）

```bash
# CORS 预检
$ curl -sI -X OPTIONS https://api.ailatest.org/auth/email/request \
  -H "Origin: https://journal.ailatest.org" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"
HTTP/2 204
access-control-allow-origin: *
access-control-allow-headers: Authorization, Content-Type
access-control-allow-methods: GET, POST, PUT, DELETE, OPTIONS

# 真发验证码
$ curl -s -X POST https://api.ailatest.org/auth/email/request \
  -H "Content-Type: application/json" \
  -d '{"email":"jiantaoweng@gmail.com"}'
{"ok":true,"expires_in":600}
```

**D1 email_codes 最近一条**（验证时已存在过期记录，attempts=1）：

```
email: jiantaoweng@gmail.com
attempts: 1
expires_at: 1778635353
```

说明：后端链路从 OPTIONS、POST、写 D1、触发 Resend，全部通。失败一定发生在客户端到达不了 Worker，或 Worker 响应客户端处理失败。

---

## 10. 故障现状与已排查过的路径

**用户端表现**：
- 在 journal.ailatest.org 点"登录"，输入邮箱，点"发送验证码"后提示失败（具体文案未拿到截图）；
- 两个不同邮箱（含 `jiantaoweng@gmail.com`）都失败；
- Service Worker 已按指引清过（应用面板 → Unregister + Clear site data）；
- 无痕窗口也试过，仍失败（待复核）。

**网络环境**：
- macOS + Clash Verge；
- 发现过 `api.ailatest.org` 被解析到 `198.18.0.4`（Clash fake-IP 段）；
- 已在 Merge 模板里全局 prepend-rules：
  ```yaml
  prepend-rules:
    - DOMAIN-SUFFIX,ailatest.org,DIRECT
    - DOMAIN-SUFFIX,cloudflare.com,DIRECT
    - DOMAIN-SUFFIX,pages.dev,DIRECT
    - DOMAIN-SUFFIX,workers.dev,DIRECT
  ```
- 但**未确认用户重载 Clash 配置后 journal 页面的浏览器请求是否真的走 DIRECT**——浏览器层面仍可能命中旧 DNS 缓存或仍经过某个代理节点，从而看到 TLS 错误/超时/CORS 异常。

---

## 11. 给 Codex 的重点审查清单（按可能性排序）

### A. SW 缓存了老版 app.js（**最高可能**）
- `sw.js` 用 **stale-while-revalidate** 缓存 `/js/app.js?v=...`；
- 昨天之前我们改过端点路径（传闻早期是 `/auth/email/send`），若旧版仍在缓存，首次发送会 404 / 直接抛 `TypeError`；
- 用户自称清过 SW，但若 **浏览器多 tab** 或 **PWA 已安装为独立 app**，激活新 SW 需要关闭所有实例；
- 建议：在 SW `install` 里强制调用 `self.skipWaiting()`（✅ 已有）+ 在 `activate` 里 `clients.claim()`（✅ 已有），但前端入口没有监听 `controllerchange` 触发 reload，需要用户手动 hard reload；
- 建议 Codex 检查：`sw.js` 第 48-85 行 fetch handler 中 `isShell` 命中 `app.js?v=...` 的缓存是否会阻塞新版加载。

### B. `fetch` 被网络栈/代理在 TLS 层拦截
- `https://api.ailatest.org` CF 真实 IP：`104.21.35.8 / 172.67.167.40`；
- 若 Clash 规则未生效，`api.ailatest.org` 仍可能被 fake-IP 劫持 → `net::ERR_CONNECTION_REFUSED` / `net::ERR_CONNECTION_TIMED_OUT`；
- Chrome DevTools Network 面板的红色条目 + `Response` 空 = 这种情况；
- 建议：让用户 `curl -v https://api.ailatest.org/ ` 看返回是否与浏览器一致。

### C. Resend 发出去了但邮件没到
- Worker 已收到请求并返回 `{ok:true}`，但 Resend 域名虽然验证，**实际投递可能被 Gmail 丢进垃圾/拦截**；
- 用户没收到邮件 → 在弹窗"未显示失败"的情况下也会误以为失败；
- 建议：登录 Resend Dashboard 查最近发信的 delivery status，搜索 `jiantaoweng@gmail.com`。

### D. `Access-Control-Allow-Origin: *` + 将来加 credentials 的冲突
- 目前前端没带 `credentials: 'include'`，暂时没问题；
- 若将来改成 cookie 会话，`*` 必须换成具体 Origin，否则浏览器拒收响应。

### E. payload 字段名 / 大小写
- 前端 `code`，Worker `body.code`（worker/src/index.js:210）— 一致；
- 前端 `email`，Worker `body.email`（worker/src/index.js:173, 209）— 一致；
- email 前端做了 `.trim().toLowerCase()`，Worker 也做了 `.trim().toLowerCase()` — 一致。

### F. email_codes 状态残留
- D1 里已有 `jiantaoweng@gmail.com` 的一条未过期记录（`attempts=1`）；
- `/auth/email/request` 触发 `ON CONFLICT(email) DO UPDATE` 会把它覆盖，**但** 同时"60s 内不能重复请求"的限流是基于这条记录的 `created_at`，如果用户连点会被顶回 429 `请稍候再试`；
- 建议：在排查时清空 `email_codes` 表，或等 60s 再试。

### G. GitHub 按钮的 OAuth callback 状态
- GitHub App 的 `Authorization callback URL` 必须是 `https://api.ailatest.org/auth/github/callback`，不是 journal 子域；
- 若配成了 journal 子域，走 OAuth 会回到一个 Pages 404。

---

## 12. 下一步定位所需证据（请用户提供）

1. **journal.ailatest.org 打开 F12 → Network 面板**，点"发送验证码"后，截图 / 导出 HAR 里 `request` 和 `verify` 两条请求：
   - Status、Response、Request Payload；
   - Timing（有没有 stall / blocked）；
2. **F12 → Console** 有没有红色报错（CORS / TypeError / NetworkError）；
3. **Application → Service Workers**：当前 SW 的 status / scope / updated 时间；
4. **Application → Local Storage → journal.ailatest.org**：`ailatest.user` 是否为 null；
5. （可选）Resend Dashboard 里 `jiantaoweng@gmail.com` 最后一封邮件的 delivered/bounced/complained 状态。

---

## 13. 关键运行时常量一览

| 项目 | 值 |
|---|---|
| 解锁码（学校 A 2023） | `hzcu-byB5LaJy79nY4vSL` |
| GitHub OAuth Client ID | `Ov23liKY2We6M23yTMJV` |
| GitHub callback | `https://api.ailatest.org/auth/github/callback` |
| Google callback（待配） | `https://api.ailatest.org/auth/google/callback` |
| Resend 发件地址 | `noreply@ailatest.org`（DKIM+SPF ok） |
| Worker Version | `325ebf3b` |
| Cloudflare Pages 项目 | `ailatest-journal` → main 自动部署 |
| D1 database_id | `861dd053-c23a-4363-b62b-2559c06ec3fd` |
| api.ailatest.org 真实 IP | `104.21.35.8` / `172.67.167.40` |
| Clash fake-IP 段 | `198.18.0.0/15` |

---

## 14. 最近 commit（供 Codex 对照）

```
68f1bfc fix(cnkx): replace old garbage records with pdfplumber clean 9998 entries
8318811 feat(auth): email code + google oauth + multi-provider login modal   ← 登录 UI 改这版
54f340e fix(cnkx): re-extract 科协 2025-12 PDF, 9998 records, tier 100%
a30b183 refactor: rename zju_city → school_a for anonymization
24fb1e1 feat: merge Ei Compendex Oct 2025 source list
8b2b94d auth: enable GitHub login button
4eff44b worker: deploy with GitHub Client ID + api.ailatest.org custom domain
cc56bc4 Phase 1: OpenAlex metadata + PWA
```

---

## 15. 复现 / 本地调试建议（给 Codex）

```bash
# 1. 本地启 Worker（dev 预览，会直连远端 D1）
cd worker
wrangler dev --remote

# 2. 前端指向 localhost worker：在 DevTools Console
window.AILATEST_API_BASE = 'http://localhost:8787'
# 然后点"发送验证码"，看 worker 控制台是否收到请求

# 3. 直接打 Resend 测试邮件
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from":"noreply@ailatest.org","to":["xxx@gmail.com"],"subject":"test","text":"hi"}'

# 4. 查 D1
wrangler d1 execute ailatest-journal --remote --command \
  "SELECT email, attempts, datetime(expires_at,'unixepoch') FROM email_codes ORDER BY created_at DESC LIMIT 5"
```

---

**要 Codex 集中看的三段代码**（按优先级）：
1. `worker/src/index.js:171-234`（邮箱流核心）
2. `js/app.js:287-434`（登录 UI + OAuth 跳转 + callback 回吃 token）
3. `sw.js:36-85`（缓存策略——最可能搞坏前端 JS 版本）

以上。
