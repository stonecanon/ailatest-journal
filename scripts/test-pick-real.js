// Full-data test for the local matcher: rank the real journal DB for sample titles.
// Run: node scripts/test-pick-real.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const PM = require('../js/pick-match.js');

const root = path.join(__dirname, '..');
const journals = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, 'data', 'journals.json.gz'))).toString('utf8'));
const oaMap = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, 'data', 'oa.json.gz'))).toString('utf8'));
console.log(`journals: ${journals.length}, oaMap keys: ${Object.keys(oaMap).length}`);

function topicsFor(r) {
  const out = new Set();
  for (const k of [r.issn, r.eissn].filter(Boolean).map(x => String(x).toUpperCase())) {
    const rec = oaMap[k];
    if (rec) (rec.tp || []).forEach(t => out.add(t));
  }
  return [...out];
}

function run(title, topN = 15) {
  console.log(`\n══ ${title}`);
  const t0 = Date.now();
  const profile = PM.buildLocalProfile(title);
  console.log('terms:', profile.terms.map(t => `${t.term}${t.ambiguous ? '(amb)' : ''}${t.phrase ? '(ph)' : ''}[${t.weight}]`).join(', '));
  const rows = [];
  for (const r of journals) {
    const res = PM.scoreLocal(r, profile, topicsFor(r));
    if (!PM.passesLocalThreshold(res, profile)) continue;
    let score = res.score;
    const idx = r.indices || [];
    if (idx.includes('SCIE') || idx.includes('SSCI') || idx.includes('AHCI') || idx.includes('ESCI')) score *= 1.10;
    if (r.cas_zone === 1 || r.if_quartile === 'Q1') score *= 1.06;
    if (r.warning || r.citic_warning || r.on_hold || r.under_review) score *= 0.72;
    rows.push({ r, score, matched: res.matched });
  }
  rows.sort((a, b) => b.score - a.score || (b.r.if_2024 || 0) - (a.r.if_2024 || 0));
  console.log(`candidates: ${rows.length}, took ${Date.now() - t0}ms`);
  for (const { r, score, matched } of rows.slice(0, topN)) {
    const meta = [r.if_2024 != null ? `IF ${r.if_2024}` : '', r.if_quartile, r.cas_zone ? `CAS${r.cas_zone}` : '', (r.indices || []).join('/')].filter(Boolean).join(' ');
    console.log(`  ${score.toFixed(1).padStart(7)}  ${r.name}  (${meta})  [${matched.slice(0, 6).join(', ')}]`);
  }
}

run("China's Low-Altitude Economy Network: A Study on Structural Characteristics and Formation Mechanisms");
run('Deep learning based tumor segmentation in multimodal MRI images');
run('Effects of biochar amendment on soil nitrogen cycling and crop yield in paddy fields');
run('Teacher emotional labor and student engagement in online classrooms');
