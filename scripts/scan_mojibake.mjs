import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const defaultFiles = [
  'index.html',
  'js/app.js',
  'css/app.css',
  'data/journal_updates.json',
];

const fragments = [
  ['replacement character', '\ufffd'],
  ['mojibake quote marker', '\u9225'],
  ['mojibake punctuation marker', '\u951b'],
  ['emoji mojibake marker', '\u9983'],
  ['observed Chinese-title mojibake', '\u5be4\u8679\u74da'],
];

const files = process.argv.slice(2).length ? process.argv.slice(2) : defaultFiles;
const hits = [];

for (const file of files) {
  if (!existsSync(file)) continue;
  const text = await readFile(file, 'utf8');
  for (const [label, fragment] of fragments) {
    let index = text.indexOf(fragment);
    while (index !== -1) {
      const start = Math.max(0, index - 48);
      const end = Math.min(text.length, index + fragment.length + 80);
      hits.push({
        file,
        label,
        index,
        excerpt: text.slice(start, end).replace(/\s+/g, ' '),
      });
      index = text.indexOf(fragment, index + fragment.length);
    }
  }
}

if (hits.length) {
  console.error(`Found ${hits.length} possible mojibake fragment(s):`);
  for (const hit of hits.slice(0, 30)) {
    console.error(`- ${hit.file}: ${hit.label} at ${hit.index}`);
    console.error(`  ${hit.excerpt}`);
  }
  if (hits.length > 30) console.error(`...and ${hits.length - 30} more`);
  process.exit(1);
}

console.log(`No mojibake fragments found in ${files.length} file(s).`);
