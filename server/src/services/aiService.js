import axios from 'axios'

export async function parseBookList(text) {
  const apiKey = process.env.AI_API_KEY
  const apiUrl = process.env.AI_API_URL

  if (!apiKey || !apiUrl) {
    return parseBookListFallback(text)
  }

  try {
    const prompt = `你是一个书单解析助手。请从以下文本中提取每一本书的信息，返回 JSON 数组，每个元素包含 title(书名)、author(作者)、isbn(ISBN号，如果没有则为空字符串)。
只返回 JSON 数组，不要加其他文字。

文本内容：
${text}`

    const res = await axios.post(apiUrl, {
      model: 'glm-4-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1
    }, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 15000
    })

    const content = res.data.choices?.[0]?.message?.content || '[]'
    const jsonStr = content.replace(/```json|```/g, '').trim()
    return JSON.parse(jsonStr)
  } catch (err) {
    console.error('AI 解析失败，使用兜底:', err.message)
    return parseBookListFallback(text)
  }
}

function parseBookListFallback(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  return lines.map(line => {
    const cleaned = line.replace(/^\d+[.、\)]\s*/, '').trim()
    const parts = cleaned.split(/[-—·]/)
    return {
      title: (parts[0] || cleaned).trim(),
      author: (parts[1] || '').trim(),
      isbn: ''
    }
  }).filter(b => b.title)
}