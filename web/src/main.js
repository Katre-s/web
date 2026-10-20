import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { ElMessage } from 'element-plus/es/components/message/index'
// 按需引入：全量 app.use(ElementPlus) 会把整个组件库打进主包（JS 1.2MB / CSS 370KB），
// 移动端首屏解析慢、切换卡顿。组件由 unplugin-vue-components 自动按需引入，
// 这里只需补上「手动调用」的 ElMessage / ElMessageBox 的样式。
import { ElLoading } from 'element-plus/es/components/loading/index'
import 'element-plus/es/components/loading/style/css'
import 'element-plus/theme-chalk/base.css'
import 'element-plus/theme-chalk/el-message.css'
import 'element-plus/theme-chalk/el-message-box.css'
import 'element-plus/theme-chalk/el-overlay.css'
import App from './App.vue'
import router from './router'
import i18n from './i18n'
import './assets/styles/main.css'

const app = createApp(App)
app.use(createPinia())
app.use(ElLoading) // 注册 v-loading 指令（按需引入后需要手动挂载）
app.use(router)
app.use(i18n)
app.mount('#app')

// 桌面客户端（Electron 壳）标记：用于宽屏布局与"关于/版本"等桌面专属能力
if (window.wenhengDesktop?.isDesktop) {
  document.documentElement.classList.add('is-desktop')
  document.title = '文衡 - 校园二手书籍交易'
}

// 安卓 App：优先加载线上最新版本，服务器不可达时继续用内置包（离线兜底）。
// 这样网页改完不需要重新打包 APK 也不会看到旧界面；地址在 .env.mobile 的 VITE_REMOTE_SHELL。
async function preferRemoteShell() {
  const remote = (import.meta.env.VITE_REMOTE_SHELL || '').replace(/\/+$/, '')
  if (!remote) return
  if (!window.Capacitor?.isNativePlatform?.()) return
  // 已经在线上源里了就不再跳，避免来回跳转
  if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2500)
    const res = await fetch(`${remote}/api/health?_=${Date.now()}`, { signal: controller.signal })
    clearTimeout(timer)
    if (res.ok) location.replace(`${remote}/`)
  } catch {
    // 没网/服务器挂了：保持内置包，页面照常可用
  }
}
preferRemoteShell()

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // 有新版本时立刻接管，避免用户长期停留在旧构建（旧 chunk 已删除导致白屏/卡住）
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing
        if (!worker) return
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage('skip-waiting')
          }
        })
      })
    }).catch(() => {})
  })

  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !navigator.serviceWorker.controller) return
    reloading = true
    window.location.reload()
  })
}

function initNativeShell() {
  if (!window.Capacitor?.isNativePlatform?.()) return

  try {
    const StatusBar = window.Capacitor.Plugins?.StatusBar
    StatusBar?.setOverlaysWebView?.({ overlay: false })
    StatusBar?.setBackgroundColor?.({ color: '#ffffff' })
  } catch {}

  const AppPlugin = window.Capacitor.Plugins?.App
  if (AppPlugin?.addListener) {
    let lastBackAt = 0
    AppPlugin.addListener('backButton', ({ canGoBack }) => {
      window.__backConsumed = false
      window.dispatchEvent(new CustomEvent('wenheng:back-press'))
      if (window.__backConsumed) return
      if (canGoBack) {
        window.history.back()
        return
      }
      const now = Date.now()
      if (now - lastBackAt < 2000) {
        AppPlugin.exitApp()
      } else {
        lastBackAt = now
        ElMessage({ message: '再按一次退出', type: 'info', duration: 1500 })
      }
    })
  }
}

initNativeShell()
