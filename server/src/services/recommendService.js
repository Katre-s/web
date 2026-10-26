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
 * 让模型根据最近的搜索 / 浏览推断偏好。
 * 推荐是后台轻量能力：默认走云端 AI_API_*（快），避免和"本地对话模型"抢资源、避免 4s 超时。
 * 也可以用 RECOMMEND_* 单独指定端点/模型/超时；未配置或超时即回落规则。
 */
async function analyzeWithLlm(behaviors, fallback) {
  // 默认不走 LLM：云端模型偶尔超时（15s）会拖垮整个推荐接口，前端等不到就报「请求失败」，
  // 推荐区直接消失。规则聚合（按类目/关键词）已经能给出不错的结果，LLM 只作可选增强。
  // 需要开启时在 .env 里设 RECOMMEND_USE_LLM=true。
  if (String(process.env.RECOMMEND_USE_LLM || '').toLowerCase() !== 'true') {
    return { source: 'rule', ...fallback }
  }

  const apiUrl = process.env.RECOMMEND_API_URL || process.env.AI_API_URL || process.env.CHAT_API_URL
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
    const key = process.env.RECOMMEND_API_KEY || process.env.AI_API_KEY || process.env.CHAT_API_KEY
    const headers = { 'Content-Type': 'application/json' }
    if (key) headers.Authorization = `Bearer ${key}`

    const res = await axios.post(apiUrl, {
      model: process.env.RECOMMEND_API_MODEL || process.env.AI_MODEL || process.env.CHAT_API_MODEL || 'qwen2.5:7b',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      stream: false
    }, {
      headers,
      timeout: Number(process.env.RECOMMEND_TIMEOUT) || 8000
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

/**
 * 首页推荐：全站在售商品一次铺开，把用户感兴趣的排在前面。
 * 排序规则：类目命中 +3，标题/书名/描述命中行为关键词 +2；同分按上架时间最新的在前。
 * 没有任何行为记录的用户，直接按时间倒序（等同于"最新上架"）。
 */
export async function getRecommendations(userId, limit = 60) {
  const cached = cache.get(userId)
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.data

  const behaviors = await UserBehavior.findAll({
    where: { userId },
    order: [['id', 'DESC']],
    limit: 40,
    raw: true
  })

  // 有行为 → 规则（或可选 LLM）推断偏好；没有 → 空 profile，商品按时间排
  let profile = { categories: [], keywords: [] }
  if (behaviors.length) {
    const fallback = summarize(behaviors)
    profile = await analyzeWithLlm(behaviors, fallback)
  }
  const cats = profile.categories || []
  const kws = (profile.keywords || []).filter(Boolean)

  // 一次拉全站在售商品（排除自己的），内存打分排序——校园站商品量级完全撑得住
  const products = await Product.findAll({
    where: { status: 'available', userId: { [Op.ne]: userId } },
    include: productInclude(),
    order: [['created_at', 'DESC']]
  })

  let data
  if (!products.length) {
    data = { source: 'random', basis: profile, items: [] }
  } else {
    const scored = products.map((p) => {
      let score = 0
      if (cats.includes(p.category)) score += 3
      const text = `${p.title || ''}${p.bookTitle || ''}${p.description || ''}`
      for (const k of kws) if (k && text.includes(k)) score += 2
      const json = serializeProduct(p)
      return { json, score, at: new Date(json.created_at || json.createdAt || 0).getTime() || 0 }
    })
    scored.sort((a, b) => b.score - a.score || b.at - a.at)

    data = {
      // 有偏好且真的命中过才叫 rule，否则就是纯时间序
      source: behaviors.length && (cats.length || kws.length) ? 'rule' : 'time',
      basis: { categories: cats, keywords: kws },
      items: scored.slice(0, limit).map((x) => x.json)
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
