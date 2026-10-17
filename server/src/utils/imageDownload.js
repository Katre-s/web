import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.join(__dirname, '..', '..', 'uploads')

export async function downloadImage(url) {
  if (!url) return ''
  if (url.startsWith('/uploads/') || url.startsWith('data:')) return url
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 })
    if (!res.data || res.data.length < 100) return url
    let ext = 'jpg'
    if (url.includes('.png')) ext = 'png'
    else if (url.includes('.gif')) ext = 'gif'
    else if (url.includes('.webp')) ext = 'webp'
    const filename = `cover_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
    const filePath = path.join(uploadsDir, filename)
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
    fs.writeFileSync(filePath, Buffer.from(res.data))
    return `/uploads/${filename}`
  } catch {
    return url
  }
}