import axios from 'axios'
import { parseIntent, runAgentAction, extractTitle, extractCategory, extractBudget, PAGES } from './agentTools.js'
import { TRADE_CATEGORIES } from '../config/categories.js'

// 中介模型（router）用：允许它发起工具调用，工具定义通过 tools 参数传入
const SYSTEM_PROMPT_TOOLS = `你是「徐工院小咸鱼」校园综合二手交易平台的智能助手，服务于徐州工程学院的学生。平台覆盖九大交易类目：图书、生活用品、数码产品、穿搭、出行、时尚首饰、文玩、租房、食品。你要表现得聪明、靠谱、有温度。

你的职责：
1. 既能陪聊答疑，也能按用户所说直接完成平台操作（查商品、问价、加购物车、上架发布、打开页面）。
2. 用户提到任何类目的商品都要能处理，不要只认图书；"台灯/耳机/球鞋/手串/租房"和"教材/小说"一样对待。
3. 需要执行操作时，优先调用工具（search_items / add_to_cart / list_cart / price_query / publish_item / navigate），完成后用一句话把结果告诉用户。
4. 与平台无关的闲聊、知识或生活问题，用亲切自然的语气正常回答，不要生硬拒绝。

聪明回答的准则：
- 结合对话历史理解用户真正想问什么，尤其是"它/这个/那个/第一个/刚才那个"这类指代，直接当作具体商品处理，绝不反问"是哪件"。
- 用户问"有什么好推荐/推荐点东西"这类开放问题时，直接给出 1-3 个具体商品（或书名）并说明理由，不要反问、不要只让他自己去页面找。
- 价格、在售数量等数据以工具查到的为准，准确简洁；查不到就直说"没查到"，并给出替代建议，绝不编造。
- 回答一般不超过 120 字，亲切口语化，必要时附操作指引或按钮跳转。
- 引用商品名时：图书可用《》，其他商品用「」。

平台使用要点：
1. 登录后可在底部「交易」按九大类目浏览和购买二手商品。
2. 卖东西：点底部「发布」，选择类目后填写标题、价格即可上架；图书类目支持 ISBN 查询和拍照识别。
3. 买书/买东西：可用首页搜索框按名称/ISBN 查找，也可以在「交易」里按类目浏览。
4. 订单：在「我的订单」查看买卖记录和状态；平台有余额系统，购买扣余额、售出加余额。
5. 用户之间可通过「对话」联系卖家。
6. 你具备直接操作能力：用户让你"加购物车/上架/打开某页面"时，系统会真正执行，你只需简洁确认结果。

多轮对话要求：必须结合历史保持上下文连贯。用户常用"它""这个""那个""第一个""刚才那个"指代前面提到的商品，要结合历史理解成具体名称，绝对不要反问"是哪件"，也不要把指代当成新话题。

当你要执行操作时，调用提供的工具；不需要操作时，只返回一个 JSON 对象：{"intent":"意图","reply":"回答内容"}，不要输出其他任何文字，不要把 JSON 包在 markdown 代码块里。意图可取：buy(想买)、sell(想卖/发布)、search(找东西)、order(订单/购物车)、help(平台咨询)、chat(闲聊/其他)。`

// 聊天模型（responder / 云端 DeepSeek）用：绝不出现工具调用标记
// 之前踩过的坑：这里若还写着"调用工具"，模型会在没有 tools 参数时把 <tool_call>{...}</tool_call>
// 当作正文吐出来，前端就原样显示成聊天内容了。
const SYSTEM_PROMPT_CHAT = `你是「徐工院小咸鱼」校园综合二手交易平台的智能助手，服务于徐州工程学院的学生。平台覆盖九大交易类目：图书、生活用品、数码产品、穿搭、出行、时尚首饰、文玩、租房、食品。你要表现得聪明、靠谱、有温度。

你的职责是用自然口语化的中文陪用户聊天、答疑、介绍平台用法。系统需要执行的平台操作（查商品、加购物车、上架、跳转页面）已经由后台自动完成，你只需要把结果讲清楚。

硬性要求：
1. 只输出纯文字回答。绝对不要输出 <tool_call>、函数名、JSON 调用结构、XML 标签或任何"正在调用某工具"的表述。
2. 不要假装自己调用了接口；也不要凭空承诺"我帮你查了"，除非上下文明确告诉你后台已经执行过。
3. 价格、在售数量、商品名只能来自上下文，查不到就直说没查到，绝不编造。
4. 结合对话历史理解"它/这个/那个/第一个"这类指代，绝不反问"是哪件"。
5. 回答一般不超过 120 字，亲切口语化；必要时引导用户去「交易」「发布」「订单信息」页面。
6. 引用商品名时：图书用《》，其他商品用「」。

平台要点：底部「交易」按九大类目浏览和购买；「发布」上架二手闲置，图书支持 ISBN 查询和拍照识别；「我的订单」看买卖记录，平台有余额系统；「对话」可联系卖家。

只返回一个 JSON 对象：{"intent":"意图","reply":"回答内容"}，意图可取 buy(想买)、sell(想卖/发布)、search(找东西)、order(订单/购物车)、help(平台咨询)、chat(闲聊/其他)，不要输出其他任何文字，不要把 JSON 包在 markdown 代码块里。`

/* ------------------------------ 工具定义 ------------------------------ */
// OpenAI 兼容的 function calling 描述。本地 Ollama(qwen2.5/llama3.1 等) 与 DeepSeek 都支持。
const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_items',
      description: '按关键词搜索平台在售的二手商品，支持全部九大类目（图书/生活用品/数码产品/穿搭/出行/时尚首饰/文玩/租房/食品）',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '商品名称、书名或关键词；只按类目浏览时可传类目名' },
          category: { type: 'string', enum: TRADE_CATEGORIES, description: '可选，限定类目' },
          maxPrice: { type: 'number', description: '可选，预算上限（元）' }
        },
        required: ['keyword']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_to_cart',
      description: '把平台上某个在售商品加入当前登录用户的购物车',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '要加入购物车的商品名称/书名' },
          category: { type: 'string', enum: TRADE_CATEGORIES, description: '可选，限定类目' }
        },
        required: ['keyword']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_cart',
      description: '查看当前用户购物车里有哪些商品',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'price_query',
      description: '查询某件商品当前有多少卖家在售以及价格区间',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '商品名称/书名' },
          category: { type: 'string', enum: TRADE_CATEGORIES, description: '可选，限定类目' }
        },
        required: ['keyword']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'publish_item',
      description: '帮当前用户上架发布一件二手商品（任意类目）；给了价格就直接发布，没给价格则打开预填的发布页',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '商品名称/书名' },
          price: { type: 'number', description: '售价（元），可为空' },
          category: { type: 'string', enum: TRADE_CATEGORIES, description: '类目' }
        },
        required: ['keyword']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'navigate',
      description: '打开平台中的某个页面',
      parameters: {
        type: 'object',
        properties: {
          page: { type: 'string', enum: ['购物车', '我的订单', '交易页', '发布页', '对话', '个人中心', '首页', 'AI助手'] }
        },
        required: ['page']
      }
    }
  }
]

// 有些本地模型/接口不支持 tools 参数，第一次报错后本进程内不再尝试，避免每条消息多打一次请求
let toolsUnsupported = false

/* ------------------------------ 双模型端点 ------------------------------ */
// responder：负责"聊天回复"（默认 CHAT_API_* → 云端 DeepSeek V4.1）
// router   ：负责"中介决策"（AGENT_ROUTER_* → 本地 Ollama，用工具调用决定后端操作）
// 若没配 AGENT_ROUTER_*，router 自动回退到 CHAT_*，即由云端模型兼任决策，功能不缺失。
function resolveEndpoints() {
  const chatUrl = String(process.env.CHAT_API_URL || process.env.AI_API_URL || '').trim()
  const chatKey = process.env.CHAT_API_KEY || process.env.AI_API_KEY || ''
  const chatModel = process.env.CHAT_API_MODEL || process.env.AI_MODEL || ''

  const router = {
    url: String(process.env.AGENT_ROUTER_API_URL || '').trim() || chatUrl,
    key: process.env.AGENT_ROUTER_API_KEY || chatKey,
    model: process.env.AGENT_ROUTER_API_MODEL || chatModel || 'qwen2.5:7b'
  }
  const responder = {
    url: chatUrl || router.url,
    key: chatKey || router.key,
    model: chatModel || router.model
  }
  return { router, responder }
}

// 只有"像指令"的话才劳烦本地中介判断；纯闲聊直接交给 DeepSeek，避免每条都等本地模型
const ACTION_HINT_RE = /(加|加入|放进|放到|塞进|添加到|买|卖|上架|发布|出售|下架|找|搜|查|打开|进入|跳转|带我去|多少钱|什么价|价格|贵不贵|有没有|几成新|成色|购物车|订单|推荐|好物|划算|捡漏)/

/**
 * AI 对话入口
 * @param {string} userMessage 用户输入
 * @param {Array} history 历史消息
 * @param {{userId?:number}} options 当前登录用户（用于执行真实操作）
 */
export async function chatWithAgent(userMessage, history = [], options = {}) {
  const userId = options.userId
  const ctx = buildContext(history)
  // rules: 只靠规则；hybrid: 规则优先 + 未命中时本地 router 调工具；llm: 本地 router 优先，规则兜底
  const mode = String(process.env.AGENT_TOOL_MODE || 'hybrid').toLowerCase()
  const { router, responder } = resolveEndpoints()
  const looksActionable = ACTION_HINT_RE.test(String(userMessage || ''))

  const ctxLine = buildContextLine(ctx)
  const ctxMsgs = ctxLine ? [{ role: 'system', content: ctxLine }] : []
  const baseHistory = normalizeHistory(history).slice(-12)
  const tail = { role: 'user', content: userMessage }

  // 两套上下文：router 能发起工具调用；responder 只准用文字回答
  const toolMessages = [
    { role: 'system', content: SYSTEM_PROMPT_TOOLS },
    ...ctxMsgs,
    ...baseHistory,
    tail
  ]
  const chatMessages = [
    { role: 'system', content: SYSTEM_PROMPT_CHAT },
    ...ctxMsgs,
    ...baseHistory,
    tail
  ]

  const canRoute = Boolean(router.url) && !toolsUnsupported

  // ① llm 模式：先让本地"中介"判断并调工具
  if (mode === 'llm' && looksActionable && canRoute) {
    const hit = await tryToolCalling(router, toolMessages, userId, responder, userMessage)
    if (hit) return hit
  }

  // ② 规则引擎（llm 模式放到后面兜底）
  if (mode !== 'llm') {
    const ruleHit = await tryRuleEngine(userMessage, ctx, userId, responder, chatMessages)
    if (ruleHit) return ruleHit
  }

  // ③ 规则没命中且像指令：让本地中介判断（hybrid 的主要路径；llm 模式已在 ① 试过，不重复请求）
  if (looksActionable && mode === 'hybrid' && canRoute) {
    const hit = await tryToolCalling(router, toolMessages, userId, responder, userMessage)
    if (hit) return hit
  }

  // ④ llm 模式下规则兜底
  if (mode === 'llm') {
    const ruleHit = await tryRuleEngine(userMessage, ctx, userId, responder, chatMessages)
    if (ruleHit) return ruleHit
  }

  // ⑤ 聊天回复：一律交给 responder（DeepSeek）
  if (!responder.url) return fallbackReply(userMessage, userId)
  return plainChat(responder.url, responder.key, responder.model, chatMessages, userMessage, userId)
}

/** 规则引擎：命中动作就执行并返回结果 */
async function tryRuleEngine(userMessage, ctx, userId, responder, messages) {
  let parsed = parseIntent(userMessage)
  // 纯问价没有主语时（"那件多少钱"被 HOWTO 拦下），用上下文补主语
  if (!parsed && ctx.last && /(多少钱|什么价|价格|贵不贵|贵吗|几个卖家|有人卖)/.test(userMessage)) {
    parsed = { action: 'price_query', title: ctx.last }
  }
  // 只补了预算（"预算300左右""300以内"）：沿用上一轮的类目去筛
  if (!parsed && ctx.lastCategory && /(预算|以内|以下|左右|不超过|最多|封顶|便宜点|再便宜)/.test(userMessage)) {
    const maxPrice = extractBudget(userMessage)
    if (maxPrice) parsed = { action: 'search', category: ctx.lastCategory, maxPrice }
  }
  parsed = resolveContext(parsed, ctx)
  if (!parsed || !userId) return null
  let result
  try {
    result = await runAgentAction(parsed, userId)
  } catch (err) {
    console.error('AI 工具执行失败:', err.message)
    return null
  }
  if (!result) return null
  // 后端已执行成功，默认再交给云端 DeepSeek 组织语言；设 AGENT_POLISH=off 可关掉省一次请求
  if (String(process.env.AGENT_POLISH || '').toLowerCase() === 'off') return result
  return polishReply(responder, result, parsed.action, userMessage, messages)
}

/**
 * 带工具的一次模型调用（由本地"中介"模型决策）
 * @param {{url:string,key:string,model:string}} router 本地 Ollama 端点，负责判断并调工具
 * @param {Array} messages 对话消息
 * @param {number} userId 当前用户
 * @param {{url:string,key:string,model:string}} responder 云端 DeepSeek 端点，负责把结果说人话
 * @param {string} userMessage 用户原话（给 responder 组织回复用）
 */
async function tryToolCalling(router, messages, userId, responder, userMessage) {
  if (!router?.url) return null
  const headers = { 'Content-Type': 'application/json' }
  if (router.key) headers.Authorization = `Bearer ${router.key}`

  let data
  try {
    const res = await axios.post(router.url, {
      model: router.model || 'qwen2.5:7b',
      messages,
      tools: AGENT_TOOLS,
      tool_choice: 'auto',
      temperature: 0.2,
      stream: false
    }, {
      headers,
      timeout: Number(process.env.AGENT_TIMEOUT) || Number(process.env.CHAT_TIMEOUT) || 60000
    })
    data = res.data
  } catch (err) {
    const msg = err.response?.data?.message || err.message || ''
    // 400 之类的报错通常意味着该模型不支持 tools：标记后走普通对话，不必每条都再试一次
    if (err.response?.status === 400 || /tool|function|not support|unsupported/i.test(String(msg))) {
      toolsUnsupported = true
    }
    console.warn('[AI] 本地中介模型工具调用不可用，交由规则/云端处理:', msg)
    return null
  }

  const msg = data?.choices?.[0]?.message || {}
  // ① 标准 OpenAI 协议：message.tool_calls
  let toolCalls = (Array.isArray(msg.tool_calls) ? msg.tool_calls : []).filter(Boolean)
  // ② 兼容 Qwen3 等模型的文本式调用：<tool_call>{"name":...}</tool_call> 常被塞进 reasoning / thinking / content
  if (!toolCalls.length) {
    for (const field of [msg.reasoning, msg.thinking, msg.content]) {
      const parsed = parseTextToolCalls(field)
      if (parsed.length) { toolCalls = parsed; break }
    }
  }

  // 中介模型没调工具，说明它认为这条不需要操作，交给后续规则/云端
  if (!toolCalls.length) {
    console.log('[AI] 中介未选工具，转规则/闲聊:', String(userMessage || '').slice(0, 30))
    return null
  }

  // 执行中介模型要求的工具（一般一次一件事，命中即返回）
  for (const call of toolCalls) {
    const name = call?.function?.name
    let args = {}
    try { args = JSON.parse(call?.function?.arguments || '{}') } catch { args = {} }
    console.log('[AI] 中介调用', name, JSON.stringify(args).slice(0, 160))
    const result = await runToolCall(name, args, userId)
    if (!result) continue
    // 后端已真实执行完毕，交给云端 DeepSeek 用自己的话复述给用户
    return polishReply(responder, result, name, userMessage, messages)
  }
  return null
}

/**
 * 把"后端执行结果"交给 responder（DeepSeek）生成最终聊天回复。
 * actions 永远保留后端返回的跳转按钮，不允许模型改写路径。
 */
async function polishReply(responder, result, toolName, userMessage, messages) {
  if (!responder?.url) return result

  const history = Array.isArray(messages) ? messages.slice(1, -1).slice(-6) : []
  const polishMessages = [
    {
      role: 'system',
      content: '你是「徐工院小咸鱼」校园综合二手交易平台的智能助手。系统刚刚已经替用户真实执行完一次操作，下面是执行结果。'
        + '请用亲切口语化的中文、不超过 60 字，把结果自然地告诉用户，就像你亲手做的。'
        + '严禁编造结果里没有的价格、数量、商品名；不要出现"系统""工具""接口"这类字眼；不要反问。'
        + '只输出一个 JSON 对象：{"intent":"意图","reply":"回答内容"}，意图取 buy/sell/search/order/help/chat，不要输出其他文字，不要包 markdown 代码块。'
    },
    ...history,
    { role: 'user', content: String(userMessage || '') },
    {
      role: 'system',
      content: `【后端已执行】动作=${toolName}；执行结果=${result.reply}；后端附带按钮=${(result.actions || []).map(a => a.label).join('、') || '无'}`
    }
  ]

  const raw = await requestChat(responder, polishMessages, Number(process.env.CHAT_TIMEOUT) || 60000)
  // 云端若也把 <tool_call> 之类吐出来，先洗干净再用，避免污染最终回复
  const content = raw ? stripToolTags(raw).trim() : ''
  const parsed = isMeaningfulReply(content)
    ? (parseJSONReply(content) || { reply: content.slice(0, 200), intent: '' })
    : null
  if (!parsed || !parsed.reply) return result

  return {
    intent: parsed.intent || result.intent,
    reply: parsed.reply,
    actions: result.actions || []
  }
}

/** 统一的一次 chat/completions 请求，返回文本内容或 null */
async function requestChat(endpoint, messages, timeout) {
  const headers = { 'Content-Type': 'application/json' }
  if (endpoint?.key) headers.Authorization = `Bearer ${endpoint.key}`
  try {
    const res = await axios.post(endpoint.url, {
      model: endpoint.model || 'qwen2.5:7b',
      messages,
      temperature: 0.45,
      stream: false
    }, { headers, timeout: timeout || 60000 })
    return res.data?.choices?.[0]?.message?.content || ''
  } catch (err) {
    console.error('[AI] 回复模型调用失败:', err.message)
    return null
  }
}

/**
 * 兼容"文本式工具调用"：
 * 部分模型（如 Qwen3 / 各类微调版）不走 OpenAI 的 message.tool_calls，
 * 而是输出 <tool_call>{"name":"add_to_cart","arguments":{...}}</tool_call>，
 * 甚至整段塞进 reasoning / thinking 字段、content 留空。这里把它还原成标准结构。
 */
function parseTextToolCalls(raw) {
  const text = String(raw || '')
  if (!text) return []

  const calls = []
  const blockRe = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g
  let m
  while ((m = blockRe.exec(text)) !== null) {
    const call = toToolCall(safeJSON(m[1]))
    if (call) calls.push(call)
  }
  if (calls.length) return calls

  // 没有 XML 包裹时，只认"整段就是一个紧凑的工具调用对象"，避免把正常回答误判成操作
  const compact = text.trim()
  if (compact.length <= 300 && compact.startsWith('{') && compact.endsWith('}')) {
    const call = toToolCall(safeJSON(compact))
    if (call) calls.push(call)
  }
  return calls
}

function safeJSON(str) {
  try { return JSON.parse(str) } catch { return null }
}

/** 归一化成 { function: { name, arguments(JSON字符串) } } */
function toToolCall(obj) {
  if (!obj || typeof obj !== 'object') return null
  const name = obj.name || obj.function?.name || obj.tool || obj.tool_name
  if (!name || typeof name !== 'string') return null
  let args = obj.arguments ?? obj.parameters ?? obj.args ?? obj.function?.arguments ?? {}
  if (typeof args === 'string') args = safeJSON(args) || {}
  if (!args || typeof args !== 'object') args = {}
  return { function: { name, arguments: JSON.stringify(args) } }
}

/** 把模型给出的工具名+参数映射为真实后端操作 */
async function runToolCall(name, args, userId) {
  // 各家模型对"关键词"的字段名不统一：keyword / query / q / title / name 都见过
  const keyword = String(
    args?.keyword || args?.query || args?.q || args?.keywords || args?.title || args?.name || ''
  ).trim()
  const rawCat = String(args?.category || args?.cat || '').trim()
  // 模型常把类目说成"数码""穿搭"这种简称，模糊归一回去；实在对不上就当没给
  let category = TRADE_CATEGORIES.includes(rawCat) ? rawCat : ''
  if (!category && rawCat) {
    category = TRADE_CATEGORIES.find(c => c.includes(rawCat) || rawCat.includes(c)) || ''
  }
  const maxPrice = Number(args?.maxPrice || args?.price || args?.budget) || null

  switch (name) {
    case 'search_items':
      return runAgentAction({ action: 'search', title: keyword, category, maxPrice }, userId)
    case 'add_to_cart':
      return runAgentAction({ action: 'cart_add', title: keyword, category }, userId)
    case 'list_cart':
      return runAgentAction({ action: 'cart_list' }, userId)
    case 'price_query':
      return runAgentAction({ action: 'price_query', title: keyword, category }, userId)
    case 'publish_item':
      return runAgentAction({
        action: 'publish',
        title: keyword,
        price: Number(args?.price) || null,
        category
      }, userId)
    case 'navigate':
      return runAgentAction({ action: 'navigate', page: matchPage(args?.page) }, userId)
    default:
      return null
  }
}

function matchPage(page) {
  const p = String(page || '').trim()
  if (!p) return PAGES.find(x => x.path === '/trade') || null
  return PAGES.find(x => x.keys.some(k => p.includes(k)))
    || PAGES.find(x => x.name.includes(p))
    || null
}

/** 不带工具时的普通对话（由 responder 云端模型直接回复） */
async function plainChat(apiUrl, apiKey, model, messages, userMessage, userId) {
  const content = await requestChat(
    { url: apiUrl, key: apiKey, model },
    messages,
    Number(process.env.CHAT_TIMEOUT) || 60000
  )
  if (!content) return fallbackReply(userMessage, userId)

  // 兜底①：模型把工具调用写成了正文（<tool_call>{...}</tool_call>）时，先真的去执行，
  // 别让这段 XML 原样显示在聊天窗口里。
  const textCalls = parseTextToolCalls(content)
  if (textCalls.length && userId) {
    for (const call of textCalls) {
      const name = call?.function?.name
      let args = {}
      try { args = JSON.parse(call?.function?.arguments || '{}') } catch { args = {} }
      try {
        const result = await runToolCall(name, args, userId)
        if (result) return result
      } catch (err) {
        console.error('AI 文本工具调用执行失败:', err.message)
      }
    }
  }

  // 兜底②：无论文字来自哪里，返回前都把工具/思考标签洗干净
  const clean = stripToolTags(content).trim()
  if (!isMeaningfulReply(clean)) return fallbackReply(userMessage, userId)
  return parseJSONReply(clean) || { reply: clean, intent: 'chat' }
}

/**
 * 判断模型输出洗干净后还剩不剩"有意义的话"。
 * 典型脏数据：整条内容只有一个 <tool_call>，洗掉后只剩"思考"两个字。
 */
function isMeaningfulReply(text) {
  const t = String(text || '').trim()
  if (t.length < 2) return false
  if (/^(思考|回答|回复|结果|分析|工具调用|answer|thinking|reasoning|tool)[:：。.,，]?$/i.test(t)) return false
  return true
}

function parseJSONReply(content) {
  const cleaned = stripToolTags(content)
    .replace(/```json|```/g, '')
    .trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  try {
    const obj = JSON.parse(jsonMatch[0])
    if (obj && typeof obj.reply === 'string') return { reply: obj.reply, intent: obj.intent || 'chat' }
  } catch (e) {
    // 不是合法 JSON：当作纯文本回答
  }
  return null
}

/**
 * 清洗模型输出里的工具/思考标记。
 * 起因：某些模型（以及被 system prompt 误导的模型）会把 <tool_call>{...}</tool_call>
 * 当正文吐出来，前端会原样显示成聊天内容，用户看到一堆 XML。
 */
function stripToolTags(text) {
  return String(text || '')
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
    .replace(/<\|tool_call\|>[\s\S]*?<\|\/tool_call\|>/gi, '')
    .replace(/<\|[^|]{1,20}\|>/g, '')
    .replace(/<\/?(?:tool_call|think|thinking|reasoning)>/gi, '')
    .trim()
}

/**
 * 上下文里的"名称"必须过滤掉页面/按钮类文案。
 * 之前 DeepSeek 把回复写成"已帮你打开「订单信息（含购物车）」页面"，
 * 这段被当成商品名塞进上下文，之后"帮我把加入购物车"就拿它去查库，必然查不到。
 */
const CTX_NOISE_RE = /(订单|购物车|页面|交易页|发布页|个人中心|商品页|首页|广场|对话|消息|助手|看这件|去交易)/
function cleanCtxNames(list) {
  return list.filter(n => n && n.length <= 40 && !CTX_NOISE_RE.test(n))
}

/**
 * 从历史里重建"对话上下文"：
 * - titles：按提及时间排序的名称（后提到的排后面）
 * - recent：最近一条含名称的助手回复里的列表顺序（用于"第一个/第二个"）
 */
function buildContext(history = []) {
  const titles = []
  for (const m of Array.isArray(history) ? history : []) {
    const text = String(m?.content || '')
    let names = cleanCtxNames([...text.matchAll(/[《【「]([^》】」]{1,60})[》】」]/g)].map(x => x[1].trim()))
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
    // 只看最近 8 条，避免很久之前的列表误伤当前指代
    if (i < history.length - 8) break
    if (history[i]?.role !== 'assistant') continue
    const arr = cleanCtxNames([...String(history[i].content || '').matchAll(/[《【「]([^》】」]{1,60})[》】」]/g)].map(x => x[1].trim()))
    if (!arr.length) continue
    if (!recent.length) recent = arr
    if (!lastList.length && arr.length > 1) lastList = arr
    if (recent.length && lastList.length) break
  }

  // 类目上下文：用户先问"我要租房"，接着说"预算300左右"时，
  // 规则层必须知道当前聊的是哪个类目，否则只能回一句"我没有房源信息"。
  let lastCategory = ''
  for (const m of Array.isArray(history) ? history : []) {
    const c = extractCategory(String(m?.content || ''))
    if (c) lastCategory = c
  }

  return { titles, last: titles[titles.length - 1] || '', recent, lastList, lastCategory }
}

/** 把"它/这个/第一个"换成具体名称，再交给执行层 */
function resolveContext(parsed, ctx) {
  if (!parsed) return null
  if (parsed.ref) {
    if (parsed.ref.type === 'ordinal') {
      // "第二个"优先对上最近一次列出的顺序，而不是最近一句提到的那一个
      parsed.title = parsed.title || ctx.lastList[parsed.ref.index] || ctx.recent[parsed.ref.index] || ctx.last
    } else {
      parsed.title = parsed.title || ctx.last
    }
    delete parsed.ref
  }
  // 动作类指令缺名称时（"卖了吧""就要这个"），默认沿用上下文里最后提到的那个
  if (!parsed.title && ['cart_add', 'publish', 'price_query'].includes(parsed.action)) {
    parsed.title = ctx.last
  }
  return parsed
}

function buildContextLine(ctx) {
  const parts = []
  if (ctx.lastCategory) parts.push(`本轮对话正在聊的类目是「${ctx.lastCategory}」，用户没点具体商品时按这个类目找。`)
  if (ctx.titles.length) {
    const mentioned = ctx.titles.slice(-6).join('、')
    parts.push(`提到过的商品/书名：${mentioned}。`)
  }
  if (ctx.recent.length > 1) {
    parts.push(`上一轮列出的顺序：${ctx.recent.map((t, i) => `${i + 1}.${t}`).join('，')}。`)
  }
  if (!parts.length) return ''
  return `【对话上下文】${parts.join('')}用户说"它/这个/那个/第一个/最后一个"时指的就是这些，请据此回答，不要反问名称，也不要当成新话题。`
}

function normalizeHistory(history = []) {
  return (Array.isArray(history) ? history : [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.slice(0, 600) }))
}

function fallbackReply(text, userId) {
  const nav = (path, label) => [{ type: 'navigate', path, label }]

  if (/购物车/.test(text)) {
    return { intent: 'order', reply: '在「订单信息」的购物车标签里可以移除商品、下单，确认收货后才扣余额；也可以直接跟我说"把XX加入购物车"。', actions: nav('/orders?tab=cart', '去订单信息') }
  }
  if (/订单|买的东西/.test(text)) {
    return { intent: 'order', reply: '在「我的订单」页面可以查看你买过/卖出的所有订单和状态。', actions: nav('/orders', '查看订单') }
  }
  if (/买|购|价格|多少钱/.test(text)) {
    return { intent: 'buy', reply: '你可以点击底部「交易」按类目浏览在售商品，也可以告诉我名称，我帮你查有没有卖家。', actions: nav('/trade', '去交易页') }
  }
  if (/卖|发布|上架|出售/.test(text)) {
    return { intent: 'sell', reply: '点「发布」选类目、填名称和价格就能上架；也可以直接跟我说"卖台灯30元"，我来帮你上架。', actions: nav('/publish', '去发布') }
  }
  if (/查|找|有没有|搜索/.test(text)) {
    return { intent: 'search', reply: '告诉我商品名称或 ISBN，我帮你查市场上有几个卖家。', actions: nav('/trade', '去交易页') }
  }
  return {
    intent: 'chat',
    reply: '我是小咸鱼助手～可以让我帮你找商品、把东西加进购物车、上架二手闲置，或者陪你聊天。',
    actions: nav('/trade', '去交易页')
  }
}
