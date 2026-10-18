import axios from 'axios'

const SYSTEM_PROMPT = `你是"文衡"二手书籍交易平台的智能助手，服务于校园学生用户。
你的职责：
1. 识别用户意图并给出简洁、有用的回答。意图分为：buy(想买书)、sell(想卖书/发布商品)、search(找书/查书)、order(订单/购物车)、help(平台使用咨询)、chat(闲聊/其他)。
2. 与平台相关的操作问题，给出具体操作指引（见下方平台使用要点）。
3. 与平台无关的闲聊、知识或生活问题，用亲切自然的语气正常回答，不要生硬拒绝，不要局限于平台内容。

意图判断规则（优先按此规则，不要用 help 覆盖以下情况）：
- 用户问"怎么卖书/如何发布/怎么上架/卖旧书/我要卖X"等与卖书、发布、上架相关的 → 一律判定为 sell；
- 用户问"怎么买书/我想买X/哪里能买"等购买相关 → 判定为 buy 或 search；
- 用户问"我的订单/查看订单/购物车"等 → 判定为 order；
- 询问平台其他规则、报错、功能说明等 → 判定为 help；
- 其他话题（闲聊、知识问答、生活琐事）→ 判定为 chat，正常回答。

平台使用要点：
1. 登录后可在底部「交易」页面浏览和购买二手书；
2. 卖书：点底部「发布」，填写书名、ISBN、价格即可上架，支持扫码/拍照自动识别书籍信息；
3. 买书：可用首页搜索框按书名/ISBN 查找，交易页「求购广场」可发布求购，也可拍照识别后一键加入求购；
4. 订单：在「我的订单」查看买卖记录和状态；
5. 用户之间可通过「对话」联系对方（如求购者、卖家）。

回答要求：语言亲切自然，简洁（一般不超过100字），必要时给出具体操作指引。
多轮对话要求：必须结合本段对话的历史记录保持上下文连贯，记住用户之前提到的内容（如想买的书名、类别、具体意图），用户用"它""那个""第一本""刚才说的"等指代时，要结合历史准确理解后回答，不要当作新话题。
你始终只返回一个 JSON 对象，格式：{"intent":"意图","reply":"回答内容"}，不要输出其他任何文字，不要把 JSON 包在 markdown 代码块里。`

export async function chatWithAgent(userMessage, history = []) {
  const apiKey = process.env.AI_API_KEY
  const apiUrl = process.env.AI_API_URL

  if (!apiKey || !apiUrl) return fallbackReply(userMessage)

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...(history || []).slice(-10),
    { role: 'user', content: userMessage }
  ]

  try {
    const res = await axios.post(apiUrl, {
      model: process.env.AI_MODEL || 'zai-org/GLM-5.3-Flash',
      messages,
      temperature: 0.7
    }, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 30000
    })

    const content = res.data.choices?.[0]?.message?.content || ''
    const cleaned = content.replace(/```json|```/g, '').trim()
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
    return fallbackReply(userMessage)
  }
}

function fallbackReply(text) {
  if (/买|购|价格/.test(text)) {
    return { intent: 'buy', reply: '你可以点击底部「交易」浏览在售书籍，或用「书单上传」一键添加想买的书。需要我帮你推荐吗？' }
  }
  if (/卖|发布|上架/.test(text)) {
    return { intent: 'sell', reply: '点击底部「发布」，填写书名、ISBN 和价格即可上架，支持 ISBN 自动识别书籍信息。' }
  }
  if (/查|找|有没有|搜索/.test(text)) {
    return { intent: 'search', reply: '在首页搜索框输入书名或 ISBN 即可查找，也可以告诉我书名，我帮你看看有没有。' }
  }
  if (/订单|购物车|买的东西/.test(text)) {
    return { intent: 'order', reply: '在「我的订单」页面可以查看你买过/卖出的所有订单和状态。' }
  }
  return { intent: 'chat', reply: '我是文衡智能助手～可以问我：怎么买书、怎么卖书、怎么查订单，或者直接和我聊天。' }
}
