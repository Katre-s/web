import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const userInfo = ref(JSON.parse(localStorage.getItem('userInfo') || 'null'))

  const isLoggedIn = computed(() => !!token.value)

  function setAuth(newToken, info) {
    token.value = newToken
    userInfo.value = info
    localStorage.setItem('token', newToken)
    localStorage.setItem('userInfo', JSON.stringify(info))
  }

  function clearAuth() {
    token.value = ''
    userInfo.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')
  }

  async function login(email, password) {
    const res = await authApi.login(email, password)
    setAuth(res.data.token, res.data.user)
    return res
  }

  async function register(nickname, realName, email, code, password) {
    const res = await authApi.register(nickname, realName, email, code, password)
    setAuth(res.data.token, res.data.user)
    return res
  }

  function logout() {
    clearAuth()
  }

  return { token, userInfo, isLoggedIn, login, register, logout, setAuth, clearAuth }
})