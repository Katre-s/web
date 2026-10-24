/**
 * AI 可执行能力层（Agent Tools）
 * ------------------------------------------------------------------
 * 背景：此前的 AI 只会返回 intent + 文案，前端最多跳个页面，
 *       "帮我加购物车 / 卖这本书 / 打开某页面" 这类要求完全落不了地。
 *
 * 方案：把"模型自由发挥"和"真实后端操作"解耦——
 *   1) parseIntent() 用规则引擎从自然语言里提取动作 + 实体（书名/ISBN/价格/页面）；
 *   2) runAgentAction() 用当前登录用户真正执行数据库写操作（购物车、商品）；
 *   3) 返回给前端的 actions 只描述"怎么跳转/怎么预填"，不做二次写操作。
 *
 * 为什么不用纯 function calling：线上是本地微调的 4B 模型（qwen3-4B），
 * 让它稳定输出合法 JSON 参数不现实；规则层保证能力，模型只负责聊天兜底。
 */

import { Op } from 'sequelize'
import { Product, Book, CartItem } from '../models/index.js'
import { TRADE_CATEGORIES, normalizeCategory, isBookCategory } from '../config/categories.js'

/* ------------------------------ 页面别名 ------------------------------ */
export const PAGES = [
  { keys: ['购物车'], path: '/orders?tab=cart', name: '订单信息（含购物车）' },
  { keys: ['我的订单', '订单', '订单信息'], path: '/orders', name: '我的订单' },
  { keys: ['交易市场', '交易页', '二手市场', '交易'], path: '/trade', name: '交易页' },
  { keys: ['发布页', '发布', '上架页'], path: '/publish', name: '发布页' },
  { keys: ['书单'], path: '/booklist', name: '书单上传' },
  { keys: ['对话', '消息'], path: '/chat', name: '对话' },
  { keys: ['个人中心', '我的主页', '我的发布'], path: '/profile', name: '个人中心' },
  { keys: ['ai助手', 'ai 助手'], path: '/ai-chat', name: 'AI 助手' },
  { keys: ['首页', '主页'], path: '/', name: '首页' }
]

/* ------------------------------ 文本工具 ------------------------------ */
// 只拦"真的在问用法"的句子。
// 历史上这里曾包含「教程」「多少钱」「价格」「什么价」，造成两个致命误判：
//   ① 商品名里带"教程"（军事理论教程 / 听说教程）→ 整句被当成用法咨询丢弃，连加购都失败；
//   ② 任何问价句（"离散数学多少钱"）→ 同样的下场。
// 价格是平台内的可查数据，不是"怎么用"的问题，绝不能在这里拦。
const HOWTO_RE = /(怎么|怎样|如何|在哪|哪里|步骤|流程|为什么|能不能|可不可以|可以吗|功能)/
const PARTICLE_RE = /(这本书|那本书|一书|的书|的价格|多少钱|价格|吧|呢|啊|呀|哦|谢谢|嘛)+$/
// 页面词被误当成书名时的兜底（如"打开交易页"里的"交易"）
const PAGE_STOPWORDS = ['广场', '购物车', '订单', '页面', '交易', '发布', '首页', '主页', '求购', '清单', '市场', '消息', '对话', '个人中心', '书架', '书单']
// 指代词不能被当成书名（"那本书" 曾被抓成《书》，导致去搜"书"）
const GENERIC_TITLES = ['书', '本', '一本', '这本书', '那本书', '这本', '那本', '这个', '那个', '它', '这些', '那些', '什么', '啥', '东西', '物品', '商品', '二手', '闲置']

// 推荐类泛化词：不该被当成具体商品名去搜（"有什么好书推荐"应交给大模型给建议）
const RECO_RE = /(推荐|好书|好物|划算|性价比|值得|便宜|捡漏)/

function cleanTitle(raw) {
  const title = String(raw || '')
    .replace(/^[的地得\s]+/, '')
    .replace(/^(我的|我想要|我想|我要|我|这个|那个|这本|那本|这台|那台|这部|那部|这件|那件|这条|那条|这双|那双|这辆|那辆|一下|一本叫|一本|一个|一件|一条|一双|一台|一部|一只|一张|一套|一辆|有个叫|有个|下这个|下那个|下了|入到|进到)/, '')
    .replace(PARTICLE_RE, '')
    .replace(/\d+(?:\.\d+)?\s*(?:元|块钱|块)$/, '')
    .replace(/[，。,.!！?？、；;：:]+$/, '')
    .trim()
    .slice(0, 60)
  if (!title || PAGE_STOPWORDS.includes(title) || GENERIC_TITLES.includes(title)) return ''
  if (RECO_RE.test(title)) return ''
  // 问价类词组不可能是商品名（"我要卖这本书多少钱合适" 曾抽出 "书多少钱合适"）
  if (/(多少钱|多少|什么价|价格|合适|贵不贵|便宜吗)/.test(title)) return ''
  // 页面/功能词也不是商品名（"帮我加入到购物车" 曾抽出 "入到购物车"）
  if (/(购物车|订单|页面|个人中心|交易页|发布页|首页|广场)/.test(title)) return ''
  return title
}

/* ---------------------------- 上下文指代 ---------------------------- */
const CN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 }

/**
 * 识别"它/这本/那本/第一本/最后一个"这类指代，本身不含书名，
 * 由 agentService 结合历史决定指的是哪本书。
 */
export function parseReference(msg) {
  const text = String(msg || '')
  if (/(最后一本|最后一个|最后那本)/.test(text)) return { type: 'last' }
  const m = text.match(/第([一二三四五六1-6])\s*(本|个)/)
  if (m) return { type: 'ordinal', index: CN_NUM[m[1]] - 1 }
  if (/(它|这本|那本|这本书|那本书|刚才那本|刚说的那本|上面那本|这个|那个)/.test(text)) return { type: 'last' }
  return null
}

/** 从一句话里尽量抽出书名 */
export function extractTitle(msg) {
  const m1 = msg.match(/[《【]([^》】]{1,60})[》】]/)
  if (m1) return cleanTitle(m1[1])

  const m2 = msg.match(/[“"']([^”"']{2,60})[”"']/)
  if (m2) return cleanTitle(m2[1])

  const m3 = msg.match(/(?:书名|书名叫|名字叫|叫做|叫)\s*[：:]?\s*([^\s，。,.!！?？、；;]{2,40})/)
  if (m3) return cleanTitle(m3[1])

  const m4 = msg.match(/(?:把|将)(.{2,40}?)(?:加入|放进|放到|加到|扔进|塞进|添加到|添加)/)
  if (m4) return cleanTitle(m4[1])

  const m5 = msg.match(/(?:给我买|帮我买|帮我加|买一本|要一本|来一本|求购|收购|想收|求一本|收一本|想卖|要卖|出售|上架|发布|卖掉|买下|拿下|拍下|卖|有没有|找一下|找一找|找找|找|搜一下|搜索|搜|查一下|查查|查|买|加入购物车|放进购物车|放到购物车|扔进购物车)\s*([^\s，。,.!！?？、；;]{2,40})/)
  if (m5) return cleanTitle(m5[1])

  return ''
}

/** 从问价句里抽商品名："军事理论教程多少钱" → "军事理论教程"
 *  这类句子没有"买/查/找"之类前缀，extractTitle 抽不出来，
 *  必须靠剥离价格尾缀反推主语，否则规则层永远拿不到名称。
 */
function extractPriceSubject(msg) {
  const m = String(msg || '').match(/^(.*?)(?:多少钱|什么价|什么价格|价格|贵不贵|贵吗|便宜吗|值多少|卖多少|几个卖家|有人卖)/)
  if (!m) return ''
  return cleanTitle(m[1].replace(/[买卖要收]\s*$/, ''))
}

/** 预算上限："预算300左右""500 元以内""不超过 200" → 300 / 500 / 200 */
export function extractBudget(msg) {
  const text = String(msg || '')
  // 必须有预算语境词，否则"高等数学2"里的 2 会被当成预算
  if (!/(预算|以内|以下|左右|不超过|最多|封顶|块钱|元|块)/.test(text)) return null
  const m = text.match(/(\d{1,6})(?:\.\d{1,2})?/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 && n <= 100000 ? n : null
}

/** ISBN（10 位或 13 位，允许中间带 - 或空格） */
export function extractIsbn(msg) {
  const m = String(msg).match(/(?:97[89][-\s]?)?\d(?:[-\s]?\d){8,11}[\dXx]/)
  if (!m) return ''
  const digits = m[0].replace(/[-\s]/g, '')
  return digits.length === 10 || digits.length === 13 ? digits : ''
}

/** 价格：15元 / 15块 / 15.5 元 */
export function extractPrice(msg) {
  const m = String(msg).match(/(\d+(?:\.\d{1,2})?)\s*(?:元|块钱|块|rmb|RMB)/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 && n < 100000 ? n : null
}

/* ------------------------------ 类目识别 ------------------------------ */
// 平台已从"校园书籍"升级为"综合二手交易"，九大类目都要能被识别，
// 否则发布/搜索会把台灯、耳机、球鞋之类也当成书名去查。
const CATEGORY_KEYWORDS = [
  { category: '图书', re: /(书|课本|教材|教辅|真题|习题|小说|杂志|词典|四六级|考研|笔记|题库)/ },
  { category: '数码产品', re: /(手机|平板|电脑|笔记本|相机|耳机|音箱|音响|键盘|鼠标|显示器|充电宝|数据线|硬盘|显卡|游戏机|switch|ipad|iphone|数码)/i },
  { category: '生活用品', re: /(台灯|水杯|杯子|被子|枕头|床单|衣架|收纳|柜子|锅|碗|风扇|加湿器|插排|插座|雨伞|毛巾|洗漱|宿舍|生活用品|日用品)/ },
  { category: '穿搭', re: /(衣服|外套|卫衣|t恤|裤子|裙子|鞋子|球鞋|靴子|帽子|围巾|背包|穿搭|服饰)/i },
  { category: '出行', re: /(自行车|单车|电动车|滑板|行李箱|行李|头盔|代步|出行)/ },
  { category: '时尚首饰', re: /(项链|手链|戒指|耳环|耳钉|手镯|首饰|饰品)/ },
  { category: '文玩', re: /(文玩|手串|核桃|菩提|紫砂|玉佩|古玩)/ },
  { category: '租房', re: /(租房|合租|房源|单间|出租房|房间)/ },
  { category: '食品', re: /(零食|食品|水果|泡面|牛奶|饮料|特产)/ }
]

/** 从一句话里识别商品类目，识别不到返回 ''（由调用方决定默认值） */
export function extractCategory(msg) {
  const text = String(msg || '')
  for (const { category, re } of CATEGORY_KEYWORDS) if (re.test(text)) return category
  return ''
}

function variantTitles(title) {
  const t = String(title || '').trim()
  if (!t) return []
  const list = [t]
  // "高等数学书" → "高等数学"；"数学课本" → "数学"
  if (/书$/.test(t) && t.length > 2) list.push(t.slice(0, -1))
  if (/课本$|教材$/.test(t) && t.length > 3) list.push(t.replace(/课本$|教材$/, ''))
  // 上下文里拿到的是模型拼的复合名（"办公椅 靠背椅"），整串 LIKE 必然落空，
  // 拆成单词分别去匹配，任一段命中即可。
  const parts = t.split(/[\s、,，/|·]+/).filter(x => x.length >= 2)
  if (parts.length > 1) list.push(...parts)
  return [...new Set(list.filter(Boolean))]
}

/* ------------------------------ 意图解析 ------------------------------ */
/**
 * @returns {null | {action:string, title?:string, isbn?:string, price?:number|null, page?:object}}
 *   null 表示交给大模型正常对话（含"怎么用"类咨询，避免把说明当成命令执行）
 */
export function parseIntent(raw) {
  const msg = String(raw || '').trim()
  if (!msg) return null

  const ref = parseReference(msg)
  const title = extractTitle(msg)
  const isbn = extractIsbn(msg)
  const price = extractPrice(msg)
  const category = extractCategory(msg)
  // 只说了类目、没点具体商品（"有什么数码产品""推荐点生活用品"）
  const titleIsCategory = Boolean(title && TRADE_CATEGORIES.includes(title))
  const lower = msg.toLowerCase()
  const page = PAGES.find(p => p.keys.some(k => lower.includes(k.toLowerCase())))

  // 0) 指代 + 问价："那本多少钱" → 用上下文那本书查价（必须在 HOWTO 之前，否则会被当成咨询丢掉）
  if (ref && /(多少钱|什么价|价格|贵不贵|贵吗|便宜吗|几个卖家|有人卖)/.test(msg)) {
    return { action: 'price_query', ref, title, isbn }
  }

  // 0.2) 点名商品 + 问价："军事理论教程多少钱""听说教程什么价格"
  //     以前这类句子被 HOWTO_RE 里的"多少钱/价格"拦成 null，用户只收到一句"没查到"。
  const priceSubject = title || extractPriceSubject(msg)
  if (priceSubject && /(多少钱|什么价|什么价格|价格|贵不贵|贵吗|便宜吗|几个卖家|有人卖|值多少|卖多少)/.test(msg)) {
    return { action: 'price_query', title: priceSubject, isbn, category }
  }

  if (HOWTO_RE.test(msg)) return null

  // 0.5) 指代 + 购买/加入："把它加入购物车""那本我要了"
  if (ref && /(买|加|来|拿下|下单|拍下|要了)/.test(msg) && !/收藏/.test(msg)) {
    return { action: 'cart_add', ref, title, isbn }
  }

  // 0.6) 明确的"给我买/帮我买"+ 书名 → 直接加购（而不是只回一句"带你去搜"）
  if (/(给我买|帮我买|帮我加|直接买|我要买|买下|下单买|来一本)/.test(msg) && title) {
    return { action: 'cart_add', title, isbn }
  }

  // 1) 纯"打开某页面"（没有点名具体书）→ 先判跳转，避免"打开交易页"被当成书名
  if (page && /(打开|进入|去|跳到|跳转|带我去|看看|查看)/.test(msg) && !/[《【]/.test(msg)) {
    return { action: 'navigate', page }
  }

  // 2) 加入购物车。只要出现"购物车 + 加/放/扔…"就当作加购意图，
  //    没点名商品时由 resolveContext 用上下文里最后提到的商品补上——以前要求必须带名称，
  //    于是"帮我把加入购物车""直接给我加入购物车"这类指代句全被丢掉，只回一句"去购物车页面"。
  if (/购物车/.test(msg) && /(加|放|扔|塞|添|装|拉)/.test(msg)) {
    return { action: 'cart_add', ref, title, isbn }
  }

  // 3) 购物车查询
  if (/购物车/.test(msg) && /(有什么|有多少|看看|查看|里面|清单|几件|我的)/.test(msg)) {
    return { action: 'cart_list' }
  }

  // 3.5) 只说了类目、没有具体商品名："我要租房""有什么数码产品"
  //      → 直接列该类目在售商品（只给个"去交易页"的空话，用户会觉得 AI 什么都不会）
  //      带"发布/出售/出租"的是上架意图，交给后面的发布分支，别误判成找货
  if (category && !title && !isbn && !/(发布|上架|出售|卖掉|出租|转租|求租合租)/.test(msg)) {
    return { action: 'search', category, maxPrice: extractBudget(msg) }
  }

  // 5) 上架发布（有价格才直接创建，没价格就预填发布页）—— 图书/数码/生活用品等全部支持
  if (/(上架|发布|出售|卖掉|卖|出租|转租)/.test(msg)) {
    return { action: 'publish', ref, title: titleIsCategory ? '' : title, isbn, price, category }
  }

  // 5.5) 只说了类目 → 直接列该类目在售商品
  if (titleIsCategory && category) {
    return { action: 'search', category, maxPrice: extractBudget(msg) }
  }

  // 6) 找商品 / 搜索 —— 必须有名称/ISBN 实体才接管；开放性问题交给大模型，避免机械反问
  if ((/(有没有|找一?本|找一下|找找|找|搜索|搜一下|搜|查一?下|查查|查|有什么)/.test(msg) || title) && (title || isbn)) {
    return { action: 'search', ref, title, isbn, category }
  }

  // 7) 打开 / 跳转页面
  if (page) return { action: 'navigate', page }

  // 8) 推荐类开放问题（"推荐点好物""有什么划算的"）→ 直接列真实在售，别回一句空话
  if (!title && !isbn && !category && RECO_RE.test(msg)) {
    return { action: 'search', recommend: true, maxPrice: extractBudget(msg) }
  }

  return null
}

/* ------------------------------ 执行动作 ------------------------------ */
function bookWhereByTitle(variants) {
  return variants.flatMap(v => ([
    { bookTitle: { [Op.like]: `%${v}%` } },
    { title: { [Op.like]: `%${v}%` } }
  ]))
}

async function findTitles(title, isbn) {
  if (isbn) {
    const byIsbn = await Book.findOne({ where: { isbn } })
    if (byIsbn) return byIsbn
  }
  const variants = variantTitles(title)
  if (!variants.length) return null
  return Book.findOne({ where: { [Op.or]: variants.map(v => ({ bookTitle: { [Op.like]: `%${v}%` } })) } })
}

/** 真正的写操作都在这里，userId 来自 JWT */
export async function runAgentAction(parsed, userId) {
  if (!parsed || !userId) return null

  switch (parsed.action) {
    case 'cart_add': return addToCart(parsed, userId)
    case 'cart_list': return listCart(userId)
    case 'publish': return publishItem(parsed, userId)
    case 'search': return searchItems(parsed)
    case 'price_query': return priceQuery(parsed)
    case 'navigate': return navigate(parsed.page)
    default: return null
  }
}

function goCartAction() {
  return { type: 'navigate', path: '/orders?tab=cart', label: '去购物车' }
}

function availableWhere(variants, isbn, category) {
  const or = []
  if (isbn) or.push({ isbn })
  or.push(...bookWhereByTitle(variants))
  const where = { status: 'available', [Op.or]: or }
  if (category) where.category = category
  return where
}

/**
 * 类目只当"软偏好"：先按类目查，查不到再放开类目重查。
 * 原因：平台大量历史商品的 category 是 NULL（九大类目是后加的字段），
 * 如果把它当硬过滤，用户说"蓝牙耳机"时模型顺手带上 category=数码产品，
 * 就会把这些有货的老商品全筛掉，表现为"什么都搜不到"。
 */
async function findAllByCategory(baseWhere, category, options = {}) {
  if (!category) return Product.findAll({ where: baseWhere, ...options })
  const hit = await Product.findAll({ where: { ...baseWhere, category }, ...options })
  if (hit.length) return hit
  return Product.findAll({ where: baseWhere, ...options })
}

async function findOneByCategory(baseWhere, category, options = {}) {
  if (!category) return Product.findOne({ where: baseWhere, ...options })
  const hit = await Product.findOne({ where: { ...baseWhere, category }, ...options })
  if (hit) return hit
  return Product.findOne({ where: baseWhere, ...options })
}

/** 商品详情跳转：图书去书目聚合页，其他类目去商品详情页 */
function itemLink(product, name) {
  if (isBookCategory(product.category)) {
    return `/book/${encodeURIComponent(product.isbn || name)}`
  }
  return `/product/${product.id}`
}

// 指代问价："那本多少钱""第一件贵不贵" → 必须先由上下文补出名称
async function priceQuery({ title, isbn, category }) {
  if (!title && !isbn) {
    return {
      intent: 'search',
      reply: '你想问哪件商品的价格？告诉我名字就行～',
      actions: [{ type: 'navigate', path: '/trade', label: '去交易页' }]
    }
  }

  // 类目软过滤：先按类目查，查不到再放开（历史商品 category 可能为空）
  const or = []
  if (isbn) or.push({ isbn })
  or.push(...bookWhereByTitle(variantTitles(title)))
  const products = await findAllByCategory(
    { status: 'available', [Op.or]: or },
    category,
    { order: [['price', 'ASC']], limit: 50 }
  )

  if (!products.length) {
    return {
      intent: 'search',
      reply: `「${title || isbn}」目前没有卖家在售，可以先去交易页看看同类别的商品。`,
      actions: [{ type: 'navigate', path: '/trade', label: '去交易页' }]
    }
  }

  const min = Number(products[0].price)
  const max = Number(products[products.length - 1].price)
  const name = products[0].bookTitle || products[0].title || title
  const priceText = products.length > 1 && max !== min ? `¥${min} ~ ¥${max}` : `¥${min}`
  const lowest = products[0]

  return {
    intent: 'search',
    reply: `「${name}」现在有 ${products.length} 个卖家在售，价格 ${priceText}${lowest.condition ? `，最低的是${lowest.condition}` : ''}。`,
    actions: [
      { type: 'navigate', path: itemLink(lowest, name), label: '看这件商品' },
      { type: 'navigate', path: '/trade', label: '去交易页' }
    ]
  }
}

async function addToCart({ title, isbn, category }, userId) {
  const variants = variantTitles(title)
  if (!variants.length && !isbn) {
    return { intent: 'order', reply: '告诉我商品名字，我直接帮你加进购物车～', actions: [{ type: 'navigate', path: '/trade', label: '去交易页' }] }
  }

  const or = []
  if (isbn) or.push({ isbn })
  or.push(...bookWhereByTitle(variants))

  // 注意 SQL 陷阱：`userId <> 当前用户` 不会返回 userId 为 NULL 的行。
  // 批量导入的老教材往往没有 userId，会被这条件整批排除——必须把 NULL 也放行。
  const base = {
    status: 'available',
    [Op.and]: [
      { [Op.or]: or },
      { [Op.or]: [{ userId: null }, { userId: { [Op.ne]: userId } }] }
    ]
  }

  const product = await findOneByCategory(base, category, { order: [['price', 'ASC']] })

  if (!product) {
    // 只有自己发布的？——这种情况必须说清楚，否则用户会以为"搜索坏了"
    const mine = await findOneByCategory(
      { status: 'available', userId: userId, [Op.or]: or },
      category,
      { order: [['price', 'ASC']] }
    )
    if (mine) {
      const mineName = mine.bookTitle || mine.title
      return {
        intent: 'order',
        reply: `「${mineName}」是你自己发布的，不能加进自己的购物车～要不去交易页看看别人在卖的同类？`,
        actions: [{ type: 'navigate', path: '/trade', label: '去交易页' }]
      }
    }
    return {
      intent: 'buy',
      reply: `没找到「${title || isbn}」的在售商品，先去交易页逛逛别的吧。`,
      actions: [{ type: 'navigate', path: '/trade', label: '去交易页浏览' }]
    }
  }

  const name = product.bookTitle || product.title
  const exists = await CartItem.findOne({ where: { userId, productId: product.id } })
  if (exists) {
    return { intent: 'order', reply: `「${name}」已经在你的购物车里了，去结算吧～`, actions: [goCartAction()] }
  }

  await CartItem.create({ userId, productId: product.id })
  return {
    intent: 'order',
    reply: `已经帮你把「${name}」加入购物车啦（¥${Number(product.price)}，${product.condition || '成色良好'}）。`,
    actions: [goCartAction(), { type: 'navigate', path: itemLink(product, name), label: '看这件商品' }]
  }
}

async function listCart(userId) {
  const items = await CartItem.findAll({
    where: { userId },
    include: [{ model: Product, as: 'product', required: false }]
  })
  const valid = items.filter(i => i.product)
  if (!valid.length) {
    return { intent: 'order', reply: '你的购物车还是空的，要不要先去交易页逛逛？', actions: [{ type: 'navigate', path: '/trade', label: '去交易页' }] }
  }
  const total = valid.reduce((sum, i) => sum + Number(i.product.price || 0), 0)
  const names = valid.slice(0, 3).map(i => `「${i.product.bookTitle || i.product.title}」`).join('、')
  return {
    intent: 'order',
    reply: `购物车里有 ${valid.length} 件商品：${names}${valid.length > 3 ? ' 等' : ''}，合计约 ¥${total.toFixed(2)}。`,
    actions: [goCartAction()]
  }
}

async function publishItem({ title, isbn, price, category }, userId) {
  const cat = normalizeCategory(category || (isbn ? '图书' : ''))
  const isBook = isBookCategory(cat)
  const book = isBook ? await findTitles(title, isbn) : null

  if (!title && !isbn) {
    return {
      intent: 'sell',
      reply: '告诉我要卖什么、卖多少钱（比如"卖台灯30元""卖《高等数学》15元"），我帮你直接上架；也可以先去发布页填写。',
      actions: [{ type: 'navigate', path: '/publish', label: '去发布页' }]
    }
  }

  if (isBook) {
    const draft = {
      bookTitle: title || book?.bookTitle || '',
      bookAuthor: book?.bookAuthor || '',
      bookPublisher: book?.bookPublisher || '',
      isbn: isbn || book?.isbn || '',
      bookCover: book?.bookCover || '',
      edition: book?.edition || '',
      price: price || null,
      condition: '九成新',
      category: '图书'
    }

    if (!draft.bookTitle) {
      return {
        intent: 'sell',
        reply: '这本书我还没查到名称，告我书名（有 ISBN 也行），我帮你上架。',
        actions: [{ type: 'navigate', path: '/publish', label: '去发布页手动填写' }]
      }
    }

    // 没有售价：不猜价格，打开发布页并把信息填好
    if (!price) {
      return {
        intent: 'sell',
        reply: `我把《${draft.bookTitle}》的信息填好了，确认一下售价就能上架。`,
        actions: [{ type: 'open_publish', label: '去填写售价并上架', draft }]
      }
    }

    const product = await Product.create({
      userId,
      title: draft.bookTitle,
      bookTitle: draft.bookTitle,
      bookAuthor: draft.bookAuthor,
      bookPublisher: draft.bookPublisher,
      isbn: (draft.isbn || '').replace(/[-\s]/g, ''),
      bookCover: draft.bookCover,
      edition: draft.edition,
      price,
      condition: draft.condition,
      category: draft.category,
      delivery: true,
      originalPrice: 0,
      description: '',
      status: 'available'
    })

    if (!book && draft.bookTitle) {
      await Book.create({
        isbn: (draft.isbn || '').replace(/[-\s]/g, ''),
        bookTitle: draft.bookTitle,
        bookAuthor: draft.bookAuthor,
        bookPublisher: draft.bookPublisher,
        bookCover: draft.bookCover,
        edition: draft.edition,
        originalPrice: 0,
        createdBy: userId
      })
    }

    return {
      intent: 'sell',
      reply: `已上架《${draft.bookTitle}》，售价 ¥${price}，成色${draft.condition}。买家可以直接下单，你可以在"我的发布"里管理。`,
      actions: [
        { type: 'navigate', path: '/profile', label: '查看我的发布' },
        { type: 'navigate', path: `/product/${product.id}`, label: '看商品页' }
      ]
    }
  }

  // ---- 非图书类目（数码/生活用品/穿搭/出行/首饰/文玩/租房/食品） ----
  const name = String(title || '').trim()
  if (!name) {
    return {
      intent: 'sell',
      reply: '告我要卖的商品名称和售价，我帮你上架；也可以先去发布页手动填写。',
      actions: [{ type: 'navigate', path: '/publish', label: '去发布页手动填写' }]
    }
  }

  const draft = { title: name, category: cat, price: price || null, condition: cat === '租房' ? '' : '九成新', description: '' }

  if (!price) {
    return {
      intent: 'sell',
      reply: `我把「${name}」的信息填好了（类目：${cat}），确认一下售价就能上架。`,
      actions: [{ type: 'open_publish', label: '去填写售价并上架', draft }]
    }
  }

  const product = await Product.create({
    userId,
    title: name,
    bookTitle: '',
    bookAuthor: '',
    bookPublisher: '',
    isbn: '',
    bookCover: '',
    edition: '',
    price,
    condition: draft.condition,
    category: cat,
    delivery: true,
    originalPrice: 0,
    description: '',
    status: 'available'
  })

  return {
    intent: 'sell',
    reply: `已上架「${name}」，售价 ¥${price}，类目：${cat}。买家可以直接下单，你可以在"我的发布"里管理。`,
    actions: [
      { type: 'navigate', path: '/profile', label: '查看我的发布' },
      { type: 'navigate', path: `/product/${product.id}`, label: '看商品页' }
    ]
  }
}

/** 「推荐点好物」的回复：按真实在售数据给几件，绝不让模型编 */
function buildRecommendReply(products, budget) {
  const first = products[0]
  const firstName = first.bookTitle || first.title
  const names = products.slice(0, 3).map(p => `「${p.bookTitle || p.title}」¥${Number(p.price)}`).join('、')
  const budgetText = budget ? ` ${budget} 元以内的` : ' 在售的'
  return {
    intent: 'search',
    reply: `给你挑了${budgetText} ${products.length} 件：${names}${products.length > 3 ? ' 等' : ''}，点按钮直接看。`,
    actions: [
      { type: 'navigate', path: itemLink(first, firstName), label: `看「${firstName}」` },
      { type: 'navigate', path: '/trade', label: '去交易页' }
    ]
  }
}

async function searchItems({ title, isbn, category, maxPrice, recommend }) {
  // 只说了类目：直接列该类目在售商品
  const catOnly = Boolean(category && (!title || TRADE_CATEGORIES.includes(title)))
  if (!title && !isbn && !category) {
    // "推荐点好物"这类开放问题：给几件真实在售的，比让用户自己去翻强
    if (recommend) {
      const where = { status: 'available' }
      if (Number(maxPrice) > 0) where.price = { [Op.lte]: Number(maxPrice) }
      const picks = await Product.findAll({ where, order: [['createdAt', 'DESC']], limit: 6 })
      if (picks.length) {
        return buildRecommendReply(picks, Number(maxPrice) || 0)
      }
    }
    return {
      intent: 'search',
      reply: '想找什么？告诉我商品名（图书、数码、生活用品、穿搭等都可以），我帮你查有没有卖家。',
      actions: [{ type: 'navigate', path: '/trade', label: '去交易页' }]
    }
  }

  if (catOnly) {
    const budget = Number(maxPrice) > 0 ? Number(maxPrice) : 0
    const where = { status: 'available', category }
    if (budget) where.price = { [Op.lte]: budget }
    const products = await Product.findAll({
      where,
      order: [['price', 'ASC']],
      limit: 6
    })
    if (!products.length) {
      // 预算内没货：先查该类目到底有没有货，好给出"最低多少"的实话
      const inCat = await Product.findAll({
        where: { status: 'available', category },
        order: [['price', 'ASC']],
        limit: 20
      })
      if (budget && inCat.length) {
        return {
          intent: 'search',
          reply: `「${category}」里 ${budget} 元以内的暂时没有，最低的在 ¥${Number(inCat[0].price)}（「${inCat[0].bookTitle || inCat[0].title}」）。要不要看看？`,
          actions: [
            { type: 'navigate', path: itemLink(inCat[0], inCat[0].bookTitle || inCat[0].title), label: '看最低价这件' },
            { type: 'navigate', path: `/trade?category=${encodeURIComponent(category)}`, label: `去${category}` }
          ]
        }
      }
      // 该分类没货时，顺手告诉用户站上到底有哪些类目有货，别让他以为"全都搜不到"
      const any = await Product.findAll({
        where: { status: 'available' },
        order: [['createdAt', 'DESC']],
        limit: 40
      })
      if (!any.length) {
        return {
          intent: 'search',
          reply: '平台上目前还没有在售商品，你可以先去「发布」上架一件试试～',
          actions: [{ type: 'navigate', path: '/publish', label: '去发布' }]
        }
      }
      const cats = [...new Set(any.map(p => p.category).filter(Boolean))]
      const hint = cats.length ? `目前有货的是${cats.join('、')}` : '站上商品还不算多'
      return {
        intent: 'search',
        reply: `「${category}」下暂时没有在售商品，${hint}，要不要先去翻翻？`,
        actions: [{ type: 'navigate', path: `/trade?category=${encodeURIComponent(category)}`, label: `去${category}` }]
      }
    }
    const names = products.slice(0, 3).map(p => `「${p.bookTitle || p.title}」¥${Number(p.price)}`).join('、')
    const priceRange = products.length > 1
      ? `，价格 ¥${Number(products[0].price)} ~ ¥${Number(products[products.length - 1].price)}`
      : `，¥${Number(products[0].price)}`
    const budgetText = budget ? `${budget} 元以内、` : ''
    return {
      intent: 'search',
      reply: `「${category}」${budgetText}有 ${products.length} 件在售：${names}${products.length > 3 ? ' 等' : ''}${priceRange}。`,
      actions: [
        { type: 'navigate', path: itemLink(products[0], products[0].bookTitle || products[0].title), label: `看「${products[0].bookTitle || products[0].title}」` },
        { type: 'navigate', path: `/trade?category=${encodeURIComponent(category)}`, label: `去${category}` }
      ]
    }
  }

  const variants = variantTitles(title)
  const bookWhere = isbn
    ? { isbn }
    : { [Op.or]: variants.map(v => ({ bookTitle: { [Op.like]: `%${v}%` } })) }

  let books = []
  if (title || isbn) books = await Book.findAll({ where: bookWhere, limit: 5 })

  const or = []
  if (isbn) or.push({ isbn })
  or.push(...bookWhereByTitle(variants))
  if (!or.length && title) or.push({ title: { [Op.like]: `%${title}%` } })

  // 类目软过滤：先按类目查，查不到再放开（历史商品 category 可能为空）
  const products = await findAllByCategory(
    { status: 'available', [Op.or]: or },
    category,
    { order: [['price', 'ASC']], limit: 5 }
  )

  if (!products.length && !books.length) {
    return {
      intent: 'search',
      reply: `暂时没找到「${title || isbn}」，换个名称或 ISBN 再试试。`,
      actions: [{ type: 'navigate', path: '/trade', label: '去交易页' }]
    }
  }

  // 有书目记录优先用书目；否则用商品兜底（综合平台大量商品没有 Book 记录）
  const list = books.length
    ? books.map(b => ({ name: b.bookTitle, isbn: b.isbn, id: b.id, category: '图书' }))
    : products.map(p => ({ name: p.bookTitle || p.title, isbn: p.isbn, id: p.id, category: p.category }))

  const top = list[0]
  const count = products.filter(p => (top.isbn ? p.isbn === top.isbn : (p.bookTitle || p.title) === top.name)).length
  const lowest = products.length ? Math.min(...products.map(p => Number(p.price) || 0)) : 0
  // 把其他候选也写进回复，用户接着说"第二个/最后一个"时上下文才有得指代
  const others = list.slice(1, 3).map(b => `「${b.name}」`)
  const more = others.length ? `，另外还有${others.join('、')}` : ''

  return {
    intent: 'search',
    reply: count
      ? `找到「${top.name}」，市场上有 ${count} 个卖家在售，最低 ¥${lowest}${more}。点下面的按钮直接去看。`
      : `找到了「${top.name}」，但目前还没有卖家在售${more}。`,
    actions: list.slice(0, 3).map(b => ({
      type: 'navigate',
      path: isBookCategory(b.category) ? `/book/${encodeURIComponent(b.isbn || b.name)}` : `/product/${b.id}`,
      label: `看「${b.name}」`
    }))
  }
}

function navigate(page) {
  if (!page) return null
  return {
    intent: 'help',
    reply: `好的，已经帮你打开「${page.name}」。`,
    actions: [{ type: 'navigate', path: page.path, label: `去${page.name}` }]
  }
}
