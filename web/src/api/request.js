import axios from 'axios'
import { ElMessage } from 'element-plus/es/components/message/index'
import { apiBaseURL } from '@/utils/env'

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
      if (!isRedirecting && window.location.pathname !== '/login') {
        isRedirecting = true
        ElMessage.error('登录已过期，请重新登录')
        setTimeout(() => {
          window.location.href = '/login'
        }, 100)
      }
    } else {
      ElMessage.error({ message: msg, duration: 2000 })
    }
    return Promise.reject(error)
  }
)

export default request