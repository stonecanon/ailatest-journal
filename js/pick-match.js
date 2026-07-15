/**
 * pick-match — shared journal-matching primitives for the "荐刊" feature.
 *
 * Used by both the browser (window.PickMatch, classic script) and the
 * Cloudflare Worker (bundled via import). Keep it dependency-free.
 *
 * Core ideas:
 *  - light stemming so economy/economic/economics all land on the same root
 *  - phrase (bigram) terms from the title rank above single words
 *  - ambiguous words (network/system/model/...) only match subject categories,
 *    and only when corroborated by at least one unambiguous hit
 *  - method/process words (analysis/mechanism/structure/...) never score
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PickMatch = factory();
}(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  // ── normalization & stemming ──

  function norm(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9一-鿿]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function hasCjk(s) { return /[一-鿿]/.test(s); }

  // Light, self-consistent stemmer: the same transform runs on both query and
  // journal text, so linguistic correctness matters less than stability.
  var SUFFIXES = ['izations', 'isations', 'ization', 'isation', 'ologies', 'ology',
    'ically', 'ations', 'ation', 'ities', 'ical', 'ies', 'ics', 'ial', 'ity',
    'ing', 'ic', 'es', 'ed', 'e', 's', 'y', 'al'];

  function stemLite(word) {
    var w = String(word || '').toLowerCase();
    if (hasCjk(w)) return w;
    for (var pass = 0; pass < 2; pass++) {
      var changed = false;
      if (w.length > 4) {
        if (/ies$/.test(w) && w.length - 3 >= 3) { w = w.slice(0, -3) + 'y'; changed = true; }
        else {
          for (var i = 0; i < SUFFIXES.length; i++) {
            var suf = SUFFIXES[i];
            if (w.length - suf.length >= 4 && w.slice(-suf.length) === suf) {
              w = w.slice(0, -suf.length);
              changed = true;
              break;
            }
          }
        }
      }
      if (!changed) break;
    }
    return w;
  }

  function stemTokens(text) {
    var words = norm(text).split(' ');
    var out = [];
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (!w) continue;
      out.push(hasCjk(w) ? w : stemLite(w));
    }
    return out;
  }

  // ── word lists ──

  var STOP_WORDS = toSet('the and are was for not non into onto from this that with which were have ' +
    'been than also their about study show used using based results method model data paper these between ' +
    'while where after before other there analysis approach process system research above during well such ' +
    'each both more most some very just although however therefore because without within across among ' +
    'through below under over upon could should would may might shall can will does did has had being made ' +
    'make related a an of in on to by at as is it its our we你 你 的 与 和 及 或 在 了 对 是');

  // Method/process/abstract words common to every discipline — never score.
  var GENERIC_TERMS = toSet('evolution evolutionary mechanism mechanisms formation formations spatiotemporal ' +
    'spatial temporal dynamics dynamic analysis analyses framework frameworks model modeling modelling models ' +
    'method methods methodology approach approaches characteristic characteristics influence influences impact ' +
    'impacts effect effects factor factors optimization optimisation simulation simulations evaluation assessment ' +
    'prediction predictions detection classification recognition system systems strategy strategies development ' +
    'application applications research study studies investigation data based response responses behavior ' +
    'behaviour performance structure structural process processes pattern patterns distribution variation ' +
    'variations change changes relationship relationships correlation correlations multi-source multisource ' +
    'role comparative comparison novel improved enhanced hybrid integrated review reviews survey theory ' +
    'theoretical empirical case experimental numerical measurement measurements monitoring estimation ' +
    'historical history significant different important various multiple proposes presents demonstrates ' +
    'investigates examines explores develops describes reports algorithm algorithms feature features accuracy');

  // Words that are real research objects in *some* field but hijack matching
  // when taken alone (e.g. "network" → computer-network journals). They only
  // match subject categories, and only with corroboration from other hits.
  var AMBIGUOUS_TERMS = toSet('network networks system systems model models dynamics evolution china chinese ' +
    'science sciences technology technologies engineering information global international smart digital');

  // research object → field anchors (bridge the literal gap between paper
  // vocabulary and subject-category vocabulary). Generic heuristics only —
  // do not stuff single-field overfit terms here.
  var FIELD_ANCHORS = {
    street: ['urban'], streetscape: ['urban'], streetscapes: ['urban'], vitality: ['urban'],
    walkability: ['urban'], walkable: ['urban'], pedestrian: ['urban', 'transportation'],
    neighborhood: ['urban'], neighbourhood: ['urban'], plaza: ['urban'], placemaking: ['urban'],
    gentrification: ['urban'], zoning: ['urban planning'], sprawl: ['urban'],
    'low-altitude': ['transportation', 'aviation', 'geography'],
    uav: ['transportation', 'aviation', 'remote sensing'], uavs: ['transportation', 'aviation', 'remote sensing'],
    drone: ['transportation', 'aviation'], drones: ['transportation', 'aviation'],
    airspace: ['transportation', 'aviation'], aviation: ['transportation'],
    airline: ['transportation'], airlines: ['transportation'], airport: ['transportation'], airports: ['transportation'],
    logistics: ['transportation', 'management'], freight: ['transportation'], transit: ['transportation', 'urban'],
    economy: ['economics'], economies: ['economics'],
    tourism: ['hospitality', 'geography'], tourist: ['hospitality', 'geography'],
    firm: ['business', 'economics'], firms: ['business', 'economics'],
    entrepreneurship: ['business', 'management'], innovation: ['management', 'economics'],
    tumor: ['oncology', 'cancer'], tumour: ['oncology', 'cancer'], carcinoma: ['oncology'],
    gene: ['genetics'], genome: ['genetics', 'genomics'], protein: ['biochemistry'],
    battery: ['energy'], batteries: ['energy'], photovoltaic: ['energy'],
    catalyst: ['catalysis', 'chemistry'], catalysts: ['catalysis', 'chemistry'],
    soil: ['soil science', 'agronomy'], crop: ['agronomy'], crops: ['agronomy'],
    classroom: ['education'], curriculum: ['education'], teacher: ['education'], teachers: ['education'],
    hospital: ['health care'], nurse: ['nursing'], nurses: ['nursing'], patient: ['clinical', 'medicine'], patients: ['clinical', 'medicine'],
  };

  function toSet(s) {
    var set = {};
    var parts = s.split(/\s+/);
    for (var i = 0; i < parts.length; i++) if (parts[i]) set[parts[i]] = true;
    return set;
  }

  // FIELD_ANCHORS keyed by norm() so hyphenated keys ("low-altitude" → "low altitude") still match.
  var ANCHORS_NORM = (function () {
    var out = {};
    Object.keys(FIELD_ANCHORS).forEach(function (k) {
      out[norm(k)] = FIELD_ANCHORS[k];
    });
    return out;
  })();

  // ── haystacks & hits ──

  // makeHay(textOrParts) → { text, set } reusable matching target.
  function makeHay(parts) {
    var text = norm(Array.isArray(parts) ? parts.filter(Boolean).join(' | ') : parts);
    var set = {};
    var toks = text.split(' ');
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (!t) continue;
      set[hasCjk(t) ? t : stemLite(t)] = true;
    }
    return { text: text, set: set };
  }

  // Term preparation is memoized: hitHay runs millions of times per search
  // (journals × terms × topics), so norm/stem must not be recomputed each call.
  var termCache = {};
  var termCacheSize = 0;
  function prepareTerm(term) {
    var cached = termCache[term];
    if (cached !== undefined) return cached;
    var t = norm(term);
    var prepared = null;
    if (t) {
      if (hasCjk(t)) {
        prepared = { cjk: true, text: t, stems: null };
      } else {
        var stems = [];
        var words = t.split(' ');
        for (var i = 0; i < words.length; i++) {
          var w = words[i];
          if (!w || w.length < 3 || STOP_WORDS[w]) continue;
          stems.push(stemLite(w));
        }
        prepared = stems.length ? { cjk: false, text: t, stems: stems } : null;
      }
    }
    if (termCacheSize > 500) { termCache = {}; termCacheSize = 0; }
    termCache[term] = prepared;
    termCacheSize++;
    return prepared;
  }

  // hitHay(hay, term) → does the (possibly multi-word) term hit this haystack?
  function hitHay(hay, term) {
    if (!hay || !term) return false;
    var p = prepareTerm(term);
    if (!p) return false;
    if (p.cjk) return hay.text.indexOf(p.text) >= 0;
    for (var i = 0; i < p.stems.length; i++) {
      if (!hay.set[p.stems[i]]) return false;
    }
    return true;
  }

  // ── local profile (no AI) ──

  function buildLocalProfile(query) {
    var lines = String(query || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var explicit = [];
    var contentLines = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var m = line.match(/^(keywords?\s*[:：]|关键词\s*[:：]|關鍵詞\s*[:：])(.*)$/i);
      if (m) {
        m[2].split(/[,;，；、\/|]/).forEach(function (k) {
          k = k.trim();
          if (k.length > 2) explicit.push(k);
        });
      } else {
        contentLines.push(line);
      }
    }
    var title = contentLines[0] || '';
    var body = contentLines.slice(1).join(' ');

    var terms = {};   // key → {term, weight, ambiguous, phrase, explicit}
    function addTerm(term, weight, flags) {
      var raw = String(term || '').trim();
      var key = norm(raw);
      if (!key || key.length < 3) return;
      var oneWord = key.indexOf(' ') < 0;
      if (oneWord && (STOP_WORDS[key] || GENERIC_TERMS[key] || /^\d+$/.test(key))) return;
      var ambiguous = oneWord && !!AMBIGUOUS_TERMS[key] && !(flags && (flags.phrase || flags.explicit));
      var prev = terms[key];
      if (prev && prev.weight >= weight) return;
      terms[key] = {
        term: raw,
        weight: weight,
        ambiguous: ambiguous,
        phrase: !!(flags && flags.phrase),
        explicit: !!(flags && flags.explicit),
      };
    }

    explicit.forEach(function (k) { addTerm(k, 5, { explicit: true }); });

    function tokenize(text) {
      return String(text || '').toLowerCase()
        .replace(/[^a-z0-9一-鿿\s-]/g, ' ')
        .split(/\s+/)
        .map(function (w) { return w.replace(/^-+|-+$/g, ''); })
        .filter(function (w) { return w.length > 2 && !STOP_WORDS[w] && !/^\d+$/.test(w) && w.indexOf('http') !== 0; });
    }

    var titleTokens = tokenize(title);
    var bodyTokens = tokenize(body);

    // 中文题名：2–4 字滑窗作领域信号（否则纯中文几乎抽不到 term）
    function addCjkNgrams(text, baseWeight) {
      var pure = String(text || '').replace(/[^\u4e00-\u9fff]/g, '');
      if (pure.length < 2) return;
      var maxN = pure.length >= 8 ? 4 : 3;
      for (var n = 2; n <= maxN; n++) {
        for (var i = 0; i + n <= pure.length && i < 24; i++) {
          var gram = pure.slice(i, i + n);
          // 过短泛词跳过
          if (/^(研究|分析|基于|方法|模型|系统|问题|影响|发展|应用|中国|我国|情况|结果)$/.test(gram)) continue;
          addTerm(gram, baseWeight + (n >= 3 ? 0.6 : 0), { phrase: n >= 3, explicit: false });
        }
      }
    }
    if (hasCjk(title)) addCjkNgrams(title, 3.5);
    if (hasCjk(body)) addCjkNgrams(body.slice(0, 200), 2.2);

    // bigram phrases from the title: strongest signal after explicit keywords
    var phraseCount = 0;
    for (var p = 0; p + 1 < titleTokens.length && phraseCount < 8; p++) {
      var a = titleTokens[p], b = titleTokens[p + 1];
      if (GENERIC_TERMS[a] && GENERIC_TERMS[b]) continue;
      if (hasCjk(a) || hasCjk(b)) continue;
      addTerm(a + ' ' + b, 4, { phrase: true });
      phraseCount++;
    }

    // single words: first title words weigh more
    var order = 0;
    var seen = {};
    titleTokens.concat(bodyTokens).forEach(function (w) {
      if (seen[w]) return;
      seen[w] = true;
      addTerm(w, order++ < 8 ? 3 : 2);
    });

    // anchors: research object → field vocabulary
    Object.keys(terms).forEach(function (key) {
      var anchors = ANCHORS_NORM[key] || ANCHORS_NORM[stemLite(key)];
      if (anchors) anchors.forEach(function (a) { addTerm(a, 2.4); });
    });

    var list = Object.keys(terms).map(function (k) { return terms[k]; });
    list.sort(function (x, y) { return y.weight - x.weight; });
    list = list.slice(0, 28);

    var strongTotal = list.filter(function (t) { return !t.ambiguous; }).length;
    return {
      terms: list,
      minStrong: strongTotal >= 2 ? 2 : 1,
    };
  }

  // ── local scoring against a journal record ──

  var HAY_CACHE_KEY = '__pickMatchHay';

  function journalHays(record, topics) {
    var cached = record[HAY_CACHE_KEY];
    if (cached) return cached;
    var cat = makeHay([
      record.esi_category, record.cas_major_cn, record.cas_major_cat, record.jcr_cat, record.ccf_area,
      record.cnki_major,
    ].concat(record.wos_categories || [], record.jcr_cats || [], record.ei_subjects || []));
    var name = makeHay([record.name, record.cn_name, record.abbr20]);
    var topicHays = (topics || []).map(function (t) { return makeHay(t); });
    var hays = { cat: cat, name: name, topics: topicHays };
    try { Object.defineProperty(record, HAY_CACHE_KEY, { value: hays, enumerable: false, configurable: true }); }
    catch (e) { record[HAY_CACHE_KEY] = hays; }
    return hays;
  }

  function scoreLocal(record, profile, topics) {
    var hays = journalHays(record, topics);
    var score = 0;
    var matched = [];
    var strong = 0;
    var phraseHit = false;
    var explicitHit = false;
    var ambiguousQueue = [];

    for (var i = 0; i < profile.terms.length; i++) {
      var t = profile.terms[i];
      if (t.ambiguous) { ambiguousQueue.push(t); continue; }
      var inCat = hitHay(hays.cat, t.term);
      var topicCount = 0;
      for (var j = 0; j < hays.topics.length; j++) if (hitHay(hays.topics[j], t.term)) topicCount++;
      var inName = hitHay(hays.name, t.term);
      var s = 0;
      if (inCat) s += t.weight * 2.0;                                       // subject category: strongest signal
      if (topicCount) s += t.weight * Math.min(0.25 * topicCount, 1.0);     // topic centrality
      if (!s && inName) s += t.weight * 0.3;                                // name-only: weak, anti-hijack
      if (s > 0) {
        score += s;
        matched.push(t.term);
        strong++;
        if (t.phrase) phraseHit = true;
        if (t.explicit) explicitHit = true;
      }
    }

    // ambiguous words only count with corroboration, and only via categories
    if (strong > 0) {
      for (var k = 0; k < ambiguousQueue.length; k++) {
        var amb = ambiguousQueue[k];
        if (hitHay(hays.cat, amb.term)) {
          score += amb.weight * 1.0;
          matched.push(amb.term);
        }
      }
    }

    // breadth bonus on unambiguous hits only
    score *= (1 + 0.4 * Math.max(0, strong - 1));

    return { score: score, matched: matched, strong: strong, phraseHit: phraseHit, explicitHit: explicitHit };
  }

  function passesLocalThreshold(result, profile) {
    if (!result || result.score <= 0 || !result.matched.length) return false;
    // 提高门槛：至少 2 个无歧义命中，或短语/显式关键词 + 1 个强命中
    if (result.strong >= Math.max(2, profile.minStrong || 1)) return true;
    if (result.strong >= 1 && result.score >= 4.5 && (result.phraseHit || result.explicitHit)) return true;
    return result.strong >= 2;
  }

  return {
    norm: norm,
    stemLite: stemLite,
    stemTokens: stemTokens,
    makeHay: makeHay,
    hitHay: hitHay,
    buildLocalProfile: buildLocalProfile,
    scoreLocal: scoreLocal,
    passesLocalThreshold: passesLocalThreshold,
  };
}));
