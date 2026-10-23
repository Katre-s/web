// 语音识别（ASR）：给「和 AI 打电话」做兜底
//
// 为什么需要它：网页版一直用浏览器原生 SpeechRecognition（webkitSpeechRecognition），
// 但 Android WebView（也就是打包出来的 APK）根本不实现这个 API；
// 而且自签名 HTTPS 证书下浏览器也会拒绝麦克风。结果就是手机端通话完全打不通。
//
// 这里走另一条通用链路：前端用 MediaRecorder 录一段音频 → 上传 → 服务端转文字。
// 供应商用硅基流动的 SenseVoiceSmall，密钥复用 AI_API_KEY，无需额外配置。
import axios from 'axios'
import FormData from 'form-data'

/** 从 AI_API_URL 推导 ASR 地址；也支持用 ASR_API_URL 直接指定 */
export function asrEndpoint() {
  if (process.env.ASR_API_URL) return process.env.ASR_API_URL
  const base = process.env.AI_API_URL || process.env.CHAT_API_URL || ''
  const m = String(base).match(/^(.*)\/chat\/completions\/?$/i)
  if (m) return `${m[1]}/audio/transcriptions`
  return ''
}

export function asrReady() {
  const key = process.env.AI_API_KEY || process.env.CHAT_API_KEY
  return Boolean(key && asrEndpoint())
}

/**
 * 音频 → 文字
 * @param {Buffer} buffer 音频二进制
 * @param {string} filename 带扩展名，供应商靠它判断格式
 * @param {string} mime
 */
export async function transcribeAudio(buffer, filename = 'speech.webm', mime = 'audio/webm') {
  const apiKey = process.env.AI_API_KEY || process.env.CHAT_API_KEY
  const url = asrEndpoint()
  if (!apiKey || !url) {
    const err = new Error('语音识别未配置（缺少 AI_API_KEY / AI_API_URL）')
    err.code = 'ASR_UNCONFIGURED'
    throw err
  }

  const form = new FormData()
  form.append('file', buffer, { filename, contentType: mime })
  form.append('model', process.env.ASR_MODEL || 'FunAudioLLM/SenseVoiceSmall')

  const res = await axios.post(url, form, {
    headers: { ...form.getHeaders(), Authorization: `Bearer ${apiKey}` },
    timeout: 30000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity
  })

  const data = res.data || {}
  const text = data.text || data.data?.text || data.result || ''
  return String(text || '').trim()
}
