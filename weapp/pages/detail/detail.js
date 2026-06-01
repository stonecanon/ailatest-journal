const app = getApp()

const DETAIL_MAP = {
  'applied-energy': {
    slug: 'applied-energy',
    title: 'Applied Energy',
    issn: '0306-2619',
    eissn: '1872-9118',
    publisher: 'Elsevier BV',
    country: 'Netherlands',
    frequency: 'Semimonthly',
    ifText: '11',
    jcr: 'Q1',
    jcrCat: 'ENERGY & FUELS',
    cas: '1区 TOP',
    casMajor: '工程技术大类',
    xinrui: '1区 TOP',
    cnkx: 'T1',
    abdc: 'A',
    ccf: '推荐A',
    oa: 'Hybrid（可选开放获取）',
    apc: '约 4,140 USD',
    reviewCycle: '约 2-3 个月',
    freeText: '免费发表',
    website: 'www.journals.elsevier.com/applied-energy',
    scopusId: '28801',
    publishedWorks: '27,908 篇',
    esiSubject: 'ENGINEERING',
    wosSubjects: ['Energy & Fuels', 'Engineering, Chemical'],
    eiSubjects: ['Energy', 'Renewable Energy, Sustainability and the Environment', 'Civil and Structural Engineering', 'Mechanical Engineering'],
    mainFields: ['Smart Grid Energy Management', 'Building Energy and Comfort Optimization', 'Integrated Energy Systems Optimization', 'Advanced Battery Technologies Research'],
    jcrSubcategories: ['ENERGY & FUELS · Q1', 'ENGINEERING, CHEMICAL · Q1'],
    casSubcategories: ['ENGINEERING, CHEMICAL 工程：化工 · 1区', 'ENERGY & FUELS 能源与燃料 · 2区'],
    pubmed: '未标记',
    pmc: '未标记',
    warning: '无中科院预警记录',
    citicWarning: '无中信所预警记录',
    badges: ['SCIE', 'EI', 'Scopus', 'DOAJ'],
    initials: 'AE',
    logoTone: 'tone-orange',
    overview: 'Applied Energy 是一本面向能源领域研究与应用的国际顶级期刊，发表能源工程、可再生能源、能源系统与技术等方向的高质量研究论文。期刊年发文量较大，审稿流程规范，学术影响力广泛。'
  },
  'energy-environmental-science': {
    slug: 'energy-environmental-science',
    title: 'Energy & Environmental Science',
    issn: '1754-5692',
    eissn: '1754-5706',
    publisher: 'Royal Society of Chemistry',
    country: 'England',
    frequency: 'Monthly',
    ifText: '30.8',
    jcr: 'Q1',
    jcrCat: 'CHEMISTRY, MULTIDISCIPLINARY',
    cas: '1区 TOP',
    casMajor: '材料科学大类',
    xinrui: '1区 TOP',
    cnkx: 'T1',
    abdc: '-',
    ccf: '-',
    oa: 'Hybrid',
    apc: '以官网为准',
    reviewCycle: '约 2.5-3.5 个月',
    freeText: '付费发表',
    website: 'www.rsc.org/journals-books-databases/about-journals/energy-environmental-science',
    scopusId: '-',
    publishedWorks: '-',
    esiSubject: 'CHEMISTRY',
    wosSubjects: ['Chemistry, Multidisciplinary', 'Energy & Fuels', 'Environmental Sciences'],
    eiSubjects: ['Energy', 'Environmental Engineering', 'Renewable Energy'],
    mainFields: ['Energy Conversion', 'Sustainable Materials', 'Environmental Chemistry'],
    jcrSubcategories: ['CHEMISTRY, MULTIDISCIPLINARY · Q1', 'ENERGY & FUELS · Q1'],
    casSubcategories: ['材料科学 · 1区', '能源与燃料 · 1区'],
    pubmed: '未标记',
    pmc: '未标记',
    warning: '无中科院预警记录',
    citicWarning: '无中信所预警记录',
    badges: ['SCIE', 'EI', 'Scopus'],
    initials: 'EES',
    logoTone: 'tone-green',
    overview: 'Energy & Environmental Science 聚焦能源转化、环境科学、可持续材料与化学工程，是能源与环境交叉领域的高影响力期刊。'
  },
  'nano-energy': {
    slug: 'nano-energy',
    title: 'Nano Energy',
    issn: '2211-2855',
    eissn: '2211-3282',
    publisher: 'Elsevier',
    country: 'United States',
    frequency: 'Monthly',
    ifText: '17.1',
    jcr: 'Q1',
    jcrCat: 'CHEMISTRY, PHYSICAL',
    cas: '1区',
    casMajor: '材料科学大类',
    xinrui: '1区 TOP',
    cnkx: 'T1',
    abdc: '-',
    ccf: '-',
    oa: 'Hybrid',
    apc: '以官网为准',
    reviewCycle: '约 1.5-2.5 个月',
    freeText: '付费发表',
    website: 'www.sciencedirect.com/journal/nano-energy',
    scopusId: '-',
    publishedWorks: '-',
    esiSubject: 'MATERIALS SCIENCE',
    wosSubjects: ['Chemistry, Physical', 'Materials Science, Multidisciplinary', 'Nanoscience & Nanotechnology'],
    eiSubjects: ['Nanotechnology', 'Energy', 'Electrical and Electronic Engineering'],
    mainFields: ['Nanomaterials', 'Energy Storage', 'Energy Conversion'],
    jcrSubcategories: ['CHEMISTRY, PHYSICAL · Q1', 'MATERIALS SCIENCE, MULTIDISCIPLINARY · Q1'],
    casSubcategories: ['材料科学 · 1区'],
    pubmed: '未标记',
    pmc: '未标记',
    warning: '无中科院预警记录',
    citicWarning: '无中信所预警记录',
    badges: ['SCIE', 'EI', 'Scopus'],
    initials: 'NE',
    logoTone: 'tone-blue',
    overview: 'Nano Energy 主要发表纳米材料、能源器件、能源转换与存储方向的研究，适合新能源材料与器件相关成果投稿。'
  }
}

function firstValue(row, keys, fallback = '-') {
  for (const key of keys) {
    const value = row && row[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return fallback
}

function asArray(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean).map(v => String(v))
  if (typeof value === 'string') {
    return value.split(/[;；|]/).map(v => v.trim()).filter(Boolean)
  }
  return []
}

const SUBJECT_ZH = {
  'ENERGY & FUELS': '能源与燃料',
  'ENGINEERING, CHEMICAL': '工程：化工',
  'CHEMISTRY, MULTIDISCIPLINARY': '化学：综合',
  'CHEMISTRY, PHYSICAL': '化学：物理',
  'MATERIALS SCIENCE, MULTIDISCIPLINARY': '材料科学：综合',
  'NANOSCIENCE & NANOTECHNOLOGY': '纳米科学与纳米技术',
  'ENVIRONMENTAL SCIENCES': '环境科学',
  'ENVIRONMENTAL ENGINEERING': '环境工程',
  'ENGINEERING': '工程技术',
  'BIOLOGY & BIOCHEMISTRY': '生物学与生物化学',
  'CLINICAL MEDICINE': '临床医学',
  'COMPUTER SCIENCE': '计算机科学',
  'ECONOMICS': '经济学',
  'MANAGEMENT': '管理学',
  'EDUCATION & EDUCATIONAL RESEARCH': '教育学与教育研究',
  'PSYCHOLOGY': '心理学',
  'MULTIDISCIPLINARY SCIENCES': '综合性科学'
}

function translateSubject(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const compact = raw.toUpperCase().replace(/\s+/g, ' ')
  const zh = SUBJECT_ZH[compact]
  return zh ? `${zh}（${raw}）` : raw
}

function translateSubjects(values) {
  return asArray(values).map(translateSubject).filter(Boolean)
}

function formatZone(zone, top, fallback = '-') {
  if (!zone) return fallback
  const text = String(zone)
  return `${text}${text.includes('区') ? '' : '区'}${top ? ' TOP' : ''}`
}

function formatBoolLabel(value, yes, no = '未标记') {
  if (value === true) return yes
  if (value === false || value === undefined || value === null || value === '') return no
  return String(value)
}

function toMonthCycle(value) {
  if (!value) return '审稿周期待查'
  const text = String(value).trim()
  if (!text) return '审稿周期待查'
  if (/月|month/i.test(text)) return text
  const nums = text.match(/\d+(?:\.\d+)?/g)
  if (!nums || !/(周|week)/i.test(text)) return text
  const months = nums.map(n => {
    const month = Number(n) / 4
    return Number.isInteger(month) ? String(month) : month.toFixed(1).replace(/\.0$/, '')
  })
  return months.length >= 2 ? `约 ${months[0]}-${months[1]} 个月` : `约 ${months[0]} 个月`
}

function enrichDetail(item) {
  const jcrSubcategories = translateSubjects(item.jcrSubcategories || item.jcr_categories || item.wos_categories)
  const casSubcategories = asArray(item.casSubcategories || item.cas_subjects || item.cas_subcategories)
  const wosSubjects = translateSubjects(item.wosSubjects || item.wos_subjects || item.subjects)
  const eiSubjects = translateSubjects(item.eiSubjects || item.ei_subjects)
  const mainFields = asArray(item.mainFields || item.research_fields || item.openalex_topics || item.topics)
  const indexBadges = asArray(item.badges || item.indices || item.indexes)

  return {
    ...item,
    indexBadges,
    jcrSubcategories,
    casSubcategories,
    wosSubjects,
    eiSubjects,
    mainFields,
    reviewCycle: toMonthCycle(firstValue(item, ['reviewCycle', 'review_cycle', 'review_time', 'sd_review_cycle', 'acceptance_time'], '审稿周期待查')),
    freeText: firstValue(item, ['freeText', 'free_label'], item.free ? '免费发表' : '付费发表'),
    website: firstValue(item, ['website', 'url', 'homepage', 'official_url'], '-'),
    scopusId: firstValue(item, ['scopusId', 'scopus_id'], '-'),
    publishedWorks: firstValue(item, ['publishedWorks', 'works_count', 'published_works'], '-'),
    esiSubject: firstValue(item, ['esiSubject', 'esi_subject'], '-'),
    pubmed: formatBoolLabel(item.pubmed || item.pubmed_indexed, 'PubMed 收录'),
    pmc: formatBoolLabel(item.pmc || item.pmc_fulltext, 'PMC 全文存档'),
    warning: firstValue(item, ['warningText', 'warning'], '无中科院预警记录'),
    citicWarning: firstValue(item, ['citicWarning', 'citic_warning'], '无中信所预警记录')
  }
}

function normalizeDetail(row, slug) {
  const base = DETAIL_MAP[slug] || DETAIL_MAP['applied-energy']
  if (!row || !row.title && !row.name) return enrichDetail(base)
  return enrichDetail({
    ...base,
    ...row,
    title: row.title || row.name || base.title,
    ifText: String(row.ifText || row.if_2024 || row.if || base.ifText),
    jcr: row.jcr || row.if_quartile || base.jcr,
    cas: row.cas || formatZone(row.cas_zone, row.cas_top, base.cas),
    xinrui: row.xinrui || row.xr || row.xr_zone_text || formatZone(row.xr_zone || row.xinrui_zone, row.xr_top || row.xinrui_top, base.xinrui),
    badges: row.badges || row.indices || row.indexes || base.badges
  })
}

Page({
  data: {
    journal: enrichDetail(DETAIL_MAP['applied-energy'])
  },

  onLoad(options) {
    const slug = decodeURIComponent(options.slug || 'applied-energy')
    this.setData({ journal: enrichDetail(DETAIL_MAP[slug] || DETAIL_MAP['applied-energy']) })
    this.fetchDetail(slug)
  },

  fetchDetail(slug) {
    wx.request({
      url: `${app.globalData.apiBase}/journals/${encodeURIComponent(slug)}`,
      method: 'GET',
      success: (res) => {
        if (res.data && !res.data.error) {
          this.setData({ journal: normalizeDetail(res.data, slug) })
        }
      }
    })
  },

  onShareAppMessage() {
    return {
      title: `${this.data.journal.title} - JournalAI分区速查`,
      path: `/pages/detail/detail?slug=${this.data.journal.slug}`
    }
  }
})
