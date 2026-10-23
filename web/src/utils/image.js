// 统一图片地址解析
//
// 背景：后端把上传图保存成 `/uploads/xxx.jpg` 这种「站内相对路径」，但在三种环境下含义不同：
//   1. 浏览器 + 同源部署：`/uploads/xxx.jpg` 由站点反向代理到后端，最优（无跨域、无混合内容）
//   2. 浏览器 + HTTPS 站点：若拼成 `http://ip:3000/uploads/...` 会被浏览器判为混合内容直接拦掉 → 手机端全白
//   3. Android 壳（capacitor://localhost / file://）：相对路径会指向壳内的本地资源 → 永远 404
//
// 所以策略是：Web 端保持相对路径（同源最稳），原生壳/本机调试才拼上 API 源；外链统一做协议升级。
import { API_ORIGIN, isEmbeddedShell } from './env'

const isAbsolute = (s) => /^(https?:)?\/\//i.test(s)
const isInline = (s) => /^(data:|blob:)/i.test(s)

export function resolveImg(src) {
  if (!src) return ''
  let s = String(src).trim()
  if (!s) return ''

  // 兼容误传 background-image 的 `url("...")` 写法
  const urlWrap = s.match(/^url\((.*)\)$/i)
  if (urlWrap) s = urlWrap[1].replace(/^['"]|['"]$/g, '').trim()

  if (isInline(s)) return s

  if (isAbsolute(s)) {
    // HTTPS 页面里的 http 外链会被浏览器以混合内容拦截，统一升级
    if (s.startsWith('http://') && typeof window !== 'undefined' && window.location.protocol === 'https:') {
      return `https://${s.slice(7)}`
    }
    return s
  }

  const path = s.startsWith('/') ? s : `/${s}`
  // 壳内（Capacitor / app:// / 本机 localhost 调试）：相对路径指向页面源，拿不到服务器图片
  if (isEmbeddedShell() && API_ORIGIN) return `${API_ORIGIN}${path}`
  // Web：保持相对路径，交给站点/开发代理处理
  return path
}

// 图片加载失败兜底：
// 同源相对路径失败时（例如前端单独部署、没配 /uploads 反代）再试一次 API 绝对地址；
// 仍失败则隐藏破图图标，交给父容器的占位样式兜底。
export function onImgError(e, onFail) {
  const el = e?.target
  if (!el || el.tagName !== 'IMG') return
  const src = el.getAttribute('src') || ''
  if (API_ORIGIN && src.startsWith('/') && el.dataset.fallbackTried !== '1') {
    el.dataset.fallbackTried = '1'
    el.src = `${API_ORIGIN}${src}`
    return
  }
  if (typeof onFail === 'function') onFail()
  else el.style.visibility = 'hidden'
}

// 兼容旧调用：模板里直接写 @error="imgFallback"
export function imgFallback(e) {
  onImgError(e)
}

// 列表/详情用缩略图：把 `/uploads/x.jpg` 换成 `/uploads/t/480/x.jpg`
// 后端按需生成并缓存（480w 的 webp 只有 16KB，原图 600KB+），手机端弱网才不会全白。
// 头像、外链、data/blob 一律原样返回。
const UPLOAD_RE = /\/uploads\/(?!t\/)([^/?#]+)(\?[^#]*)?$/

export function thumb(src, w = 480) {
  const u = resolveImg(src)
  if (!u || isInline(u)) return u
  const m = u.match(UPLOAD_RE)
  if (!m) return u
  return u.replace(UPLOAD_RE, `/uploads/t/${w}/${m[1]}${m[2] || ''}`)
}

// 详情页大图：1200w 足够看清（约 48KB），需要原图时再单独取
export function thumbLarge(src) {
  return thumb(src, 1200)
}

export default resolveImg
