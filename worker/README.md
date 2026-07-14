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
   ```
   在 `wrangler.toml` 填 `GITHUB_CLIENT_ID` 和 `GOOGLE_CLIENT_ID`。`GOOGLE_CLIENT_ID` 不是 secret；如果不想写进仓库，也可以在 Cloudflare Dashboard → Workers → `ailatest-journal-api` → Settings → Variables 里添加同名变量。

**4. 部署**
   ```bash
   npx wrangler deploy
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
