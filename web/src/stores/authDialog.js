// 全局登录 / 注册弹窗的开关状态
//
// 为什么不做成 pinia store：
//   路由守卫（router/index.js）和 axios 拦截器（api/request.js）都要在
//   组件之外调用它，纯响应式模块可以随时 import，不用担心 pinia 是否已 install。
import { ref } from 'vue'

export const visible = ref(false)
export const mode = ref('login') // 'login' | 'register'
export const redirect = ref('') // 登录成功后要去的路径

/**
 * 打开弹窗
 * @param {'login'|'register'} initialMode 初始显示登录还是注册
 * @param {string} target 登录成功后跳转的目标路径，留空则原地不动
 */
export function openAuthDialog(initialMode = 'login', target = '') {
  mode.value = initialMode === 'register' ? 'register' : 'login'
  redirect.value = target || ''
  visible.value = true
}

export function closeAuthDialog() {
  visible.value = false
  redirect.value = ''
}
