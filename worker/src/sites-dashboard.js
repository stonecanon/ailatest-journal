/**
 * sites-dashboard.js — 三站数据看板 (v3 working)
 * Restored from original deployed version, only fix: async function load()
 */
export function renderSitesDashboard(opts = {}) {
  const initialSite = opts.initialSite || 'overview';
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AILatest 产品数据看板</title>
<style>
:root{color-scheme:light;--bg:#f6f7f8;--panel:#fff;--line:#d9dde3;--ink:#1f2933;--muted:#667085;--accent:#2563eb;--good:#0f766e;--warn:#b45309}
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);color:var(--ink)}
.shell{max-width:1200px;margin:0 auto;padding:24px 16px 56px}.top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}
h1{margin:0 0 6px;font-size:24px}.muted{color:var(--muted);font-size:13px}
.note-box{background:#fff7ed;border:1px solid #fed7aa;color:#7c2d12;border-radius:8px;padding:10px 12px;margin:12px 0;font-size:13px;line-height:1.65}
.login,.error{border:1px solid var(--line);background:var(--panel);padding:18px;border-radius:8px}
button,.btn{border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:6px;padding:8px 12px;font:inherit;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px}
button.active,.btn.active{background:var(--accent);border-color:var(--accent);color:#fff}.tabs{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px;min-width:0;overflow:hidden}.metric{font-size:26px;font-weight:750;margin-top:4px}.label{font-size:12px;color:var(--muted);text-transform:uppercase}
.banner{background:#ecfeff;border:1px solid #99f6e4;color:#134e4a;border-radius:8px;padding:10px 12px;margin:12px 0;font-size:13px}.summary{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin:12px 0}.summary .card{padding:10px}.summary .metric{font-size:20px}
.cols{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,.85fr);gap:12px;margin-top:12px}.table{width:100%;border-collapse:collapse;font-size:12.5px;table-layout:fixed}.table th,.table td{border-bottom:1px solid var(--line);padding:7px 6px;text-align:left;vertical-align:top;overflow:hidden;text-overflow:ellipsis}.table th{color:var(--muted);font-weight:650}.status{font-size:12px;color:var(--muted)}
.bar{height:8px;background:#eef2ff;border-radius:99px;overflow:hidden}.fill{height:100%;background:var(--accent)}.source-title{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:10px}
.path-cell{max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.detail-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;margin-top:12px}.detail-grid>.priority-main{grid-column:1/-1;order:-30}.detail-grid>.priority-search{grid-column:1/-1;order:-20}.detail-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}.section-title{margin:18px 0 8px;font-size:16px}.compact .metric{font-size:18px}.pill{display:inline-flex;border:1px solid var(--line);border-radius:999px;padding:2px 7px;font-size:12px;color:var(--muted)}
.traffic-row{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.traffic-chip{border:1px solid var(--line);border-radius:8px;padding:10px;background:#fff}.traffic-chip strong{display:block;font-size:18px}.traffic-chip span{font-size:12px;color:var(--muted)}
.feed-panel{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:22px;margin:16px 0;box-shadow:0 12px 36px rgba(15,23,42,.05)}
.feed-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:16px}.feed-title{margin:0;font-size:19px;color:#1b2d4f}.feed-sub{margin:3px 0 0;color:var(--muted);font-size:13px}
.feed-kpis{display:flex;gap:28px;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #e8e6e1;flex-wrap:wrap}.feed-kpi strong{display:block;font-size:24px;color:#1b2d4f}.feed-kpi span{font-size:12px;color:var(--muted)}
.feed-grid{display:grid;grid-template-columns:1.55fr 1fr;gap:22px}.feed-chart{height:205px;border-bottom:1px solid #e8e6e1;position:relative;padding:8px 0 18px}
.feed-bars{height:100%;display:flex;align-items:flex-end;gap:5px}.feed-bar{flex:1;min-width:4px;background:#1b2d4f;border-radius:3px 3px 0 0;opacity:.88}.feed-bar:nth-child(3n){background:#3b82f6}.feed-bar:nth-child(4n){background:#10b981}.feed-axis{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between;color:var(--muted);font-size:11px}
.feed-list-title{font-size:13px;font-weight:700;color:#1b2d4f;margin:0 0 10px}.feed-row{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:13px}.feed-row-name{width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#475467}.feed-row-track{flex:1;height:14px;background:#f5f0eb;border-radius:3px;overflow:hidden}.feed-row-fill{height:100%;background:#1b2d4f;border-radius:3px}.feed-row-val{width:50px;text-align:right;color:var(--muted);font-size:12px;font-weight:650}
.feed-source-stack{display:flex;height:26px;border-radius:5px;overflow:hidden;margin:8px 0 10px}.feed-source-stack[data-chart-rows],.feed-rank[data-chart-rows]{cursor:pointer}.feed-source-seg{display:flex;align-items:center;justify-content:center;min-width:2px;color:#fff;font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden}.feed-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--muted)}.feed-dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:5px}
.controls{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.period-toggle{display:inline-flex;border:1px solid var(--line);border-radius:7px;overflow:hidden;background:#fff}.period-toggle button{border:0;border-left:1px solid var(--line);border-radius:0;padding:7px 13px;font-weight:700;color:var(--muted)}.period-toggle button:first-child{border-left:0}.period-toggle button.active{background:#1b2d4f;color:#fff}.scroll,.table-wrap{max-width:100%;overflow:auto;border:1px solid var(--line);border-radius:6px;margin-top:8px}.scroll{max-height:360px}.scroll.tall{max-height:620px}.scroll table,.table-wrap table{margin:0;min-width:620px}.scroll.wide table{min-width:1500px}.chart{width:100%;height:248px;margin:14px 0 8px;position:relative;cursor:pointer}.chart svg{width:100%;height:100%;display:block}.chart .axis{stroke:#d9dde3;stroke-width:1}.chart .grid-line{stroke:#edf0f3;stroke-width:1}.chart .line{fill:none;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}.chart .area{opacity:.14}.chart .dot{fill:#fff;stroke-width:2}.chart .axis-text{fill:#7a8491;font-size:12px}.chart .axis-label{fill:#667085;font-size:12px;font-weight:650}.chart .hint{position:absolute;right:8px;top:7px;color:#98a2b3;font-size:12px;pointer-events:none}.chart-legend{display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin:6px 0 4px;color:var(--muted);font-size:13px}.legend-dot{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:6px}.modal-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.42);z-index:50;display:flex;align-items:center;justify-content:center;padding:24px}.modal-panel{background:#fff;border-radius:8px;max-width:920px;width:min(920px,96vw);max-height:82vh;overflow:auto;border:1px solid var(--line);box-shadow:0 24px 80px rgba(15,23,42,.24)}.modal-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line)}.modal-body{padding:10px 16px 18px}.alert{color:#dc2626;font-weight:700}
@media(max-width:820px){.top,.cols,.detail-grid,.traffic-row,.feed-grid{display:block}.grid,.summary{grid-template-columns:1fr}.card{margin-bottom:10px}.traffic-chip{margin-bottom:8px}.path-cell{max-width:58vw}.feed-kpis{gap:16px}.feed-panel{padding:16px}.feed-chart{height:160px}.feed-row-name{width:96px}.feed-head{display:block}.period-toggle{margin-top:10px}.chart{height:220px}}
</style>
</head>
<body>
<main class="shell">
  <div class="top">
    <div>
      <h1>产品数据看板</h1>
      <div class="muted">Journal · Grant · Path · Major · Todo · Studio</div>
    </div>
    <button id="logout" style="display:none;border:1px solid var(--line);background:#fff;border-radius:6px;padding:6px 10px;cursor:pointer">退出</button>
  </div>
  <div class="note-box">
    <strong>📌 统计口径说明</strong><br>
    1. <b>自建埋点</b>为产品运营数据标准。PV=page_view 计数，UV=visitor_id 去重，Session=session_id 去重。<br>
    2. <b>GA4</b>用于来源分析、渠道分析、用户行为分析。存在数据处理延迟（通常数小时至 24-48 小时），当天数据可能变化，因此不要直接与实时埋点比较。<br>
    3. <b>Cloudflare</b>用于服务器流量参考，不作为真实用户统计。
  </div>
  <section id="app" class="login">正在检查登录状态...</section>
</main>
<script>
(function(){
  var API = location.origin;
  var SITES_BASE = API + '/analytics/sites';
  var TOKEN_KEY='ailatest.dashboard.token';
  var app = document.getElementById('app');
  var logout = document.getElementById('logout');
  var payload = null;
  var activeSite = ${JSON.stringify(initialSite)};
  var initialDays = Number(new URL(location.href).searchParams.get('days') || 30);
  var activeDays = [1,7,30].indexOf(initialDays) >= 0 ? initialDays : 30;
  var activeTraffic = new URL(location.href).searchParams.get('traffic') || 'human';

  function esc(v){return String(v == null ? '' : v).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function n(v){return Number(v || 0).toLocaleString('zh-CN');}
  function localTs(v){return v ? new Date(v).toLocaleString('zh-CN') : '';}
  function total(obj,key){return n((obj && obj.totals && obj.totals[key]) || 0);}
  function secTs(v){return v ? new Date(Number(v) * 1000).toLocaleString('zh-CN') : '';}
  function hourTs(v){return v ? new Date(v).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit'}) : '';}
  function periodToggle(){
    return '<div class="period-toggle">'+[1,7,30].map(function(d){
      var label = d === 1 ? '1d' : d === 7 ? '7d' : '30d';
      return '<button class="'+(d===activeDays?'active':'')+'" data-days="'+d+'">'+label+'</button>';
    }).join('')+'</div>';
  }
  function journalTrendBody(k, rows){
    k = k || {};
    return '<div class="muted" data-journal-trend-summary>当前周期浏览 '+n(k.total_journal_views)+' 次 · 覆盖期刊 '+n(k.viewed_journals)+' 本 · 累计总浏览 '+n(k.cumulative_journal_views || k.total_journal_views)+' 次</div>'+
      lineChart(rows || [], 'hour', 'views', {
        title: '所有期刊浏览量趋势',
        xLabel: activeDays === 1 ? '小时' : '日期',
        yLabel: '浏览量',
        series: [
          {key:'views',label:'期刊浏览量',color:'#6366f1'},
          {key:'visitors',label:'访客数',color:'#2bbf8a'}
        ]
      });
  }
  function shortX(v){
    if (!v) return '';
    var d = new Date(v);
    if (!isNaN(d.getTime())) {
      return activeDays === 1
        ? d.toLocaleTimeString('zh-CN',{hour:'2-digit'})
        : d.toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'});
    }
    return String(v).replace(/^\\d{4}-/,'');
  }
  function lineChart(rows, xKey, yKey, opts){
    opts = opts || {};
    var series = opts.series || [{key:yKey,label:opts.yLabel || yKey,color:opts.color || '#6366f1'}];
    rows = (rows || []).filter(function(r){
      return series.some(function(s){return Number(r[s.key] || 0) >= 0;});
    }).slice(-30);
    if (!rows.length) return '<div class="chart muted">暂无趋势数据</div>';
    var w=760,h=260,l=58,rp=18,t=18,b=52,base=h-b,plotW=w-l-rp,plotH=h-t-b;
    var max=Math.max.apply(null, rows.reduce(function(a,row){series.forEach(function(s){a.push(Number(row[s.key]||0));});return a;},[1]));
    var ticks=[0,.25,.5,.75,1];
    function xy(row,i,key){
      var x=l+(rows.length===1?plotW/2:i*plotW/(rows.length-1));
      var y=base-(Number(row[key]||0)/max)*plotH;
      return {x:x,y:y};
    }
    var detail = rows.map(function(row){
      var item = {'时间': row[xKey] || ''};
      series.forEach(function(s){item[s.label] = Number(row[s.key] || 0);});
      return item;
    });
    var svg = '<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(opts.title || '趋势图')+'">'+
      '<rect x="0" y="0" width="'+w+'" height="'+h+'" fill="#fff"></rect>'+
      ticks.map(function(k){
        var y=base-k*plotH;
        return '<line class="grid-line" x1="'+l+'" y1="'+y.toFixed(1)+'" x2="'+(w-rp)+'" y2="'+y.toFixed(1)+'"></line>'+
          '<text class="axis-text" x="'+(l-10)+'" y="'+(y+4).toFixed(1)+'" text-anchor="end">'+n(Math.round(max*k))+'</text>';
      }).join('')+
      '<line class="axis" x1="'+l+'" y1="'+base+'" x2="'+(w-rp)+'" y2="'+base+'"></line>'+
      '<line class="axis" x1="'+l+'" y1="'+t+'" x2="'+l+'" y2="'+base+'"></line>'+
      '<text class="axis-label" x="'+(w/2)+'" y="'+(h-10)+'" text-anchor="middle">'+esc(opts.xLabel || '时间')+'</text>'+
      '<text class="axis-label" transform="translate(15 '+(h/2)+') rotate(-90)" text-anchor="middle">'+esc(opts.yLabel || '数量')+'</text>';
    var tickEvery = Math.max(1, Math.ceil(rows.length / 6));
    svg += rows.map(function(row,i){
      if (i % tickEvery !== 0 && i !== rows.length-1) return '';
      var p=xy(row,i,series[0].key);
      return '<text class="axis-text" x="'+p.x.toFixed(1)+'" y="'+(base+20)+'" text-anchor="middle">'+esc(shortX(row[xKey]))+'</text>';
    }).join('');
    series.forEach(function(s,si){
      var pts=rows.map(function(row,i){return xy(row,i,s.key);});
      var d=pts.map(function(p,i){return (i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1);}).join(' ');
      var area=d+' L '+pts[pts.length-1].x.toFixed(1)+' '+base+' L '+pts[0].x.toFixed(1)+' '+base+' Z';
      svg += '<path class="area" d="'+area+'" fill="'+esc(s.color)+'"></path><path class="line" d="'+d+'" stroke="'+esc(s.color)+'"></path>'+
        pts.map(function(p,i){
          var row=rows[i], val=Number(row[s.key]||0);
          return '<circle class="dot" cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="'+(si?3:3.5)+'" stroke="'+esc(s.color)+'"><title>'+esc((row[xKey]||'')+' · '+s.label+' '+n(val))+'</title></circle>';
        }).join('');
    });
    svg += '</svg>';
    return '<div class="chart" role="button" tabindex="0" title="点击查看完整数据" data-chart-title="'+esc(opts.title || '趋势图')+'" data-chart-rows="'+esc(JSON.stringify(detail))+'">'+svg+'<span class="hint">点击查看明细</span></div>'+
      '<div class="chart-legend">'+series.map(function(s){return '<span><i class="legend-dot" style="background:'+esc(s.color)+'"></i>'+esc(s.label)+'</span>';}).join('')+'</div>';
  }
  function seriesRows(rows, cols){
    if (!rows || !rows.length) return '<tr><td colspan="'+cols.length+'" class="muted">暂无数据</td></tr>';
    return rows.slice(-14).reverse().map(function(r){
      return '<tr>'+cols.map(function(c){var text = c.f ? c.f(r[c.k], r) : r[c.k]; text = text == null ? '' : String(text); return '<td title="'+esc(text)+'">'+esc(text)+'</td>';}).join('')+'</tr>';
    }).join('');
  }
  function topRows(rows, metric){
    if (!rows || !rows.length) return '<tr><td colspan="3" class="muted">暂无数据</td></tr>';
    var max = Math.max.apply(null, rows.map(function(r){return Number(r[metric] || 0);}));
    return rows.slice(0,8).map(function(r){
      var pct = max ? Math.round(Number(r[metric] || 0) / max * 100) : 0;
      return '<tr><td class="path-cell" title="'+esc(r.path || '(not set)')+'">'+esc(r.path || '(not set)')+'</td><td>'+n(r[metric])+'</td><td><div class="bar"><div class="fill" style="width:'+pct+'%"></div></div></td></tr>';
    }).join('');
  }
  function sourceCard(title, data, rowsHtml, topHtml, opts){
    data = data || {}; opts = opts || {};
    var labels = opts.labels || ['PV','访客','会话'];
    var keys = opts.keys || ['pageviews','visitors','sessions'];
    var dateHeads = opts.dateHeads || ['日期','PV','访客','会话'];
    var topMetricLabel = opts.topMetricLabel || 'PV';
    var reason = data.reason || data.detail_reason || '';
    return '<section class="card"><div class="source-title"><strong>'+esc(title)+'</strong><span class="status">'+esc(data.status || 'empty')+'</span></div>'+
      (reason ? '<div class="alert" style="font-size:12px;margin:-4px 0 8px">'+esc(reason)+'</div>' : '')+
      '<div class="grid"><div><div class="label">'+esc(labels[0])+'</div><div class="metric">'+total(data,keys[0])+'</div></div><div><div class="label">'+esc(labels[1])+'</div><div class="metric">'+total(data,keys[1])+'</div></div><div><div class="label">'+esc(labels[2])+'</div><div class="metric">'+total(data,keys[2])+'</div></div></div>'+
      lineChart(opts.chartRows || data.series || [], opts.chartX || 'day', opts.chartY || keys[0], {
        title: title + ' 趋势',
        xLabel: opts.chartXLabel || (activeDays === 1 ? '小时' : '日期'),
        yLabel: opts.chartYLabel || labels[0],
        series: opts.chartSeries || [{key:opts.chartY || keys[0],label:labels[0],color:'#6366f1'}]
      })+
      '<div class="cols"><div><table class="table"><thead><tr>'+dateHeads.map(function(h){return '<th>'+esc(h)+'</th>';}).join('')+'</tr></thead><tbody>'+rowsHtml+'</tbody></table></div>'+
      '<div><table class="table"><thead><tr><th>热门路径</th><th>'+esc(topMetricLabel)+'</th><th></th></tr></thead><tbody>'+topHtml+'</tbody></table></div></div></section>';
  }
  function metricCards(items, cls){
    return '<div class="'+(cls || 'summary')+'">'+items.map(function(it){return '<div class="card compact"><div class="label">'+esc(it[0])+'</div><div class="metric">'+n(it[1])+'</div></div>';}).join('')+'</div>';
  }
  function trafficLabel(type){
    return ({human:'真人',search_engine_bot:'搜索引擎',ai_agent:'AI Agent',scraper:'爬虫',suspected_bot:'可疑',unknown:'未知',all:'全部'})[type] || type;
  }
  function trafficMixSection(fp){
    var mix = (fp || {}).traffic_mix || {};
    var all = Number(mix.all || 0) || ['human','search_engine_bot','ai_agent','scraper','suspected_bot','unknown'].reduce(function(s,k){return s + Number(mix[k]||0);},0);
    var items = [
      ['human','👤 真人用户'],['search_engine_bot','🤖 搜索引擎'],['ai_agent','🧠 AI Agent'],['scraper','🕷️ 其他爬虫'],['suspected_bot','⚠️ 可疑流量']
    ];
    return '<section class="card"><div class="source-title"><strong>流量来源分析</strong><span class="status">默认统计真人；可切换查看</span></div><div class="traffic-row">'+items.map(function(it){
      var v = Number(mix[it[0]] || 0); var pct = all ? Math.round(v / all * 100) : 0;
      return '<div class="traffic-chip"><span>'+esc(it[1])+'</span><strong>'+pct+'%</strong><div class="muted">'+n(v)+' / '+n(all)+'</div></div>';
    }).join('')+'</div><div style="margin-top:14px">'+sourceStack(mix)+'</div></section>';
  }
  function feedBars(rows, xKey, yKey){
    rows = (rows || []).slice(-30);
    var max = Math.max.apply(null, rows.map(function(r){return Number(r[yKey]||0);}).concat([1]));
    return '<div class="feed-chart"><div class="feed-bars">'+rows.map(function(r){
      var h = Math.max(2, Math.round(Number(r[yKey]||0)/max*100));
      return '<div class="feed-bar" style="height:'+h+'%" title="'+esc(r[xKey]||'')+' · '+n(r[yKey])+'"></div>';
    }).join('')+'</div><div class="feed-axis"><span>'+esc((rows[0]||{})[xKey]||'')+'</span><span>'+esc((rows[rows.length-1]||{})[xKey]||'')+'</span></div></div>';
  }
  function feedRank(title, rows, nameKey, valueKey){
    rows = (rows || []).slice(0,8);
    var max = Math.max.apply(null, rows.map(function(r){return Number(r[valueKey]||0);}).concat([1]));
    var detail = rows.map(function(r){
      var label = r[nameKey] || r.path || r.country || r.device || '(not set)';
      return {'名称':label,'数值':Number(r[valueKey]||0)};
    });
    return '<div class="feed-rank" role="button" tabindex="0" title="点击查看完整数据" data-chart-title="'+esc(title)+'" data-chart-rows="'+esc(JSON.stringify(detail))+'"><p class="feed-list-title">'+esc(title)+'</p>'+rows.map(function(r){
      var label = r[nameKey] || r.path || r.country || r.device || '(not set)';
      var w = Math.max(2, Math.round(Number(r[valueKey]||0)/max*100));
      return '<div class="feed-row"><span class="feed-row-name" title="'+esc(label)+'">'+esc(label)+'</span><span class="feed-row-track"><span class="feed-row-fill" style="display:block;width:'+w+'%"></span></span><span class="feed-row-val">'+n(r[valueKey])+'</span></div>';
    }).join('')+'</div>';
  }
  function sourceStack(mix){
    mix = mix || {};
    var defs = [
      ['human','真人','#1b2d4f'],['search_engine_bot','搜索','#3b82f6'],['ai_agent','AI','#ef4444'],['scraper','爬虫','#8b5cf6'],['suspected_bot','可疑','#b45309']
    ];
    var all = Number(mix.all || 0) || defs.reduce(function(s,d){return s+Number(mix[d[0]]||0);},0) || 1;
    var detail = defs.map(function(d){
      var count = Number(mix[d[0]] || 0);
      var pct = Math.round(count / all * 100);
      return {'类型':d[1],'数量':count,'占比':pct+'%'};
    });
    return '<div class="feed-source-stack" role="button" tabindex="0" title="点击查看完整数据" data-chart-title="流量类型占比" data-chart-rows="'+esc(JSON.stringify(detail))+'">'+defs.map(function(d){
      var pct = Math.round(Number(mix[d[0]]||0)/all*100);
      return '<span class="feed-source-seg" style="width:'+Math.max(pct, Number(mix[d[0]]||0)?3:0)+'%;background:'+d[2]+'">'+(pct>=10?d[1]+' '+pct+'%':'')+'</span>';
    }).join('')+'</div><div class="feed-legend">'+defs.map(function(d){return '<span><i class="feed-dot" style="background:'+d[2]+'"></i>'+d[1]+' '+n(mix[d[0]]||0)+'</span>';}).join('')+'</div>';
  }
  function feedAnalyticsSection(site, fp){
    return '<section class="feed-panel" data-site-traffic-card data-site-id="'+esc(site.id || '')+'"><div class="feed-head"><div><h2 class="feed-title">'+esc(site.label)+' 网站流量分析</h2><p class="feed-sub">真人流量（JS beacon / RUM，已排除爬虫）· 更新于 '+esc(localTs(payload.generated_at))+'</p></div>'+periodToggle()+'</div>'+
      '<div data-site-traffic-body>'+feedAnalyticsBody(site, fp)+'</div></section>';
  }
  function feedAnalyticsBody(site, fp){
    var series = activeDays === 1 && fp.hourly && fp.hourly.length
      ? fp.hourly.map(function(r){return {x:r.hour_start_utc, pv:r.pageviews, visitors:r.visitors, sessions:r.sessions};})
      : (fp.series || []).map(function(r){return {x:r.day, pv:r.pageviews, visitors:r.visitors, sessions:r.sessions};});
    var mix = fp.traffic_mix || {};
    return '<div class="feed-kpis"><div class="feed-kpi"><strong>'+n((fp.totals||{}).visitors)+'</strong><span>访客</span></div><div class="feed-kpi"><strong>'+n((fp.totals||{}).pageviews)+'</strong><span>浏览</span></div><div class="feed-kpi"><strong>'+n((fp.totals||{}).sessions)+'</strong><span>会话</span></div><div class="feed-kpi"><strong>'+n((fp.totals||{}).all_pv)+'</strong><span>含 Bot 全量</span></div></div>'+
      '<div class="feed-grid"><div>'+lineChart(series,'x','pv',{
        title: site.label + ' 访客 / 浏览趋势',
        xLabel: activeDays === 1 ? '小时' : '日期',
        yLabel: '访问量',
        series: [
          {key:'visitors',label:'访客',color:'#2bbf8a'},
          {key:'pv',label:'浏览',color:'#6366f1'}
        ]
      })+sourceStack(mix)+'</div><div>'+feedRank('热门路径', fp.topPaths || [], 'path', 'pageviews')+feedRank('国家 / 地区', fp.topCountries || [], 'country', 'pageviews')+'</div></div>';
  }
  function trafficControls(){
    var types = ['human','all','search_engine_bot','ai_agent','scraper','suspected_bot'];
    return '<div class="controls">'+types.map(function(t){return '<button class="'+(activeTraffic===t?'active':'')+'" data-traffic="'+esc(t)+'">'+esc(trafficLabel(t))+'</button>';}).join('')+'</div>';
  }
  function matchesTraffic(r){
    return activeTraffic === 'all' || (r.traffic_type || 'human') === activeTraffic;
  }
  function siteSummaryCards(site, fp, cf, ga){
    fp = fp || {}; cf = cf || {}; ga = ga || {};
    var items = [
      ['第一方 PV（不含站长）', (fp.totals || {}).pageviews],
      ['第一方访客', (fp.totals || {}).visitors],
      ['第一方会话', (fp.totals || {}).sessions],
      ['Bot 事件', (fp.totals || {}).bot_events],
      ['CF 页面请求', (cf.totals || {}).requests],
      ['GA PV', (ga.totals || {}).pageviews]
    ];
    return '<div class="section-title">'+esc(site.label || '')+' 站点概览 <span class="pill">'+esc(site.host || '')+'</span> <span class="pill">'+(activeDays===1?'近24小时':'近'+activeDays+'天')+'</span></div>'+metricCards(items);
  }
  function sourceComparisonSection(siteId){
    var c = ((payload.site_monitoring || {}).source_comparison || {})[siteId] || {};
    var fp = c.first_party || {}, cf = c.cloudflare || {}, ga = c.google_analytics || {};
    function pct(source, base){
      if (source == null || source === '' || isNaN(Number(source))) return 'n/a';
      if (!base) return source ? 'n/a' : '0%';
      var v = Math.round((Number(source || 0) - Number(base || 0)) / Number(base) * 100);
      return (v > 0 ? '+' : '') + v + '%';
    }
    function cls(text){return /^[-+]?\\d+%$/.test(text) && Math.abs(parseInt(text,10)) > 20 ? 'alert' : '';}
    var cfValue = (cf.status === 'ok' || cf.status === 'empty') ? (cf.pageviews || cf.requests) : null;
    var gaValue = (ga.status === 'ok' || ga.status === 'empty') ? ga.pageviews : null;
    var cfDiff = pct(cfValue, fp.pageviews);
    var gaDiff = pct(gaValue, fp.pageviews);
    return '<section class="card"><strong>口径对照</strong><table class="table"><thead><tr><th>来源</th><th>PV/请求</th><th>UV/用户</th><th>Session</th><th>与自建PV差异</th><th>状态</th></tr></thead><tbody>'+
      '<tr><td>自建埋点</td><td>'+n(fp.pageviews)+'</td><td>'+n(fp.visitors)+'</td><td>'+n(fp.sessions)+'</td><td>标准</td><td>ok</td></tr>'+
      '<tr><td>Cloudflare</td><td>'+(cfValue == null ? 'n/a' : n(cfValue))+'</td><td>'+(cfValue == null ? 'n/a' : n(cf.visitors))+'</td><td></td><td class="'+cls(cfDiff)+'">'+esc(cfDiff)+'</td><td title="'+esc(cf.reason || '')+'">'+esc(cf.status || '')+'</td></tr>'+
      '<tr><td>GA4</td><td>'+(gaValue == null ? 'n/a' : n(gaValue))+'</td><td>'+(gaValue == null ? 'n/a' : n(ga.users))+'</td><td>'+(gaValue == null ? 'n/a' : n(ga.sessions))+'</td><td class="'+cls(gaDiff)+'">'+esc(gaDiff)+'</td><td title="'+esc(ga.reason || '')+'">'+esc(ga.status || '')+'</td></tr>'+
      '</tbody></table></section>';
  }
  function rowsFrom(items, cols, empty){
    if (!items || !items.length) return '<tr><td colspan="'+cols.length+'" class="muted">'+esc(empty || '暂无数据')+'</td></tr>';
    return items.map(function(r){return '<tr>'+cols.map(function(c){
      var raw = c.f ? c.f(r) : r[c.k];
      var text = raw == null ? '' : String(raw);
      return '<td'+(c.cls ? ' class="'+esc(c.cls)+'"' : '')+(text ? ' title="'+esc(text)+'"' : '')+'>'+esc(text)+'</td>';
    }).join('')+'</tr>';}).join('');
  }
  function prioritizeJournalBusiness(siteId){
    if (siteId !== 'journal') return;
    var grid = app.querySelector('.detail-grid');
    if (!grid) return;
    var cards = Array.prototype.slice.call(grid.children || []);
    [
      [0, 'priority-main'],
      [4, 'priority-main'],
      [10, 'priority-search'],
      [11, 'priority-search'],
      [12, 'priority-search']
    ].forEach(function(item){
      var card = cards[item[0]];
      if (!card) return;
      card.classList.add(item[1]);
      var scroller = card.querySelector('.scroll.tall');
      if (scroller) scroller.classList.add('wide');
    });
  }
  function showChartDetail(el){
    var rows = [];
    try { rows = JSON.parse(el.getAttribute('data-chart-rows') || '[]'); } catch(e) {}
    if (!rows.length) return;
    var cols = Object.keys(rows[0] || {});
    var modal = document.getElementById('chartModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'chartModal';
      document.body.appendChild(modal);
    }
    modal.innerHTML = '<div class="modal-backdrop" data-close-modal="1"><div class="modal-panel" role="dialog" aria-modal="true">'+
      '<div class="modal-head"><strong>'+esc(el.getAttribute('data-chart-title') || '图表明细')+'</strong><button data-close-modal="1">关闭</button></div>'+
      '<div class="modal-body"><table class="table"><thead><tr>'+cols.map(function(c){return '<th>'+esc(c)+'</th>';}).join('')+'</tr></thead><tbody>'+
      rows.map(function(r){return '<tr>'+cols.map(function(c){var text = r[c] == null ? '' : String(r[c]); return '<td title="'+esc(text)+'">'+esc(text)+'</td>';}).join('')+'</tr>';}).join('')+
      '</tbody></table></div></div></div>';
    modal.querySelector('.modal-backdrop').onclick = function(e){ if (e.target.getAttribute('data-close-modal')) modal.innerHTML = ''; };
  }
  function attachChartDetails(){
    Array.prototype.forEach.call(document.querySelectorAll('[data-chart-rows]'), function(el){
      el.onclick = function(){ showChartDetail(el); };
      el.onkeydown = function(e){
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showChartDetail(el); }
      };
    });
  }
  function journalLabel(r){
    var name = r.journal_title || r.journal_name || r.title || r.label || '';
    if (!name) name = r.issn || r.eissn || r.journal_issn || r.journal_key || '';
    var ids = [r.issn, r.eissn].filter(Boolean).join(' / ');
    return ids && ids !== name ? name + ' (' + ids + ')' : name;
  }
  function userLabel(u){
    if(!u) return '';
    return u.name||u.login||u.email||(u.visitor_id?'访客 '+String(u.visitor_id).slice(0,8):'')||(u.id?'用户 '+u.id:'')||'anonymous';
  }
  function visitorLabel(r){
    return userLabel(r.user) || (r.visitor_id ? '访客 '+String(r.visitor_id).slice(0,8) : 'anonymous');
  }
  function moneyCny(v){
    var x = Number(v || 0);
    if (!isFinite(x) || !x) return '¥0.0000';
    return '¥' + x.toFixed(x < 0.01 ? 6 : 4);
  }
  function tokenShort(v){
    var x = Number(v || 0);
    if (!isFinite(x) || !x) return '0';
    if (x >= 1000000) return (x / 1000000).toFixed(2) + 'M';
    if (x >= 1000) return (x / 1000).toFixed(1) + 'k';
    return n(x);
  }
  function miniTable(title, rows, nameKey, metricKey, metricLabel){
    return '<section class="card"><strong>'+esc(title)+'</strong><table class="table"><thead><tr><th>维度</th><th>'+esc(metricLabel || 'PV')+'</th><th>用户/访客</th></tr></thead><tbody>'+
      rowsFrom((rows || []).slice(0,12), [
        {f:function(r){return r[nameKey] || r.path || '(not set)';},cls:'path-cell'},
        {f:function(r){return n(r[metricKey || 'pageviews'] || r.requests);}},
        {f:function(r){return n(r.users || r.visitors || r.pageviews || 0);}}
      ])+'</tbody></table></section>';
  }
  function externalDetailsSection(cf, ga){
    var cfReason = cf && (cf.reason || cf.detail_reason);
    var gaReason = ga && ga.reason;
    return '<div class="section-title">外部口径详情</div>'+
      '<div class="detail-grid three">'+
        miniTable('Cloudflare 国家/地区', (cf || {}).topCountries, 'country', 'requests', '请求')+
        miniTable('Cloudflare 设备类型', (cf || {}).devices, 'device', 'requests', '请求')+
        miniTable('Cloudflare 热门路径', (cf || {}).topPaths, 'path', 'requests', '请求')+
        miniTable('Cloudflare 资源请求', (cf || {}).topResourcePaths, 'path', 'requests', '请求')+
      '</div>'+
      ((cf && cf.filter_note) ? '<div class="muted">'+esc(cf.filter_note)+'；资源请求总量：'+n((cf.totals || {}).resource_requests || 0)+'</div>' : '')+
      (cfReason ? '<div class="muted">Cloudflare：'+esc(cfReason)+'</div>' : '')+
      '<div class="detail-grid three">'+
        miniTable('GA 国家', (ga || {}).topCountries, 'country', 'users', '用户')+
        miniTable('GA 地区', (ga || {}).topRegions, 'region', 'users', '用户')+
        miniTable('GA 城市', (ga || {}).topCities, 'city', 'users', '用户')+
        miniTable('GA 设备', (ga || {}).devices, 'device', 'users', '用户')+
        miniTable('GA 浏览器', (ga || {}).browsers, 'browser', 'users', '用户')+
        miniTable('GA 操作系统', (ga || {}).operatingSystems, 'os', 'users', '用户')+
        miniTable('GA 来源媒介', (ga || {}).sourceMediums, 'source_medium', 'sessions', '会话')+
        miniTable('GA 默认渠道', (ga || {}).channels, 'channel', 'sessions', '会话')+
        miniTable('GA 热门页面', (ga || {}).topPages, 'path', 'pageviews', 'PV')+
      '</div>'+
      (gaReason ? '<div class="muted">Google Analytics：'+esc(gaReason)+'</div>' : '');
  }
  function journalBusinessSection(jb){
    if (!jb || jb.status !== 'ok') return '<section class="card"><strong>业务明细</strong><p class="muted">'+esc((jb && jb.reason) || '当前站点暂无业务明细。')+'</p></section>';
    var k = jb.kpis || {}; var t = jb.tables || {};
    var cards = metricCards([
      ['注册用户', k.total_users],['登录事件', k.total_login_events],
      ['期刊浏览', k.total_journal_views],['搜索期刊', k.search_events],
      ['荐刊运行', k.pick_events],['荐刊扣次', k.pick_consumed],
      ['AI 请求', k.ai_requests],['AI Token', tokenShort(k.ai_total_tokens)],['AI 费用', moneyCny(k.ai_total_cny)],
      ['收藏记录', k.favorite_rows],['收藏清单', k.lists],['评分记录', k.rating_rows]
    ]);
    var recentViews = (t.recentJournalViews || []).filter(matchesTraffic).slice(0,50);
    var journalTrend = '<section class="card priority-main" data-journal-trend-card><div class="source-title"><strong>所有期刊浏览量趋势</strong>'+periodToggle()+'</div>'+
      '<div data-journal-trend-body>'+journalTrendBody(k, t.jvHourlySeries || [])+'</div></section>';
    return '<div class="section-title">Journal 业务明细 <span class="pill">'+esc(trafficLabel(activeTraffic))+'</span></div>'+trafficControls()+cards+
      '<div class="detail-grid">'+journalTrend+
        '<section class="card"><strong>最近注册用户</strong><table class="table"><thead><tr><th>时间</th><th>方式</th><th>用户</th><th>邮箱</th></tr></thead><tbody>'+
          rowsFrom((t.recentUsers || []).slice(0,18), [
            {f:function(r){return secTs(r.created_at);}},{k:'provider'},
            {f:function(r){return r.name||r.login||('#'+r.id);}},{k:'email'}
          ])+'</tbody></table></section>'+
        '<section class="card"><strong>近周期热门期刊浏览量</strong><table class="table"><thead><tr><th>期刊</th><th>浏览</th><th>更新时间</th></tr></thead><tbody>'+
          rowsFrom((t.periodTopJournalViews || t.topJournalViews || []).slice(0,18), [
            {f:journalLabel,cls:'path-cell'},{f:function(r){return n(r.views);}},{f:function(r){return secTs(r.updated_at || r.latest_viewed);}}
          ])+'</tbody></table></section>'+
        '<section class="card"><strong>期刊打开来源</strong><table class="table"><thead><tr><th>来源</th><th>入口</th><th>浏览</th><th>访客</th></tr></thead><tbody>'+
          rowsFrom((t.jvSourceSummary || []).slice(0,18), [
            {k:'view_source'},{k:'tab'},{f:function(r){return n(r.views);}},{f:function(r){return n(r.visitors);}}
          ])+'</tbody></table></section>'+
        '<section class="card"><strong>最近 50 条期刊浏览记录</strong><div class="scroll tall"><table class="table"><thead><tr><th>时间</th><th>期刊</th><th>用户/访客</th><th>打开来源</th><th>搜索词</th><th>路径</th><th>来源页</th><th>设备</th><th>浏览器</th><th>国家</th><th>IP哈希</th><th>类型</th><th>原因</th></tr></thead><tbody>'+
          rowsFrom(recentViews, [
            {f:function(r){return secTs(r.event_time || r.viewed_at);}},{f:journalLabel,cls:'path-cell'},
            {f:visitorLabel},
            {k:'view_source'},{k:'query',cls:'path-cell'},
            {k:'path',cls:'path-cell'},{k:'referrer',cls:'path-cell'},{k:'device'},{k:'browser'},{k:'country'},
            {f:function(r){return r.ip_hash ? String(r.ip_hash).slice(0,12) : '';}},
            {k:'traffic_type'},{k:'bot_reason',cls:'path-cell'}
          ])+'</tbody></table></div></section>'+
        '<section class="card"><strong>分期刊收藏量</strong><table class="table"><thead><tr><th>期刊</th><th>收藏</th></tr></thead><tbody>'+
          rowsFrom((t.topFavorites || []).slice(0,18), [{f:journalLabel,cls:'path-cell'},{f:function(r){return n(r.favorites);}}])+'</tbody></table></section>'+
        '<section class="card"><strong>评分分布</strong><table class="table"><thead><tr><th>期刊</th><th>评分数</th><th>均分</th></tr></thead><tbody>'+
          rowsFrom((t.topRated || []).slice(0,18), [{f:journalLabel,cls:'path-cell'},{f:function(r){return n(r.ratings);}},{k:'avg_rating'}])+'</tbody></table></section>'+
        '<section class="card"><strong>最近收藏</strong><table class="table"><thead><tr><th>时间</th><th>期刊</th><th>用户</th></tr></thead><tbody>'+
          rowsFrom((t.recentFavorites || []).slice(0,18), [{f:function(r){return secTs(r.created_at);}},{f:journalLabel,cls:'path-cell'},{f:function(r){return userLabel(r.user);}}])+'</tbody></table></section>'+
        '<section class="card"><strong>最近评分记录</strong><table class="table"><thead><tr><th>时间</th><th>期刊</th><th>评分</th><th>用户</th></tr></thead><tbody>'+
          rowsFrom((t.recentRatings || []).slice(0,18), [
            {f:function(r){return secTs(r.updated_at||r.created_at);}},{f:journalLabel,cls:'path-cell'},{f:function(r){return r.rating;}},{f:function(r){return userLabel(r.user);}}
          ])+'</tbody></table></section>'+
        '<section class="card"><strong>收藏清单</strong><table class="table"><thead><tr><th>更新时间</th><th>清单</th><th>条目</th><th>用户</th></tr></thead><tbody>'+
          rowsFrom((t.topLists || []).slice(0,18), [{f:function(r){return secTs(r.updated_at);}},{k:'name'},{f:function(r){return n(r.items);}},{f:function(r){return userLabel(r.user);}}])+'</tbody></table></section>'+
        '<section class="card"><strong>搜索 / 荐刊概览</strong><table class="table"><thead><tr><th>类型</th><th>次数</th><th>访客</th><th>会话</th><th>均结果数</th></tr></thead><tbody>'+
          rowsFrom((t.interactionSummary || []).slice(0,18), [{k:'event_type'},{f:function(r){return n(r.events);}},{f:function(r){return n(r.visitors);}},{f:function(r){return n(r.sessions);}},{k:'avg_results'}])+'</tbody></table></section>'+
        '<section class="card"><strong>按入口统计</strong><table class="table"><thead><tr><th>类型</th><th>入口</th><th>次数</th><th>均结果数</th></tr></thead><tbody>'+
          rowsFrom((t.interactionByTab || []).slice(0,18), [{k:'event_type'},{k:'tab'},{f:function(r){return n(r.events);}},{k:'avg_results'}])+'</tbody></table></section>'+
        '<section class="card"><strong>最近搜索 / 荐刊</strong><table class="table"><thead><tr><th>时间</th><th>类型</th><th>入口</th><th>关键词</th><th>结果</th></tr></thead><tbody>'+
          rowsFrom((t.recentInteractions || []).slice(0,24), [{f:function(r){return secTs(r.event_ts);}},{k:'event_type'},{k:'tab'},{k:'query',cls:'path-cell'},{f:function(r){return r.result_count==null?'':n(r.result_count);}}])+'</tbody></table></section>'+
        '<section class="card"><strong>荐刊扣次（日）</strong><table class="table"><thead><tr><th>日期</th><th>扣次</th><th>用户</th></tr></thead><tbody>'+
          rowsFrom((t.pickUsageByDay || []).slice(-18).reverse(), [{k:'day'},{f:function(r){return n(r.used);}},{f:function(r){return n(r.users);}}])+'</tbody></table></section>'+
        '<section class="card priority-search"><strong>DeepSeek Flash 用量总览</strong><div class="traffic-row">'+
          '<div class="traffic-chip"><span>请求</span><strong>'+n(k.ai_requests)+'</strong><div class="muted">'+n(k.ai_users)+' 用户 · 失败 '+n(k.ai_failed_requests)+'</div></div>'+
          '<div class="traffic-chip"><span>总 Token</span><strong>'+tokenShort(k.ai_total_tokens)+'</strong><div class="muted">输入 '+tokenShort(k.ai_prompt_tokens)+' · 输出 '+tokenShort(k.ai_completion_tokens)+'</div></div>'+
          '<div class="traffic-chip"><span>费用</span><strong>'+moneyCny(k.ai_total_cny)+'</strong><div class="muted">按 DeepSeek 官方 CNY 单价估算</div></div>'+
          '<div class="traffic-chip"><span>平均耗时</span><strong>'+Math.round(Number(k.ai_avg_latency_ms || 0))+' ms</strong><div class="muted">画像解析 + 报告生成</div></div>'+
        '</div></section>'+
        '<section class="card"><strong>AI 按模型统计</strong><table class="table"><thead><tr><th>模型</th><th>请求</th><th>用户</th><th>Token</th><th>费用</th></tr></thead><tbody>'+
          rowsFrom((t.aiUsageByModel || []).slice(0,18), [
            {f:function(r){return (r.provider||'')+' / '+(r.model||'');},cls:'path-cell'},
            {f:function(r){return n(r.requests);}},{f:function(r){return n(r.users);}},
            {f:function(r){return tokenShort(r.total_tokens);}},{f:function(r){return moneyCny(r.total_cny);}}
          ])+'</tbody></table></section>'+
        '<section class="card"><strong>AI 按步骤统计</strong><table class="table"><thead><tr><th>步骤</th><th>请求</th><th>Token</th><th>费用</th><th>平均耗时</th></tr></thead><tbody>'+
          rowsFrom((t.aiUsageByFeature || []).slice(0,18), [
            {k:'feature'},{f:function(r){return n(r.requests);}},
            {f:function(r){return tokenShort(r.total_tokens);}},{f:function(r){return moneyCny(r.total_cny);}},
            {f:function(r){return Math.round(Number(r.avg_latency_ms || 0))+' ms';}}
          ])+'</tbody></table></section>'+
        '<section class="card"><strong>AI 用量（日）</strong><table class="table"><thead><tr><th>日期</th><th>请求</th><th>用户</th><th>Token</th><th>费用</th></tr></thead><tbody>'+
          rowsFrom((t.aiUsageByDay || []).slice(-18).reverse(), [
            {k:'day'},{f:function(r){return n(r.requests);}},{f:function(r){return n(r.users);}},
            {f:function(r){return tokenShort(r.total_tokens);}},{f:function(r){return moneyCny(r.total_cny);}}
          ])+'</tbody></table></section>'+
        '<section class="card"><strong>最近 AI 荐刊调用</strong><div class="scroll tall"><table class="table"><thead><tr><th>时间</th><th>用户</th><th>步骤</th><th>模型</th><th>查询字数</th><th>输入</th><th>输出</th><th>总Token</th><th>费用</th><th>耗时</th><th>状态</th><th>错误</th></tr></thead><tbody>'+
          rowsFrom((t.recentAiUsage || []).slice(0,40), [
            {f:function(r){return secTs(r.created_at);}},{f:function(r){return userLabel(r.user);}},
            {k:'feature'},{f:function(r){return (r.provider||'')+' / '+(r.model||'');},cls:'path-cell'},
            {f:function(r){return n(r.query_chars);}},
            {f:function(r){return tokenShort(r.prompt_tokens);}},
            {f:function(r){return tokenShort(r.completion_tokens);}},
            {f:function(r){return tokenShort(r.total_tokens);}},
            {f:function(r){return moneyCny(r.total_cny);}},
            {f:function(r){return Math.round(Number(r.latency_ms || 0))+' ms';}},
            {f:function(r){return Number(r.success) === 0 ? '失败' : '成功';}},
            {k:'error',cls:'path-cell'}
          ])+'</tbody></table></div></section>'+
      '</div>';
  }
  function grantBusinessSection(gb){
    if (!gb || gb.status !== 'ok') return '<section class="card"><strong>Grant 搜索监测</strong><p class="muted">'+esc((gb && gb.reason) || '当前站点暂无搜索明细。')+'</p></section>';
    var k = gb.kpis || {}; var t = gb.tables || {};
    var cards = metricCards([['搜索次数', k.search_events],['搜索访客', k.search_visitors],['搜索会话', k.search_sessions],['无结果搜索', k.zero_result_searches]]);
    var recentPageviews = (t.recentPageviews || []).filter(matchesTraffic).slice(0,50);
    return '<div class="section-title">Grant 搜索监测 <span class="pill">'+esc(trafficLabel(activeTraffic))+'</span></div>'+trafficControls()+cards+
      '<div class="detail-grid">'+
        '<section class="card"><strong>热门搜索词</strong><table class="table"><thead><tr><th>关键词</th><th>次数</th><th>访客</th><th>均结果数</th></tr></thead><tbody>'+
          rowsFrom((t.topSearchQueries || []).slice(0,20), [{k:'query',cls:'path-cell'},{f:function(r){return n(r.events);}},{f:function(r){return n(r.visitors);}},{k:'avg_results'}])+'</tbody></table></section>'+
        '<section class="card"><strong>无结果搜索词</strong><table class="table"><thead><tr><th>关键词</th><th>次数</th></tr></thead><tbody>'+
          rowsFrom((t.zeroResultSearches || []).slice(0,20), [{k:'query',cls:'path-cell'},{f:function(r){return n(r.events);}}])+'</tbody></table></section>'+
        '<section class="card"><strong>最近搜索</strong><table class="table"><thead><tr><th>时间</th><th>关键词</th><th>结果</th><th>访客</th><th>路径</th></tr></thead><tbody>'+
          rowsFrom((t.recentInteractions || []).slice(0,30), [
            {f:function(r){return secTs(r.event_ts);}},{k:'query',cls:'path-cell'},
            {f:function(r){return r.result_count==null?'':n(r.result_count);}},
            {f:function(r){return r.visitor_id?'匿名访客 '+String(r.visitor_id).slice(-8):'';}},{k:'path',cls:'path-cell'}
          ])+'</tbody></table></section>'+
        '<section class="card"><strong>最近 50 条浏览记录</strong><div class="scroll tall"><table class="table"><thead><tr><th>时间</th><th>访客</th><th>路径</th><th>来源页</th><th>国家</th><th>语言</th><th>IP哈希</th><th>类型</th><th>原因</th></tr></thead><tbody>'+
          rowsFrom(recentPageviews, [
            {f:function(r){return secTs(r.event_ts || r.received_at);}},
            {f:function(r){return r.visitor_id?'访客 '+String(r.visitor_id).slice(0,8):'anonymous';}},
            {k:'path',cls:'path-cell'},
            {k:'referrer',cls:'path-cell'},
            {k:'country'},
            {k:'client_language'},
            {f:function(r){return r.ip_hash ? String(r.ip_hash).slice(0,12) : '';}},
            {k:'traffic_type'},{k:'bot_reason',cls:'path-cell'}
          ])+'</tbody></table></div></section>'+
        '<section class="card"><strong>按日期统计</strong><table class="table"><thead><tr><th>日期</th><th>搜索次数</th></tr></thead><tbody>'+
          rowsFrom((t.interactionByDay || []).slice(-20).reverse(), [{k:'day'},{f:function(r){return n(r.events);}}])+'</tbody></table></section>'+
      '</div>';
  }
  function genericSiteBusinessSection(label, ab){
    if (!ab || (ab.status !== 'ok' && ab.status !== 'empty')) {
      return '<section class="card"><strong>'+esc(label)+' 明细</strong><p class="muted">'+esc((ab && ab.reason) || '当前站点暂无明细。')+'</p></section>';
    }
    var k = ab.kpis || {};
    var t = ab.tables || {};
    var recentPageviews = (t.recentPageviews || []).filter(matchesTraffic).slice(0,50);
    var topPaths = t.topPaths || [];
    var byDay = (t.byDay || []).slice(-20).reverse();
    return '<div class="section-title">'+esc(label)+' 用户与流量 <span class="pill">'+esc(trafficLabel(activeTraffic))+'</span></div>'+trafficControls()+
      metricCards([
        ['真人 PV', k.pageviews || 0],
        ['独立访客', k.visitors || 0],
        ['会话', k.sessions || 0],
        ['账号（统一）', k.total_accounts || 0]
      ].filter(function(it){ return it[0] !== '账号（统一）' || Number(it[1]) > 0; }))+
      '<div class="detail-grid">'+
        '<section class="card"><strong>热门路径</strong><table class="table"><thead><tr><th>路径</th><th>PV</th><th>访客</th></tr></thead><tbody>'+
          rowsFrom(topPaths.slice(0,15), [{k:'path',cls:'path-cell'},{f:function(r){return n(r.pageviews);}},{f:function(r){return n(r.visitors);}}])+
        '</tbody></table></section>'+
        '<section class="card"><strong>按日</strong><table class="table"><thead><tr><th>日期</th><th>PV</th><th>访客</th><th>会话</th></tr></thead><tbody>'+
          rowsFrom(byDay, [{k:'day'},{f:function(r){return n(r.pageviews);}},{f:function(r){return n(r.visitors);}},{f:function(r){return n(r.sessions);}}])+
        '</tbody></table></section>'+
      '</div>'+
      '<section class="card" style="margin-top:12px"><strong>最近访问</strong><div class="scroll tall"><table class="table"><thead><tr><th>时间</th><th>访客</th><th>路径</th><th>来源</th><th>国家</th><th>语言</th><th>类型</th></tr></thead><tbody>'+
        rowsFrom(recentPageviews, [
          {f:function(r){return secTs(r.event_ts || r.received_at);}},
          {f:function(r){return r.visitor_id?'访客 '+String(r.visitor_id).slice(0,8):'anonymous';}},
          {k:'path',cls:'path-cell'},
          {k:'referrer',cls:'path-cell'},
          {k:'country'},
          {k:'client_language'},
          {k:'traffic_type'}
        ])+'</tbody></table></div></section>';
  }
  function ailatestBusinessSection(ab){
    var base = genericSiteBusinessSection('Studio 门户', ab);
    var t = (ab && ab.tables) || {};
    var users = t.recentUsers || [];
    var providers = t.loginProviders || [];
    if (!users.length && !providers.length) return base;
    return base +
      '<div class="section-title">统一账号（全站登录）</div>'+
      metricCards([
        ['注册用户', (ab.kpis && ab.kpis.total_accounts) || users.length || 0],
        ['登录事件', (ab.kpis && ab.kpis.total_login_events) || 0]
      ])+
      '<div class="detail-grid">'+
        '<section class="card"><strong>登录方式</strong><table class="table"><thead><tr><th>Provider</th><th>用户数</th></tr></thead><tbody>'+
          rowsFrom(providers, [{k:'provider'},{f:function(r){return n(r.users);}}])+
        '</tbody></table></section>'+
        '<section class="card"><strong>最近注册</strong><table class="table"><thead><tr><th>ID</th><th>邮箱</th><th>登录名</th><th>方式</th><th>时间</th></tr></thead><tbody>'+
          rowsFrom(users.slice(0,20), [
            {k:'id'},
            {k:'email'},
            {k:'login'},
            {k:'provider'},
            {f:function(r){return secTs(r.created_at);}}
          ])+
        '</tbody></table></section>'+
      '</div>';
  }
  function todoBusinessSection(tb){
    var base = genericSiteBusinessSection('Todo', tb);
    var k = (tb && tb.kpis) || {};
    var remote = (tb && tb.remote) || {};
    var members = (tb && tb.tables && tb.tables.productMembers) || [];
    var extra = '<div class="section-title">Todo 订阅（统一账号 + 远程汇总）</div>'+
      metricCards([
        ['统一库会员行', k.membership_rows || 0],
        ['有效订阅', k.membership_active || remote.active || 0],
        ['Pro', k.membership_pro || 0],
        ['Max', k.membership_max || 0],
        ['Todo 库订阅总数', remote.total || 0]
      ])+
      (remote.status && remote.status !== 'ok'
        ? '<section class="card"><strong>远程 Todo 库</strong><p class="muted">'+esc(remote.reason || remote.status)+'</p><p class="muted">配置 Worker secret <code>ACCOUNT_SYNC_SECRET</code>（与 Journal API 相同）后可自动同步。</p></section>'
        : '')+
      '<section class="card"><strong>最近同步到统一账号的 Todo 会员</strong><table class="table"><thead><tr><th>用户</th><th>档位</th><th>状态</th><th>更新</th></tr></thead><tbody>'+
        rowsFrom(members.slice(0,20), [
          {f:function(r){return r.email || r.login || ('#'+r.user_id);}},
          {k:'plan'},{k:'status'},
          {f:function(r){return secTs(r.updated_at);}}
        ])+
      '</tbody></table></section>';
    return base + extra;
  }
  function businessSection(siteId, business){
    if (siteId === 'journal') return journalBusinessSection(business);
    if (siteId === 'grant') return grantBusinessSection(business);
    if (siteId === 'path') return genericSiteBusinessSection('Path', business);
    if (siteId === 'major') return genericSiteBusinessSection('Major · 知途', business);
    if (siteId === 'todo') return todoBusinessSection(business);
    if (siteId === 'ailatest') return ailatestBusinessSection(business);
    return '<section class="card"><strong>业务明细</strong><p class="muted">'+esc((business && business.reason) || '当前站点暂无业务明细。')+'</p></section>';
  }
  function overview(){
    var sm = payload.site_monitoring || {};
    var sites = sm.sites || [];
    app.className = '';
    app.innerHTML = '<div class="tabs">'+sites.map(function(s){return '<a class="btn" href="'+SITES_BASE+'/'+esc(s.id)+'?days='+activeDays+'">'+esc(s.label)+' · '+esc(s.host)+'</a>';}).join('')+'</div>'+
      '<div class="banner">五个产品站 + Studio 门户已接入。默认统计真人流量；各站可查看访客与路径基础数据。Journal 另含账号/收藏/AI 等业务表。</div>'+
      '<div class="grid">'+sites.map(function(s){
        var fp = (sm.first_party || {})[s.id] || {};
        var mix = fp.traffic_mix || {};
        return '<a class="card" style="text-decoration:none;color:inherit" href="'+SITES_BASE+'/'+esc(s.id)+'?days='+activeDays+'">'+
          '<div class="label">'+esc(s.host)+'</div><h2>'+esc(s.label)+'</h2>'+
          '<div class="metric">'+n((fp.totals || {}).pageviews)+'</div><div class="muted">真人 PV · '+n((fp.totals || {}).visitors)+' 访客 · '+n(mix.ai_agent || 0)+' AI Agent</div></a>';
      }).join('')+'</div>';
  }
  function render(){
    var sm = payload.site_monitoring || {};
    var sites = sm.sites || [];
    if (activeSite === 'overview') return overview();
    var site = sites.find(function(s){return s.id === activeSite;}) || sites[0] || {};
    var fp = (sm.first_party || {})[site.id] || {};
    var cf = ((sm.cloudflare || {}).sites || {})[site.id] || {};
    var ga = ((sm.google_analytics || {}).sites || {})[site.id] || {};
    var tabs = '<a class="btn" href="'+SITES_BASE+'?days='+activeDays+'">总入口</a>'+sites.map(function(s){return '<a class="btn '+(s.id===activeSite?'active':'')+'" href="'+SITES_BASE+'/'+esc(s.id)+'?days='+activeDays+'&traffic='+encodeURIComponent(activeTraffic)+'">'+esc(s.label)+' · '+esc(s.host)+'</a>';}).join('');
    var fpRows = (activeDays === 1 && fp.hourly && fp.hourly.length)
      ? fp.hourly.map(function(r){return { hour: r.hour_start_utc, pageviews:r.pageviews, visitors:r.visitors, sessions:r.sessions };})
      : fp.series || [];
    app.className = '';
    app.innerHTML = '<div class="tabs">'+tabs+'</div><div class="banner">实时数据约延迟 5–15 分钟，昨日数据已校准。当前显示时间会按浏览器本地时区展示；存储与聚合统一使用 UTC。</div>'+
      '<div class="muted">生成时间：'+esc(localTs(payload.generated_at))+'。三种口径分开展示，Cloudflare/GA/第一方不会强行合并。</div>'+
      siteSummaryCards(site, fp, cf, ga)+
      feedAnalyticsSection(site, fp)+
      trafficMixSection(fp)+
      businessSection(site.id, (payload.site_business || {})[site.id])+
      sourceComparisonSection(site.id)+
      sourceCard('第一方埋点（PV 不含站长；含期刊详情浏览）', fp,
        activeDays === 1
          ? seriesRows(fpRows || [], [{k:'hour',f:hourTs},{k:'pageviews',f:n},{k:'visitors',f:n},{k:'sessions',f:n}])
          : seriesRows(fp.series || [], [{k:'day'},{k:'pageviews',f:n},{k:'visitors',f:n},{k:'sessions',f:n}]),
        topRows(fp.topPaths || [], 'pageviews'),
        { chartRows: fpRows, chartX: activeDays === 1 ? 'hour' : 'day', chartY: 'pageviews', chartYLabel:'访问量', chartSeries:[
          {key:'visitors',label:'访客',color:'#2bbf8a'},
          {key:'pageviews',label:'浏览',color:'#6366f1'},
          {key:'sessions',label:'会话',color:'#f59e0b'}
        ] })+
      sourceCard('Cloudflare', cf,
        seriesRows(cf.series || [], [{k:'day'},{k:'requests',f:n},{k:'bytes',f:n},{k:'pageviews',f:n}]),
        topRows(cf.topPaths || [], 'requests'),
        { labels:['页面请求','资源请求','总请求'], keys:['requests','resource_requests','requests'], dateHeads:['日期','页面请求','字节','计数'], topMetricLabel:'请求', chartYLabel:'请求量', chartSeries:[
          {key:'pageviews',label:'页面请求',color:'#2bbf8a'},
          {key:'requests',label:'总请求',color:'#6366f1'}
        ] })+
      sourceCard('Google Analytics', ga,
        seriesRows(ga.series || [], [{k:'day'},{k:'pageviews',f:n},{k:'users',f:n},{k:'sessions',f:n}]),
        topRows(ga.topPages || [], 'pageviews'),
        { labels:['PV','访客','会话'], keys:['pageviews','users','sessions'], chartYLabel:'访问量', chartSeries:[
          {key:'users',label:'用户',color:'#2bbf8a'},
          {key:'pageviews',label:'浏览',color:'#6366f1'},
          {key:'sessions',label:'会话',color:'#f59e0b'}
        ] })+
      externalDetailsSection(cf, ga);
    prioritizeJournalBusiness(site.id);
    attachChartDetails();
    Array.prototype.forEach.call(document.querySelectorAll('[data-site]'), function(btn){
      btn.onclick = function(){ activeSite = btn.getAttribute('data-site'); render(); };
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-traffic]'), function(btn){
      btn.onclick = function(){
        activeTraffic = btn.getAttribute('data-traffic') || 'human';
        var nextUrl = new URL(location.href);
        nextUrl.searchParams.set('traffic', activeTraffic);
        history.replaceState(null, '', nextUrl.pathname + nextUrl.search);
        render();
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-days]'), function(btn){
      btn.onclick = function(){
        var nextDays = Number(btn.getAttribute('data-days')) || 30;
        var trendCard = btn.closest && btn.closest('[data-journal-trend-card]');
        var trafficCard = btn.closest && btn.closest('[data-site-traffic-card]');
        activeDays = nextDays;
        var nextUrl = new URL(location.href);
        nextUrl.searchParams.set('days', String(activeDays));
        history.replaceState(null, '', nextUrl.pathname + nextUrl.search);
        if (trendCard) return loadJournalTrend(trendCard);
        if (trafficCard) return loadSiteTrafficTrend(trafficCard);
        app.className = 'login';
        app.innerHTML = '正在加载'+(activeDays===1?'近24小时':'近'+activeDays+'天')+'数据...';
        load(true);
      };
    });
  }
  async function loadJournalTrend(card){
    var token = localStorage.getItem(TOKEN_KEY);
    var body = card && card.querySelector('[data-journal-trend-body]');
    var toggle = card && card.querySelector('.period-toggle');
    if (!token || !body) return load(true);
    Array.prototype.forEach.call(toggle ? toggle.querySelectorAll('[data-days]') : [], function(btn){
      btn.classList.toggle('active', Number(btn.getAttribute('data-days')) === activeDays);
      btn.disabled = true;
    });
    body.innerHTML = '<div class="chart muted">正在更新图表数据...</div>';
    try {
      var res = await fetch(API + '/analytics/journal-view-trend?days=' + encodeURIComponent(activeDays), { headers: { Authorization: 'Bearer ' + token } });
      if (res.status === 401) { localStorage.removeItem(TOKEN_KEY); return showLogin('登录已失效，请重新登录。'); }
      if (res.status === 403) { localStorage.removeItem(TOKEN_KEY); return showLogin('当前账号无权限。'); }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      var jb = ((payload.site_business || {}).journal || {});
      jb.kpis = Object.assign({}, jb.kpis || {}, data.kpis || {});
      jb.tables = Object.assign({}, jb.tables || {}, { jvHourlySeries: data.series || [] });
      payload.site_business.journal = jb;
      body.innerHTML = journalTrendBody(jb.kpis, jb.tables.jvHourlySeries || []);
      attachChartDetails();
    } catch (e) {
      body.innerHTML = '<div class="chart muted alert">图表数据更新失败：'+esc(e.message||e)+'</div>';
    } finally {
      Array.prototype.forEach.call(toggle ? toggle.querySelectorAll('[data-days]') : [], function(btn){
        btn.disabled = false;
      });
    }
  }
  async function loadSiteTrafficTrend(card){
    var token = localStorage.getItem(TOKEN_KEY);
    var body = card && card.querySelector('[data-site-traffic-body]');
    var toggle = card && card.querySelector('.period-toggle');
    var siteId = card && card.getAttribute('data-site-id');
    if (!token || !body || !siteId) return load(true);
    Array.prototype.forEach.call(toggle ? toggle.querySelectorAll('[data-days]') : [], function(btn){
      btn.classList.toggle('active', Number(btn.getAttribute('data-days')) === activeDays);
      btn.disabled = true;
    });
    body.innerHTML = '<div class="chart muted">正在更新图表数据...</div>';
    try {
      var res = await fetch(API + '/analytics/site-traffic-trend?site=' + encodeURIComponent(siteId) + '&days=' + encodeURIComponent(activeDays), { headers: { Authorization: 'Bearer ' + token } });
      if (res.status === 401) { localStorage.removeItem(TOKEN_KEY); return showLogin('登录已失效，请重新登录。'); }
      if (res.status === 403) { localStorage.removeItem(TOKEN_KEY); return showLogin('当前账号无权限。'); }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      var sm = payload.site_monitoring || {};
      var sites = sm.sites || [];
      var site = sites.find(function(s){return s.id === siteId;}) || {id:siteId,label:siteId};
      sm.first_party = sm.first_party || {};
      sm.first_party[siteId] = data.first_party || {};
      payload.site_monitoring = sm;
      body.innerHTML = feedAnalyticsBody(site, sm.first_party[siteId] || {});
      attachChartDetails();
    } catch (e) {
      body.innerHTML = '<div class="chart muted alert">图表数据更新失败：'+esc(e.message||e)+'</div>';
    } finally {
      Array.prototype.forEach.call(toggle ? toggle.querySelectorAll('[data-days]') : [], function(btn){
        btn.disabled = false;
      });
    }
  }
  function showLogin(msg){
    logout.style.display = 'none';
    var redirect = location.origin + location.pathname;
    app.className = 'login';
    app.innerHTML = '<strong>需要 jiantaoweng@gmail.com 登录</strong><p class="muted">'+esc(msg||'其他账号会返回 403。')+'</p><a class="btn" href="'+API+'/auth/google?analytics=1&redirect='+encodeURIComponent(redirect)+'">用 Google 登录并连接 GA4</a>';
  }
  async function load(skipToken){
    var url = new URL(location.href);
    var token = url.searchParams.get('token');
    if (!skipToken && token) {
      localStorage.setItem(TOKEN_KEY, token);
      url.searchParams.delete('token');
      history.replaceState(null, '', url.pathname + url.search);
    }
    token = localStorage.getItem(TOKEN_KEY);
    if (!token) return showLogin();
    logout.style.display = 'inline-flex';
    try {
      var res = await fetch(API + '/analytics/dashboard?days=' + encodeURIComponent(activeDays) + '&nocache=1', { headers: { Authorization: 'Bearer ' + token } });
      if (res.status === 401) { localStorage.removeItem(TOKEN_KEY); return showLogin('登录已失效，请重新登录。'); }
      if (res.status === 403) { localStorage.removeItem(TOKEN_KEY); return showLogin('当前账号无权限。'); }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      payload = await res.json();
      render();
    } catch (e) {
      app.className = 'error';
      app.innerHTML = '<strong>看板读取失败</strong><p class="muted">'+esc(e.message||e)+'</p>';
    }
  }
  logout.onclick = function(){ localStorage.removeItem(TOKEN_KEY); showLogin('已退出。'); };
  load();
})();
</script>
</body>
</html>`;
}
