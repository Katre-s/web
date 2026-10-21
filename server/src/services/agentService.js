import axios from 'axios'
import { parseIntent, runAgentAction, extractTitle } from './agentTools.js'

const SYSTEM_PROMPT = `你是"文衡"二手书籍交易平台的智能助手，服务于校园学生用户。
你的职责：
1. 识别用户意图并给出简洁、有用的回答。意图分为：buy(想买书)、sell(想卖书/发布商品)、search(找书/查书)、order(订单/购物车)、help(平台使用咨询)、chat(闲聊/其他)。
2. 与平台相关的操作问题，给出具体操作指引（见下方平台使用要点）。
3. 与平台无关的闲聊、知识或生活问题，用亲切自然的语气正常回答，不要生硬拒绝。

平台使用要点：
1. 登录后可在底部「交易」页面浏览和购买二手书；求购广场里可以发布求购。
2. 卖书：点底部「发布」，填写书名、ISBN、价格即可上架，支持扫码/拍照自动识别书籍信息。
3. 买书：可用首页搜索框按书名/ISBN 查找，也可以在求购广场「上架求购」。
4. 订单：在「我的订单」查看买卖记录和状态。
5. 用户之间可通过「对话」联系对方（如求购者、卖家）。
6. 你具备直接操作能力：用户让你"加购物车/上架求购/卖书/打开某页面"时，系统会真正执行，你只需要简洁确认结果。

回答要求：语言亲切自然，简洁（一般不超过100字），必要时给出具体操作指引。
多轮对话要求：必须结合历史保持上下文连贯。用户常用"它""这本""那本""第一本""刚才那本"指代前面提到的书，要结合历史理解成具体的书名，绝对不要反问"是哪本书"，也不要把指代当成新话题。
你始终只返回一个 JSON 对象，格式：{"intent":"意图","reply":"回答内容"}，不要输出其他任何文字，不要把 JSON 包在 markdown 代码块里。`

/**
 * AI 对话入口
 * @param {string} userMessage 用户输入
 * @param {Array} history 历史消息
 * @param {{userId?:number}} options 当前登录用户（用于执行真实操作）
 */
export async function chatWithAgent(userMessage, history = [], options = {}) {
  const userId = options.userId
  const ctx = buildContext(history)

  // ① 规则引擎优先：命中"可执行动作"就直接落到数据库，
  //    这样即使本地大模型挂掉/输出乱码，AI 依然能操控后端。
  let parsed = parseIntent(userMessage)
  // 纯问价没有主语时（"那本多少钱"被 HOWTO 拦下），用上下文补主语
  if (!parsed && ctx.last && /(多少钱|什么价|价格|贵不贵|贵吗|几个卖家|有人卖)/.test(userMessage)) {
    parsed = { action: 'price_query', title: ctx.last }
  }
  parsed = resolveContext(parsed, ctx)

  if (userId && parsed) {
    try {
      const result = await runAgentAction(parsed, userId)
      if (result) return result
    } catch (err) {
      console.error('AI 工具执行失败:', err.message)
    }
  }

  const apiKey = process.env.CHAT_API_KEY || process.env.AI_API_KEY
  const apiUrl = process.env.CHAT_API_URL || process.env.AI_API_URL
  const model = process.env.CHAT_API_MODEL || process.env.AI_MODEL

  // 本地大模型(如 Ollama/LM Studio)常免密，仅当配置了 key 才带鉴权头
  if (!apiUrl) return fallbackReply(userMessage, userId)

  const ctxLine = buildContextLine(ctx)
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...(ctxLine ? [{ role: 'system', content: ctxLine }] : []),
    ...normalizeHistory(history).slice(-12),
    { role: 'user', content: userMessage }
  ]

  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  try {
    const res = await axios.post(apiUrl, {
      model: model || 'qwen2.5:7b',
      messages,
      temperature: 0.7,
      stream: false
    }, {
      headers,
      // 本地模型推理较慢，默认 60s，可用 CHAT_TIMEOUT(毫秒) 覆盖
      timeout: Number(process.env.CHAT_TIMEOUT) || 60000
    })

    const content = res.data.choices?.[0]?.message?.content || ''
    const cleaned = content.replace(/```json|```/g, '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const obj = JSON.parse(jsonMatch[0])
        return { reply: obj.reply || content, intent: obj.intent || 'chat' }
      } catch (e) {
        return { reply: content, intent: 'chat' }
      }
    }
    return { reply: content, intent: 'chat' }
  } catch (err) {
    console.error('AI 助手调用失败:', err.message)
    return fallbackReply(userMessage, userId)
  }
}

/**
 * 从历史里重建"对话上下文"：
 * - titles：按提及时间排序的书名（后提到的排后面）
 * - recent：最近一条含书名的助手回复里的书单顺序（用于"第一本/第二本"）
 */
function buildContext(history = []) {
  const titles = []
  for (const m of Array.isArray(history) ? history : []) {
    const text = String(m?.content || '')
    let names = [...text.matchAll(/[《【]([^》】]{1,60})[》】]/g)].map(x => x[1].trim())
    // 用户往往不带书名号："给我买一本数据结构" → 同样要进上下文
    if (!names.length && m?.role === 'user') {
      const guess = extractTitle(text)
      if (guess) names = [guess]
    }
    for (const t of names) {
      const idx = titles.indexOf(t)
      if (idx >= 0) titles.splice(idx, 1)
      titles.push(t)
    }
  }

  let recent = []
  let lastList = []
  for (let i = history.length - 1; i >= 0; i--) {
    // 只看最近 8 条，避免很久之前的书单误伤当前指代
    if (i < history.length - 8) break
    if (history[i]?.role !== 'assistant') continue
    const arr = [...String(history[i].content || '').matchAll(/[《【]([^》】]{1,60})[》】]/g)].map(x => x[1].trim())
    if (!arr.length) continue
    if (!recent.length) recent = arr
    if (!lastList.length && arr.length > 1) lastList = arr
    if (recent.length && lastList.length) break
  }

  return { titles, last: titles[titles.length - 1] || '', recent, lastList }
}

/** 把"它/这本/第一本"换成具体书名，再交给执行层 */
function resolveContext(parsed, ctx) {
  if (!parsed) return null
  if (parsed.ref) {
    if (parsed.ref.type === 'ordinal') {
      // "第二本"优先对上最近一次列出的书单顺序，而不是最近一句提到的那一本
      parsed.title = parsed.title || ctx.lastList[parsed.ref.index] || ctx.recent[parsed.ref.index] || ctx.last
    } else {
      parsed.title = parsed.title || ctx.last
    }
    delete parsed.ref
  }
  // 动作类指令缺书名时（"卖了吧""求购这本"），默认沿用上下文里最后提到的那本
  if (!parsed.title && ['cart_add', 'wish_add', 'publish', 'price_query'].includes(parsed.action)) {
    parsed.title = ctx.last
  }
  return parsed
}

function buildContextLine(ctx) {
  if (!ctx.titles.length) return ''
  const mentioned = ctx.titles.slice(-6).join('、')
  const order = ctx.recent.length > 1
    ? `上一轮列出的顺序：${ctx.recent.map((t, i) => `${i + 1}.${t}`).join('，')}。`
    : ''
  return `【对话上下文】本次对话提到过的书：${mentioned}。${order}用户说"它/这本/那本/第一本/最后一个"时指的就是这些书，请据此回答，不要反问书名，也不要当成新话题。`
}

function normalizeHistory(history = []) {
  return (Array.isArray(history) ? history : [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.slice(0, 600) }))
}

function fallbackReply(text, userId) {
  const nav = (path, label) => [{ type: 'navigate', path, label }]

  if (/购物车/.test(text)) {
    return { intent: 'order', reply: '在「购物车」里可以改数量、移除商品和下单；也可以直接跟我说"把《书名》加入购物车"。', actions: nav('/cart', '去购物车') }
  }
  if (/订单|买的东西/.test(text)) {
    return { intent: 'order', reply: '在「我的订单」页面可以查看你买过/卖出的所有订单和状态。', actions: nav('/orders', '查看订单') }
  }
  if (/买|购|价格/.test(text)) {
    return { intent: 'buy', reply: '你可以点击底部「交易」浏览在售书籍，也可以告诉我书名，我帮你查有没有卖家。', actions: nav('/trade', '去交易页') }
  }
  if (/卖|发布|上架/.test(text)) {
    return { intent: 'sell', reply: '点「发布」填书名、ISBN 和价格就能上架；也可以直接跟我说"卖《书名》15元"，我来帮你上架。', actions: nav('/publish', '去发布') }
  }
  if (/查|找|有没有|搜索/.test(text)) {
    return { intent: 'search', reply: '告诉我书名或 ISBN，我帮你查市场上有几个卖家。', actions: nav('/trade', '去交易页') }
  }
  return {
    intent: 'chat',
    reply: '我是文衡智能助手～可以让我：把书加进购物车、上架求购、卖二手书、找书，或者陪你聊天。',
    actions: nav('/trade', '去交易页')
  }
}
