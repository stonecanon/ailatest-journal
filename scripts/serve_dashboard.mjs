import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.argv[2] || process.env.PORT || 4177);
let refreshInFlight = null;
let lastRefresh = null;
let lastRefreshError = null;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function refreshData() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = new Promise((resolvePromise) => {
    const child = spawn(process.execPath, ['scripts/build_dashboard_data.mjs'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', d => { output += d; });
    child.stderr.on('data', d => { output += d; });
    child.on('close', code => {
      if (code === 0) {
        lastRefresh = new Date().toISOString();
        lastRefreshError = null;
        console.log(`[dashboard] data refreshed at ${lastRefresh}`);
      } else {
        lastRefreshError = output.trim() || `refresh exited with code ${code}`;
        console.error(`[dashboard] refresh failed: ${lastRefreshError}`);
      }
      refreshInFlight = null;
      resolvePromise({ ok: code === 0, output, lastRefresh, lastRefreshError });
    });
  });
  return refreshInFlight;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Cache-Control': 'no-store, max-age=0',
    ...headers,
  });
  res.end(body);
}

async function serveFile(req, res) {
  const rawPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const requested = rawPath === '/' ? '/dashboard/' : rawPath;
  const relative = requested.endsWith('/') ? `${requested}index.html` : requested;
  const safePath = normalize(relative).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(root, safePath);
  if (!filePath.startsWith(root)) {
    send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }

  try {
    await access(filePath);
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('not a file');
    res.writeHead(200, {
      'Content-Type': types[extname(filePath)] || 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-store, max-age=0',
    });
    createReadStream(filePath).pipe(res);
  } catch (_) {
    send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
}

const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, `http://${req.headers.host}`).pathname;
    if (path === '/dashboard/refresh') {
      const result = await refreshData();
      send(res, result.ok ? 200 : 500, JSON.stringify(result, null, 2), {
        'Content-Type': 'application/json; charset=utf-8',
      });
      return;
    }
    if (path === '/dashboard/status') {
      send(res, 200, JSON.stringify({ ok: true, lastRefresh, lastRefreshError }, null, 2), {
        'Content-Type': 'application/json; charset=utf-8',
      });
      return;
    }
    await serveFile(req, res);
  } catch (err) {
    send(res, 500, String(err?.stack || err), { 'Content-Type': 'text/plain; charset=utf-8' });
  }
});

server.listen(port, '127.0.0.1', async () => {
  console.log(`[dashboard] serving http://127.0.0.1:${port}/dashboard/`);
  await refreshData();
});

setInterval(refreshData, 5 * 60 * 1000).unref();
