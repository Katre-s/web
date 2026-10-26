import axios from 'axios'
import { ElMessage } from 'element-plus/es/components/message/index'
import { apiBaseURL } from '@/utils/env'
import { openAuthDialog } from '@/stores/authDialog'

const request = axios.create({
  // Web: 同源 /api；原生壳: 绝对地址（见 utils/env.js）
  baseURL: apiBaseURL(),
  timeout: 15000
})

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRedirecting = false

request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const msg = error.response?.data?.message || '请求失败，请稍后重试'
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('userInfo')
      if (!isRedirecting) {
        isRedirecting = true
        ElMessage.error('登录已过期，请重新登录')
        // 不再跳 /login（已改成弹窗）：就地唤起登录窗，目标仍是当前页
        openAuthDialog('login', window.location.pathname + window.location.search)
        // 让 pinia 里的登录态也同步清掉（事件监听在 App.vue）
        window.dispatchEvent(new Event('auth-expired'))
        setTimeout(() => {
          isRedirecting = false
        }, 1500)
      }
    } else {
      ElMessage.error({ message: msg, duration: 2000 })
    }
    return Promise.reject(error)
  }
)

export default request