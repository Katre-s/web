import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const uploadDir = path.join(__dirname, '../../uploads')
// 启动时确保上传目录存在，否则 multer 会因目录缺失而写入失败
fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const name = `img_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`
    cb(null, name)
  }
})

export const upload = multer({
  storage,
  limits: { fileSize: Number(process.env.MAX_FILE_SIZE) || 15728640 },
  fileFilter: (req, file, cb) => {
    // 放宽限制: 接受所有图片格式(含 HEIC/HEIF/BMP/TIFF)，由 sharp 预处理兜底转 JPEG
    const allowed = /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?)$/i.test(path.extname(file.originalname))
    const isImage = file.mimetype && file.mimetype.startsWith('image/')
    if (isImage || allowed) cb(null, true)
    else cb(new Error('仅支持图片文件'))
  }
})