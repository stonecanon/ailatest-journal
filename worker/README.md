# AILatest Journal API (Cloudflare Worker + D1)

GitHub OAuth login + journal favorites, persisted in D1.

## 部署步骤

**1. 创建 GitHub OAuth App**
   - https://github.com/settings/developers → New OAuth App
   - Homepage URL: `https://journal.ailatest.org`
   - Authorization callback URL: `https://api.ailatest.org/auth/github/callback`
     （或先用 `https://ailatest-journal-api.<you>.workers.dev/auth/github/callback`）
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
   npx wrangler secret put JWT_SECRET   # openssl rand -base64 48
   ```
   在 `wrangler.toml` 填 `GITHUB_CLIENT_ID`。

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
