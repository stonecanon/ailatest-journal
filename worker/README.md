# AILatest Journal API (Cloudflare Worker + D1)

Email code, GitHub OAuth, Google OAuth login + journal favorites, persisted in D1.

## 部署步骤

**1. 创建 GitHub OAuth App**
   - https://github.com/settings/developers → New OAuth App
   - Homepage URL: `https://journal.ailatest.org`
   - Authorization callback URL: `https://api.ailatest.org/auth/github/callback`
     （或先用 `https://ailatest-journal-api.<you>.workers.dev/auth/github/callback`）
   - 记下 Client ID / Client Secret

**1b. 创建 Google OAuth Client**
   - https://console.cloud.google.com/apis/credentials → Create credentials → OAuth client ID
   - Application type: `Web application`
   - Authorized JavaScript origins:
     - `https://journal.ailatest.org`
     - `https://api.ailatest.org`
   - Authorized redirect URIs:
     - `https://api.ailatest.org/auth/google/callback`
     - 如果临时用 workers.dev 测试，再加：`https://ailatest-journal-api.<you>.workers.dev/auth/google/callback`
   - 记下 Client ID / Client Secret

**2. 创建 D1 数据库**
   ```bash
   cd worker
   npx wrangler d1 create ailatest-journal
   # 把输出的 database_id 粘进 wrangler.toml
   npx wrangler d1 execute ailatest-journal --file=schema.sql
   ```

**3. 配置 secrets**
   ```bash
   npx wrangler secret put GITHUB_CLIENT_SECRET
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npx wrangler secret put JWT_SECRET   # openssl rand -base64 48
   npx wrangler secret put OPENALEX_API_KEY   # 国家/地区作者机构占比
   npx wrangler secret put OPENALEX_API_KEY_2 # 可选：第二把 OpenAlex key，预加载轮换使用
   npx wrangler secret put OPENALEX_API_KEY_3 # 可选：第三把 OpenAlex key，预加载轮换使用
   npx wrangler secret put OPENALEX_API_KEY_4 # 可选：第四把 OpenAlex key，预加载轮换使用
   ```
   在 `wrangler.toml` 填 `GITHUB_CLIENT_ID` 和 `GOOGLE_CLIENT_ID`。`GOOGLE_CLIENT_ID` 不是 secret；如果不想写进仓库，也可以在 Cloudflare Dashboard → Workers → `ailatest-journal-api` → Settings → Variables 里添加同名变量。

**4. 部署**
   ```bash
   npx wrangler deploy
   ```

## 统一后台

部署后从 `https://api.ailatest.org/admin` 进入站长后台，使用
`jiantaoweng@gmail.com` 的 Google 账号登录。后台覆盖 Journal、Grant、Path、
Major、Todo 与 Studio：项目注册表、用户、权益、跨产品会员、礼品码、API Key、
Creem 会员/回调记录、D1 覆盖配置和审计日志。

所有接口都在 Worker 端再次校验站长邮箱；后台的“删除”只执行停用或归档，
不会物理删除用户、付款或历史统计。付款退款仍需在 Creem 完成。期刊主体数据
目前继续由 Pages 的静态数据发布，后台的覆盖配置用于逐步添加隐藏、风险标记和
补充字段，不直接改写大型静态数据文件。

首次打开后台会自动补齐旧 D1 的管理表和 `users.status` / `users.admin_note` 字段。
如需显式执行迁移，可运行：

```bash
npx wrangler d1 migrations apply ailatest-journal --remote
```

**5. 绑定自定义域（可选）**
   - Cloudflare → Workers → ailatest-journal-api → Triggers → Custom Domains
   - 添加 `api.ailatest.org`

**6. 前端指向**
   前端 `js/app.js` 的 `API_BASE` 默认会用 `https://api.ailatest.org`。
   如果用 `workers.dev` 临时域名，在 `index.html` 里加：
   ```html
   <script>window.AILATEST_API_BASE = "https://ailatest-journal-api.<sub>.workers.dev";</script>
   ```
   放在 `<script src="js/app.js">` 之前。
