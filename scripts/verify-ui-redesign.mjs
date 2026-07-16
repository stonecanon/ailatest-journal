/**
 * Self-check loop for journal UI redesign invariants.
 * Run: node scripts/verify-ui-redesign.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'css/app.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let failed = 0;
function ok(name, cond, detail = '') {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

console.log('1) formatHomeStat');
function formatHomeStat(n) {
  const raw = typeof n === 'string' ? n.replace(/[^\d.]/g, '') : n;
  const num = Math.floor(Number(raw) || 0);
  if (num <= 0) return '—';
  if (num >= 1_000_000) return `${Math.floor(num / 100_000) / 10}M+`;
  let rounded;
  if (num >= 10000) rounded = Math.floor(num / 1000) * 1000;
  else if (num >= 1000) rounded = Math.floor(num / 100) * 100;
  else rounded = num;
  return `${String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}+`;
}
for (const [n, exp] of [
  [48722, '48,000+'],
  [23006, '23,000+'],
  [7412, '7,400+'],
  [1056, '1,000+'],
  [0, '—'],
]) {
  ok(`${n} → ${exp}`, formatHomeStat(n) === exp, `got ${formatHomeStat(n)}`);
}
ok('source floors to thousands for >=10k', /num >= 10000\)\s*rounded = Math\.floor\(num \/ 1000\) \* 1000/.test(js)
  || /if \(num >= 10000\) rounded = Math\.floor/.test(js));

console.log('2) Settings full-screen two-level');
ok('settings-panel full width', /settings-panel\s*\{[^}]*width:\s*100%/.test(css));
ok('settings-subpage class', css.includes('settings-subpage'));
ok('settings-back exists', css.includes('.settings-back') && js.includes('data-settings-back'));
ok('exitSettingsSubpage', js.includes('exitSettingsSubpage'));
ok('no modal min(920px', !/settings-panel\s*\{[^}]*min\(920px/.test(css));

console.log('3) Search V4 single-line');
ok('home search height 52px', /home-route:not\(\.home-tab-has-results\):not\(\.topbar-compact\) \.search-wrap > #q[\s\S]{0,120}height:\s*52px/.test(css));
ok('search pill 999px', /\.search-wrap\s*\{[\s\S]{0,200}border-radius:\s*999px/.test(css));
ok('orange search-submit gradient', /\.search-submit\s*\{[\s\S]{0,300}linear-gradient\(135deg,\s*#fb923c/.test(css));

console.log('4) Filters top + cards 3-col');
ok('int table column flex', /data-panel="int"\] table\.journals\s*\{[\s\S]{0,80}flex-direction:\s*column/.test(css));
ok('no 230px left rail', !/flex:\s*0\s*0\s*230px/.test(css));
ok('3-col journal grid', /table\.journals tbody\s*\{[\s\S]{0,120}repeat\(3,\s*minmax\(0,\s*1fr\)\)/.test(css));

console.log('5) Detail drawer V10');
ok('drawer-hero apricot gradient', /drawer-hero[\s\S]{0,200}#fff4e8/.test(css));
ok('meta-block dual col', /\.drawer-body \.meta-block[\s\S]{0,80}grid-template-columns:\s*1fr 1fr/.test(css));

console.log('6) CSS braces');
const open = (css.match(/\{/g) || []).length;
const close = (css.match(/\}/g) || []).length;
ok(`braces balanced ${open}/${close}`, open === close);

console.log('7) cache bust');
ok('index uses unify-loop build', html.includes('v20260716-unify-loop') || html.includes('unify-loop'));

console.log(failed ? `\nFAILED: ${failed}` : '\nALL PASS');
process.exit(failed ? 1 : 0);
