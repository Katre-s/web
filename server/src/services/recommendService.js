import axios from 'axios'
import { Op } from 'sequelize'
import { Product, ProductImage, User, UserBehavior, sequelize } from '../models/index.js'

const TRADE_CATEGORIES = [
  '图书', '生活用品', '数码产品', '穿搭', '出行', '时尚首饰', '文玩', '租房', '食品'
]

const CACHE_TTL = Number(process.env.RECOMMEND_CACHE_TTL) || 10 * 60 * 1000
const cache = new Map()

function clearCache(userId) {
  cache.delete(userId)
}

function serializeProduct(p) {
  const json = p.toJSON ? p.toJSON() : p
  return json
}

/** 规则兜底：按行为次数聚合类目与关键词（搜索权重 2，点击权重 1） */
function summarize(behaviors) {
  const catCount = new Map()
  const kwCount = new Map()
  for (const b of behaviors) {
    const weight = b.type === 'search' ? 2 : 1
    if (b.category) catCount.set(b.category, (catCount.get(b.category) || 0) + weight)
    const kw = String(b.keyword || '').trim()
    if (kw && kw.length <= 40) kwCount.set(kw, (kwCount.get(kw) || 0) + weight)
  }
  const categories = [...catCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c)
    .filter((c) => TRADE_CATEGORIES.includes(c))
    .slice(0, 2)
  const keywords = [...kwCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
    .slice(0, 3)
  return { categories, keywords }
}

/**
 * 让本地大模型根据最近的搜索 / 浏览推断偏好。
 * 只走 CHAT_API_URL（本地 Ollama / LM Studio 等），未配置或超时即回落规则。
 */
async function analyzeWithLlm(behaviors, fallback) {
  const apiUrl = process.env.CHAT_API_URL
  if (!apiUrl) return { source: 'rule', ...fallback }

  const lines = behaviors.slice(0, 20).map((b) => {
    const cat = b.category ? `（${b.category}）` : ''
    return b.type === 'search'
      ? `搜索：${b.keyword || '空'}${cat}`
      : `浏览：${b.keyword || '某件商品'}${cat}`
  })

  const prompt = `你是校园二手平台的推荐助手。根据用户最近的行为，推断他现在最想买什么。
${lines.join('\n')}
只输出 JSON，不要解释，格式：{"categories":["类目"],"keywords":["关键词"]}。
categories 只能从这些里选：${TRADE_CATEGORIES.join('、')}，最多 2 个；keywords 最多 3 个，尽量是具体商品名或品牌。`

  try {
    const key = process.env.CHAT_API_KEY
    const headers = { 'Content-Type': 'application/json' }
    if (key) headers.Authorization = `Bearer ${key}`

    const res = await axios.post(apiUrl, {
      model: process.env.CHAT_API_MODEL || 'qwen2.5:7b',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      stream: false
    }, {
      headers,
      timeout: Number(process.env.RECOMMEND_TIMEOUT) || 4000
    })

    const text = String(res.data.choices?.[0]?.message?.content || '')
      .replace(/```json|```/g, '')
      .replace(/<think>[\s\S]*?<\/think>/g, '')
    const matched = text.match(/\{[\s\S]*\}/)
    if (!matched) return { source: 'rule', ...fallback }

    const obj = JSON.parse(matched[0])
    const categories = (Array.isArray(obj.categories) ? obj.categories : [])
      .filter((c) => TRADE_CATEGORIES.includes(c))
      .slice(0, 2)
    const keywords = (Array.isArray(obj.keywords) ? obj.keywords : [])
      .map((k) => String(k).trim().slice(0, 20))
      .filter(Boolean)
      .slice(0, 3)

    if (!categories.length && !keywords.length) return { source: 'rule', ...fallback }
    return { source: 'llm', categories, keywords }
  } catch (err) {
    console.error('推荐模型调用失败:', err.message)
    return { source: 'rule', ...fallback }
  }
}

function productInclude() {
  return [
    { model: ProductImage, as: 'images' },
    { model: User, as: 'seller', attributes: ['id', 'nickname', 'campus'] }
  ]
}

async function randomProducts(userId, limit, excludeIds = []) {
  if (limit <= 0) return []
  const where = { status: 'available', userId: { [Op.ne]: userId } }
  if (excludeIds.length) where.id = { [Op.notIn]: excludeIds }
  return Product.findAll({
    where,
    include: productInclude(),
    order: sequelize.literal('RAND()'),
    limit
  })
}

async function preferenceProducts(userId, { categories, keywords }, limit) {
  const or = []
  if (categories.length) or.push({ category: { [Op.in]: categories } })
  for (const k of keywords) {
    const like = `%${k}%`
    or.push({ title: { [Op.like]: like } }, { bookTitle: { [Op.like]: like } }, { description: { [Op.like]: like } })
  }
  if (!or.length) return []

  const where = { status: 'available', userId: { [Op.ne]: userId }, [Op.or]: or }
  return Product.findAll({
    where,
    include: productInclude(),
    order: sequelize.literal('RAND()'),
    limit
  })
}

/**
 * 首页推荐：
 * 1) 没有搜索/点击记录 → 随机推荐
 * 2) 有记录 → 本地模型推断偏好；模型不可用则用规则聚合
 * 3) 偏好命中的商品不足时，用随机商品补齐
 */
export async function getRecommendations(userId, limit = 8) {
  const cached = cache.get(userId)
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.data

  const behaviors = await UserBehavior.findAll({
    where: { userId },
    order: [['id', 'DESC']],
    limit: 40,
    raw: true
  })

  let data
  if (!behaviors.length) {
    const items = await randomProducts(userId, limit)
    data = {
      source: 'random',
      basis: { categories: [], keywords: [] },
      items: items.map(serializeProduct)
    }
  } else {
    const fallback = summarize(behaviors)
    const profile = await analyzeWithLlm(behaviors, fallback)

    let items = await preferenceProducts(userId, profile, limit)
    if (items.length < limit) {
      const fill = await randomProducts(userId, limit - items.length, items.map((i) => i.id))
      items = items.concat(fill)
    }
    if (!items.length) {
      items = await randomProducts(userId, limit)
      data = { source: 'random', basis: { categories: [], keywords: [] }, items: items.map(serializeProduct) }
    } else {
      data = {
        source: profile.source,
        basis: { categories: profile.categories, keywords: profile.keywords },
        items: items.map(serializeProduct)
      }
    }
  }

  cache.set(userId, { at: Date.now(), data })
  return data
}

/** 记录搜索 / 点击行为，并清掉该用户的推荐缓存 */
export async function recordBehavior(userId, payload = {}) {
  const type = String(payload.type || '')
  if (!['search', 'click'].includes(type)) return null

  const keyword = String(payload.keyword || '').trim().slice(0, 100)
  const category = String(payload.category || '').trim().slice(0, 30)
  const productId = Number(payload.productId) || null
  if (!keyword && !category && !productId) return null

  const row = await UserBehavior.create({ userId, type, keyword, category, productId })
  clearCache(userId)
  return row
}
