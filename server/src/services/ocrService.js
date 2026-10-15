import axios from 'axios'
import FormData from 'form-data'
import fs from 'fs'

async function getBaiduToken() {
  const apiKey = process.env.BAIDU_OCR_API_KEY
  const secretKey = process.env.BAIDU_OCR_SECRET_KEY
  if (!apiKey || !secretKey) return null
  try {
    const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`
    const res = await axios.post(url)
    return res.data.access_token
  } catch {
    return null
  }
}

export async function recognizeImage(imagePath) {
  const token = await getBaiduToken()
  if (!token) {
    return ''
  }
  try {
    const imageBase64 = fs.readFileSync(imagePath, { encoding: 'base64' })
    const url = `https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=${token}`
    const res = await axios.post(url, `image=${encodeURIComponent(imageBase64)}&language_type=CHN_ENG`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    const words = (res.data.words_result || []).map(w => w.words).join('\n')
    return words
  } catch (err) {
    console.error('OCR 识别失败:', err.message)
    return ''
  }
}