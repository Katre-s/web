// 运行环境与接口地址统一解析
//
// 三套构建各用各的配置，避免"靠猜"：
//   - Web（浏览器）：VITE_API_BASE=/api，走站点同源反代；http / https 都安全
//   - 安卓 App（mobile）：VITE_API_BASE 直接写绝对地址（WebView 里页面源是 https://localhost）
//   - 电脑端（desktop）：VITE_API_BASE=/api + VITE_API_ORIGIN，页面源是 app://

const rawBase = import.meta.env.VITE_API_BASE || '/api'
const rawOrigin = (import.meta.env.VITE_API_ORIGIN || '').replace(/\/+$/, '')

// 兼容「VITE_API_BASE 直接写完整地址」的配置（mobile 构建就是这样）
const derivedOrigin = /^https?:\/\//i.test(rawBase) ? rawBase.replace(/\/api\/?$/, '') : ''

export const API_ORIGIN = rawOrigin || derivedOrigin

/** 原生壳：Capacitor（Android App）或非 http(s) 协议的页面源（app:// / file://） */
export function isNativeShell() {
  if (typeof window === 'undefined') return false
  if (window.Capacitor?.isNativePlatform?.()) return true
  return !/^https?:$/.test(window.location.protocol)
}

/** Capacitor 安卓默认用 https://localhost 承载本地资源，这种源也拿不到站点上的 /uploads */
export function isLocalHostOrigin() {
  if (typeof window === 'undefined') return false
  const { protocol, hostname } = window.location
  return /^https?:$/.test(protocol) && (hostname === 'localhost' || hostname === '127.0.0.1')
}

/** 图片等静态资源是否需要绝对地址（壳内 / 本机调试都算） */
export function isEmbeddedShell() {
  return isNativeShell() || isLocalHostOrigin()
}

export function apiBaseURL() {
  // mobile / desktop 构建里已写死绝对地址，直接用
  if (/^https?:\/\//i.test(rawBase)) return rawBase
  if (isNativeShell() && API_ORIGIN) return `${API_ORIGIN}/api`
  return rawBase
}
