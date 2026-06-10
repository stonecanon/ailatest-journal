// Smoke test for js/pick-match.js — run: node scripts/test-pick-match.js
const PM = require('../js/pick-match.js');

const stems = ['economy', 'economics', 'economic', 'transportation', 'transport',
  'geography', 'geographic', 'geographical', 'cities', 'city', 'networks', 'network',
  'studies', 'study', 'sciences', 'science', 'urban', 'planning'];
console.log('── stems ──');
for (const w of stems) console.log(`  ${w} → ${PM.stemLite(w)}`);

const title = "China's Low-Altitude Economy Network: A Study on Structural Characteristics and Formation Mechanisms";
const profile = PM.buildLocalProfile(title);
console.log('\n── profile for low-altitude economy title ──');
console.log('minStrong:', profile.minStrong);
for (const t of profile.terms) {
  console.log(`  [w=${t.weight}]${t.ambiguous ? ' AMBIG' : ''}${t.phrase ? ' PHRASE' : ''}${t.explicit ? ' KW' : ''} ${t.term}`);
}

// Mini journal fixtures: a CS-networks journal must lose to econ/geog/transport.
const fixtures = [
  { name: 'Computer Networks', wos_categories: ['Computer Science, Information Systems', 'Telecommunications'], indices: ['SCIE'] },
  { name: 'Ad Hoc Networks', wos_categories: ['Computer Science, Information Systems', 'Telecommunications'], indices: ['SCIE'] },
  { name: 'Journal of Transport Geography', wos_categories: ['Economics', 'Geography', 'Transportation'], indices: ['SSCI'] },
  { name: 'Regional Studies', wos_categories: ['Economics', 'Environmental Studies', 'Geography', 'Regional & Urban Planning'], indices: ['SSCI'] },
  { name: 'Journal of Economic Geography', wos_categories: ['Economics', 'Geography'], indices: ['SSCI'] },
  { name: 'Transportation Research Part A: Policy and Practice', wos_categories: ['Economics', 'Transportation', 'Transportation Science & Technology'], indices: ['SSCI', 'SCIE'] },
  { name: 'IEEE Transactions on Wireless Communications', wos_categories: ['Engineering, Electrical & Electronic', 'Telecommunications'], indices: ['SCIE'] },
  { name: 'Social Networks', wos_categories: ['Anthropology', 'Sociology'], indices: ['SSCI'] },
  { name: 'Cities', wos_categories: ['Urban Studies'], indices: ['SSCI'] },
  { name: 'Papers in Regional Science', wos_categories: ['Economics', 'Environmental Studies', 'Geography', 'Regional & Urban Planning'], indices: ['SSCI'] },
];
const topicsByName = {
  'Computer Networks': ['Network Coding and Data Transmission', 'Mobile Ad Hoc Networks', 'Wireless Networks'],
  'Ad Hoc Networks': ['Mobile Ad Hoc Networks', 'Wireless Sensor Networks'],
  'Journal of Transport Geography': ['Transport and Urban Planning', 'Regional Development', 'Air Transport and Airports'],
  'Regional Studies': ['Regional Development and Policy', 'Economic Geography', 'Urban and Regional Studies'],
  'Journal of Economic Geography': ['Economic Geography', 'Regional Development', 'Innovation and Knowledge'],
  'Transportation Research Part A: Policy and Practice': ['Transport Policy', 'Travel Behavior', 'Aviation and Airline Economics'],
  'IEEE Transactions on Wireless Communications': ['Wireless Communication Systems', 'Signal Processing'],
  'Social Networks': ['Social Network Analysis', 'Sociometry'],
  'Cities': ['Urban Studies', 'Urban Planning and Development'],
  'Papers in Regional Science': ['Regional Science', 'Spatial Economics'],
};

console.log('\n── ranking (CS journals should rank at the bottom / be excluded) ──');
const rows = fixtures.map(r => {
  const res = PM.scoreLocal(r, profile, topicsByName[r.name] || []);
  return { name: r.name, ...res, pass: PM.passesLocalThreshold(res, profile) };
}).sort((a, b) => b.score - a.score);
for (const r of rows) {
  console.log(`  ${r.pass ? '✓' : '✗'} ${r.score.toFixed(1).padStart(7)}  strong=${r.strong}  ${r.name}  [${r.matched.join(', ')}]`);
}

// A second sanity case from a different field, to make sure nothing is overfit.
const title2 = 'Deep learning based tumor segmentation in multimodal MRI images';
const p2 = PM.buildLocalProfile(title2);
console.log('\n── profile for tumor/MRI title ──');
for (const t of p2.terms) console.log(`  [w=${t.weight}]${t.ambiguous ? ' AMBIG' : ''}${t.phrase ? ' PHRASE' : ''} ${t.term}`);
const med = [
  { name: 'Medical Image Analysis', wos_categories: ['Computer Science, Artificial Intelligence', 'Radiology, Nuclear Medicine & Medical Imaging'] },
  { name: 'Journal of Transport Geography', wos_categories: ['Economics', 'Geography', 'Transportation'] },
  { name: 'Cancers', wos_categories: ['Oncology'] },
];
for (const r of med) {
  const res = PM.scoreLocal(r, p2, []);
  console.log(`  ${PM.passesLocalThreshold(res, p2) ? '✓' : '✗'} ${res.score.toFixed(1).padStart(7)}  ${r.name}  [${res.matched.join(', ')}]`);
}
