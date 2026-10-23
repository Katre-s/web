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

/* ------------------------------ 页面别名 ------------------------------ */
const PAGES = [
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
const HOWTO_RE = /(怎么|怎样|如何|在哪|哪里|教程|步骤|流程|为什么|能不能|可不可以|可以吗|多少钱|卖多少|什么价|价格|值多少|价钱|功能)/
const PARTICLE_RE = /(这本书|那本书|一书|的书|的价格|多少钱|价格|吧|呢|啊|呀|哦|谢谢|嘛)+$/
// 页面词被误当成书名时的兜底（如"打开交易页"里的"交易"）
const PAGE_STOPWORDS = ['广场', '购物车', '订单', '页面', '交易', '发布', '首页', '主页', '求购', '清单', '市场', '消息', '对话', '个人中心', '书架', '书单']
// 指代词不能被当成书名（"那本书" 曾被抓成《书》，导致去搜"书"）
const GENERIC_TITLES = ['书', '本', '一本', '这本书', '那本书', '这本', '那本', '这个', '那个', '它', '这些', '那些']

function cleanTitle(raw) {
  const title = String(raw || '')
    .replace(/^[的地得\s]+/, '')
    .replace(/^(一本|一本叫|这个|那个|这本|那本|一下)/, '')
    .replace(PARTICLE_RE, '')
    .replace(/[，。,.!！?？、；;：:]+$/, '')
    .trim()
    .slice(0, 60)
  if (!title || PAGE_STOPWORDS.includes(title) || GENERIC_TITLES.includes(title)) return ''
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

  const m5 = msg.match(/(?:给我买|帮我买|买一本|要一本|来一本|求购|收购|想收|求一本|收一本|想卖|要卖|出售|上架|发布|卖掉|有没有|找一下|找一找|找找|找|搜一下|搜索|搜|查一下|查查|查|买|加入购物车|放进购物车|放到购物车|扔进购物车)\s*([^\s，。,.!！?？、；;]{2,40})/)
  if (m5) return cleanTitle(m5[1])

  return ''
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

function variantTitles(title) {
  const t = String(title || '').trim()
  if (!t) return []
  const list = [t]
  // "高等数学书" → "高等数学"；"数学课本" → "数学"
  if (/书$/.test(t) && t.length > 2) list.push(t.slice(0, -1))
  if (/课本$|教材$/.test(t) && t.length > 3) list.push(t.replace(/课本$|教材$/, ''))
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
  const lower = msg.toLowerCase()
  const page = PAGES.find(p => p.keys.some(k => lower.includes(k.toLowerCase())))

  // 0) 指代 + 问价："那本多少钱" → 用上下文那本书查价（必须在 HOWTO 之前，否则会被当成咨询丢掉）
  if (ref && /(多少钱|什么价|价格|贵不贵|贵吗|便宜吗|几个卖家|有人卖)/.test(msg)) {
    return { action: 'price_query', ref, title, isbn }
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

  // 2) 加入购物车（必须有"加/放/扔/塞/添/装"这类动作词，且得有书名或指代）
  if (/购物车/.test(msg) && /(加|放|扔|塞|添|装|拉)/.test(msg) && (title || ref)) {
    return { action: 'cart_add', ref, title, isbn }
  }

  // 3) 购物车查询
  if (/购物车/.test(msg) && /(有什么|有多少|看看|查看|里面|清单|几件|我的)/.test(msg)) {
    return { action: 'cart_list' }
  }

  // 5) 卖书 / 上架书籍（有价格才直接创建，没价格就预填发布页）
  if (/(上架|发布|出售|卖掉|卖)/.test(msg)) {
    return { action: 'publish', ref, title, isbn, price }
  }

  // 6) 找书 / 搜索 —— 必须有书名/ISBN 实体才接管；开放性问题（"有什么好书推荐"）交给大模型，避免机械反问
  if ((/(有没有|找一?本|找一下|找找|找|搜索|搜一下|搜|查一?下|查查|查|有什么)/.test(msg) || title) && (title || isbn)) {
    return { action: 'search', ref, title, isbn }
  }

  // 7) 打开 / 跳转页面
  if (page) return { action: 'navigate', page }

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
    case 'publish': return publishBook(parsed, userId)
    case 'search': return searchBooks(parsed)
    case 'price_query': return priceQuery(parsed)
    case 'navigate': return navigate(parsed.page)
    default: return null
  }
}

function goCartAction() {
  return { type: 'navigate', path: '/orders?tab=cart', label: '去购物车' }
}

function availableWhere(variants, isbn) {
  const or = []
  if (isbn) or.push({ isbn })
  or.push(...bookWhereByTitle(variants))
  return { status: 'available', [Op.or]: or }
}

// 指代问价："那本多少钱""第一本贵不贵" → 必须先由上下文补出书名
async function priceQuery({ title, isbn }) {
  if (!title && !isbn) {
    return {
      intent: 'search',
      reply: '你想问哪本书的价格？告诉我书名就行～',
      actions: [{ type: 'navigate', path: '/trade', label: '去交易页' }]
    }
  }

  const products = await Product.findAll({
    where: availableWhere(variantTitles(title), isbn),
    order: [['price', 'ASC']],
    limit: 50
  })

  if (!products.length) {
    return {
      intent: 'search',
      reply: `《${title || isbn}》目前没有卖家在售，可以先去交易页看看同类别的东西。`,
      actions: [{ type: 'navigate', path: '/trade', label: '去交易页' }]
    }
  }

  const min = Number(products[0].price)
  const max = Number(products[products.length - 1].price)
  const name = products[0].bookTitle || products[0].title || title
  const priceText = products.length > 1 && max !== min ? `¥${min} ~ ¥${max}` : `¥${min}`

  return {
    intent: 'search',
    reply: `《${name}》现在有 ${products.length} 个卖家在售，价格 ${priceText}，最低那本${products[0].condition ? `是${products[0].condition}` : ''}。`,
    actions: [
      { type: 'navigate', path: `/book/${encodeURIComponent(products[0].isbn || name)}`, label: '看这本书' },
      { type: 'navigate', path: '/trade', label: '去交易页' }
    ]
  }
}

async function addToCart({ title, isbn }, userId) {
  const variants = variantTitles(title)
  if (!variants.length && !isbn) {
    return { intent: 'order', reply: '告诉我书名，我直接帮你加进购物车～', actions: [{ type: 'navigate', path: '/trade', label: '去交易页' }] }
  }

  const or = []
  if (isbn) or.push({ isbn })
  or.push(...bookWhereByTitle(variants))

  const product = await Product.findOne({
    where: { status: 'available', userId: { [Op.ne]: userId }, [Op.or]: or },
    order: [['price', 'ASC']]
  })

  if (!product) {
    return {
      intent: 'buy',
      reply: `没找到《${title || isbn}》的在售商品，先去交易页逛逛别的书吧。`,
      actions: [{ type: 'navigate', path: '/trade', label: '去交易页浏览' }]
    }
  }

  const exists = await CartItem.findOne({ where: { userId, productId: product.id } })
  if (exists) {
    return { intent: 'order', reply: `《${product.bookTitle || product.title}》已经在你的购物车里了，去结算吧～`, actions: [goCartAction()] }
  }

  await CartItem.create({ userId, productId: product.id })
  return {
    intent: 'order',
    reply: `已经帮你把《${product.bookTitle || product.title}》加入购物车啦（¥${Number(product.price)}，${product.condition || '九成新'}）。`,
    actions: [goCartAction(), { type: 'navigate', path: `/book/${encodeURIComponent(product.isbn || product.bookTitle || product.id)}`, label: '看这本书' }]
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
  const names = valid.slice(0, 3).map(i => `《${i.product.bookTitle || i.product.title}》`).join('、')
  return {
    intent: 'order',
    reply: `购物车里有 ${valid.length} 件商品：${names}${valid.length > 3 ? ' 等' : ''}，合计约 ¥${total.toFixed(2)}。`,
    actions: [goCartAction()]
  }
}

async function publishBook({ title, isbn, price }, userId) {
  const book = await findTitles(title, isbn)

  if (!title && !isbn) {
    return {
      intent: 'sell',
      reply: '告诉我要卖的书名和售价（比如"卖《高等数学》15元"），我帮你直接上架；也可以先去发布页填写。',
      actions: [{ type: 'navigate', path: '/publish', label: '去发布页' }]
    }
  }

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

async function searchBooks({ title, isbn }) {
  if (!title && !isbn) {
    return {
      intent: 'search',
      reply: '想找哪本书？告诉我书名或 ISBN，我帮你查市场上有几个卖家。',
      actions: [{ type: 'navigate', path: '/trade', label: '去交易页' }]
    }
  }

  const variants = variantTitles(title)
  const bookWhere = isbn
    ? { isbn }
    : { [Op.or]: variants.map(v => ({ bookTitle: { [Op.like]: `%${v}%` } })) }

  let books = await Book.findAll({ where: bookWhere, limit: 5 })
  const or = []
  if (isbn) or.push({ isbn })
  or.push(...bookWhereByTitle(variants))

  const products = await Product.findAll({
    where: { status: 'available', [Op.or]: or },
    order: [['price', 'ASC']],
    limit: 5
  })

  if (!books.length && products.length) {
    // Book 表没记录但商品在售：用商品兜底
    books = products.map(p => ({
      id: null,
      isbn: p.isbn,
      bookTitle: p.bookTitle || p.title,
      bookAuthor: p.bookAuthor,
      bookCover: p.bookCover
    }))
  }

  if (!books.length) {
    return {
      intent: 'search',
      reply: `暂时没找到《${title || isbn}》，可以换个书名或 ISBN 再试试。`,
      actions: [{ type: 'navigate', path: '/trade', label: '去交易页' }]
    }
  }

  const top = books[0]
  const count = products.filter(p => (top.isbn ? p.isbn === top.isbn : (p.bookTitle || p.title) === top.bookTitle)).length
  const lowest = products.length ? Math.min(...products.map(p => Number(p.price) || 0)) : 0
  // 把其他候选书名也写进回复，用户接着说"第二本/最后一本"时上下文才有得指代
  const others = books.slice(1, 3).map(b => `《${b.bookTitle}》`)
  const more = others.length ? `，另外还有${others.join('、')}` : ''

  return {
    intent: 'search',
    reply: count
      ? `找到《${top.bookTitle}》，市场上有 ${count} 个卖家在售，最低 ¥${lowest}${more}。点下面的按钮直接去看。`
      : `找到了《${top.bookTitle}》，但目前还没有卖家在售${more}。`,
    actions: books.slice(0, 3).map(b => ({
      type: 'navigate',
      path: `/book/${encodeURIComponent(b.id || b.isbn || b.bookTitle)}`,
      label: `看《${b.bookTitle}》`
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
