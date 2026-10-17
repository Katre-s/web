import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { ElMessage } from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
import './assets/styles/main.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus)
app.mount('#app')

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
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