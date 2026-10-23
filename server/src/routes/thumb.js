// 缩略图路由：/uploads/t/<宽>/<原文件名>
// 挂载在 express.static 之后，静态文件没命中才进来按需生成。
import { Router } from 'express'
import { parseThumbPath, getThumb } from '../services/thumbService.js'

const router = Router()

router.get('/t/:w/:name', async (req, res, next) => {
  try {
    const parsed = parseThumbPath(`t/${req.params.w}/${req.params.name}`)
    if (!parsed) return res.status(404).end()

    const file = await getThumb(parsed.name, parsed.width, req.headers.accept || '')
    if (!file) {
      // 原图缺失/解码失败：回退原图，前端 onImgError 还有一层兜底
      return res.redirect(302, `/uploads/${encodeURIComponent(parsed.name)}`)
    }

    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable')
    res.setHeader('Content-Type', file.endsWith('.webp') ? 'image/webp' : 'image/jpeg')
    res.sendFile(file)
  } catch (e) {
    next(e)
  }
})

export default router
