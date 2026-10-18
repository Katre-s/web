import axios from 'axios'
import sharp from 'sharp'

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
      model: process.env.AI_MODEL || 'zai-org/GLM-5.3-Flash',
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

export async function scanBookImage(imagePath) {
  const apiKey = process.env.AI_API_KEY
  const apiUrl = process.env.AI_API_URL
  if (!apiKey || !apiUrl) return null

  try {
    // 1. 图片预处理: 自动旋转 + 压缩到最长边1280 + 转JPEG(质量82)
    //    解决: 超大分辨率照片被模型拒绝 / iPhone HEIC 格式 / 模糊大图
    let buf
    try {
      buf = await sharp(imagePath, { failOn: 'none' })
        .rotate()
        .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer()
    } catch (err) {
      console.error('图片预处理失败:', err.message)
      return null
    }
    const base64 = buf.toString('base64')
    const mime = 'image/jpeg'

    // 2. 识别提示词: 封面/封底/条形码都识别, ISBN优先提取
    const prompt = `你是图书信息提取助手。这张图片可能是书籍封面、封底或 ISBN 条形码区域。请识别图片中的书籍信息，输出 JSON，格式：{"title":"书名(尽力识别,没有则为空字符串)","author":"作者(没有则为空字符串)","publisher":"出版社(没有则为空字符串)","edition":"版次(没有则为空字符串)","isbn":"ISBN号(优先从条形码数字提取,没有则为空字符串)"}。只返回 JSON，不要加其他文字。`

    // 3. 调用视觉模型, 失败自动重试1次
    let content = ''
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await axios.post(apiUrl, {
          model: 'Qwen/Qwen3-VL-8B-Instruct',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } }
            ]
          }],
          temperature: 0.1
        }, {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 45000
        })
        content = res.data.choices?.[0]?.message?.content || ''
        if (content) break
      } catch (err) {
        console.error(`视觉识别第${attempt}次失败:`, err.message)
        if (attempt === 2) return null
      }
    }

    const jsonStr = content.replace(/```json|```/g, '').trim()
    return JSON.parse(jsonStr)
  } catch (err) {
    console.error('视觉识别失败:', err.message)
    return null
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