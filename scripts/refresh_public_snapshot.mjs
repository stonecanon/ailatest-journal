import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const worker = fileURLToPath(new URL('../worker/', import.meta.url));
function query(sql) {
  const output = execFileSync('npx', ['wrangler','d1','execute','ailatest-journal','--remote','--command',sql,'--json'], {cwd:worker,maxBuffer:32*1024*1024,encoding:'utf8'});
  const data = JSON.parse(output.slice(output.indexOf('[\n')));
  if (!data.every(x=>x.success)) throw new Error('Snapshot query failed');
  return data.map(x=>x.results);
}
const [rows, pages, users, downloads, hot] = query(`SELECT journal_key,count,updated_at FROM journal_views;
SELECT COUNT(*) AS total_pageviews,COUNT(DISTINCT visitor_id) AS total_visitors,COUNT(DISTINCT session_id) AS total_sessions,MIN(event_at) AS first_pageview_at,MAX(event_at) AS latest_pageview_at FROM page_events;
SELECT COUNT(*) AS registered_users FROM users;
SELECT asset,total,latest_at FROM extension_download_stats;
SELECT journal_key,MAX(journal_name) AS journal_name,MAX(journal_issn) AS journal_issn,COUNT(*) AS views,MAX(COALESCE(NULLIF(event_time,0),viewed_at)) AS latest_viewed FROM journal_view_events WHERE COALESCE(NULLIF(event_time,0),viewed_at)>=strftime('%s','now','-30 days') AND COALESCE(traffic_type,CASE WHEN is_bot=1 THEN 'scraper' ELSE 'human' END)='human' AND journal_key IS NOT NULL AND TRIM(journal_key)!='' GROUP BY journal_key ORDER BY views DESC,latest_viewed DESC,journal_key ASC LIMIT 20;`);
if (!rows.length || !pages.length) throw new Error('Empty snapshot; preserving previous data');
const valid = rows.filter(x=>!/^test[-_]/i.test(x.journal_key));
const snapshot = {snapshot_at:new Date().toISOString(), views:Object.fromEntries(valid.map(x=>[x.journal_key,x.count])), totals:{...pages[0],...users[0],viewed_journals:valid.length,total_journal_views:valid.reduce((n,x)=>n+x.count,0),latest_journal_view_at:Math.max(...valid.map(x=>x.updated_at))}, downloads:Object.fromEntries(downloads.map(x=>[x.asset,{total:x.total,latest_at:x.latest_at}])), hot:valid.sort((a,b)=>b.count-a.count).slice(0,20).map(x=>({journal_key:x.journal_key,journal_issn:x.journal_key,views:x.count,latest_viewed:x.updated_at}))};
snapshot.hot = hot;
snapshot.hot_days = 30;
snapshot.collection_paused = true;
writeFileSync(new URL('../worker/src/public-snapshot.json',import.meta.url),JSON.stringify(snapshot));
console.log(JSON.stringify({snapshot_at:snapshot.snapshot_at,...snapshot.totals,downloads:snapshot.downloads}));
