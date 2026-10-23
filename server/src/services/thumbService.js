// 图片缩略图（按需生成 + 磁盘缓存）
//
// 背景：用户上传的原图动辄 600KB~800KB（手机直出 3~5MB 也常见），
// 首页/广场一次要渲染 20+ 张，手机 4G 下等于几 MB 的下载量，
// 表现就是「图片一直转圈 / 白块 / 干脆不出来」。
//
// 方案：不改造已有图片，也不依赖前端压缩，而是加一个旁路地址
//   /uploads/t/<宽度>/<原文件名>
// 首次请求时用 sharp 生成并落到磁盘缓存，之后直接读缓存文件。
// 相对路径的好处：Web 同源、安卓壳内拼 API 源，两种环境都能用同一套 resolveImg 逻辑。
import path from 'path'
import fs from 'fs/promises'
import fsSync from 'fs'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const UPLOAD_DIR = path.join(__dirname, '../../uploads')
// 缓存放在 .cache 而不是 uploads 里：update.sh 会整目录备份 uploads，缓存没必要跟着备份
const CACHE_DIR = path.join(__dirname, '../../.cache/thumbs')

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const MIN_W = 64
const MAX_W = 1600

// 同一张图并发请求只生成一次
const inflight = new Map()

export function normalizeWidth(raw) {
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n)) return 0
  return Math.min(MAX_W, Math.max(MIN_W, n))
}

/** 从 `/uploads/t/480/img_x.jpg` 里解出宽度和原文件名，非法返回 null */
export function parseThumbPath(rest) {
  const m = String(rest || '').match(/^t\/(\d+)\/([^/]+)$/)
  if (!m) return null
  const width = normalizeWidth(m[1])
  const name = path.basename(decodeURIComponent(m[2]))
  const ext = path.extname(name).toLowerCase()
  if (!width || !ALLOWED_EXT.has(ext)) return null
  if (name.startsWith('.') || name.includes('..')) return null
  return { width, name, ext }
}

function cacheKey(name, width, format) {
  return crypto.createHash('md5').update(`${name}|${width}|${format}`).digest('hex')
}

/**
 * 取缩略图：命中缓存直接返回路径，否则生成。
 * 失败（原图不存在/格式坏了）返回 null，由调用方回退原图。
 */
export async function getThumb(name, width, accept = '') {
  const srcPath = path.join(UPLOAD_DIR, name)
  // 确认原图真的在，避免对不存在的文件反复调用 sharp
  if (!fsSync.existsSync(srcPath)) return null

  const wantWebp = /image\/webp/i.test(accept)
  const format = wantWebp ? 'webp' : 'jpeg'
  const key = cacheKey(name, width, format)
  const outPath = path.join(CACHE_DIR, `${key}.${format}`)

  if (fsSync.existsSync(outPath)) return outPath

  if (inflight.has(key)) {
    try {
      await inflight.get(key)
    } catch {
      return null
    }
    return fsSync.existsSync(outPath) ? outPath : null
  }

  const job = (async () => {
    await fs.mkdir(CACHE_DIR, { recursive: true })
    const pipeline = sharp(srcPath, { failOn: 'none' })
      .rotate() // 尊重 EXIF 方向，手机竖拍别躺倒
      .resize({ width, withoutEnlargement: true })
    if (wantWebp) pipeline.webp({ quality: 72, effort: 4 })
    else pipeline.jpeg({ quality: 74, mozjpeg: true, progressive: true })
    // 先写临时文件再改名，避免并发读到半截图
    const tmp = `${outPath}.${process.pid}.${Date.now()}.tmp`
    await pipeline.toFile(tmp)
    await fs.rename(tmp, outPath)
  })()

  inflight.set(key, job)
  try {
    await job
    return outPath
  } catch {
    return null
  } finally {
    inflight.delete(key)
  }
}

/** 清理过期缓存（启动时跑一次即可，避免缓存目录无限长） */
export async function pruneThumbCache(maxAgeDays = 60) {
  try {
    const files = await fs.readdir(CACHE_DIR)
    const deadline = Date.now() - maxAgeDays * 24 * 3600 * 1000
    for (const f of files) {
      const p = path.join(CACHE_DIR, f)
      try {
        const st = await fs.stat(p)
        if (st.mtimeMs < deadline) await fs.unlink(p)
      } catch {}
    }
  } catch {}
}
