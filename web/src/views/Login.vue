<template>
  <div class="auth-page">
    <div class="auth-left">
      <div class="left-content">
        <div class="logo-icon">
          <svg viewBox="0 0 80 80" width="72" height="72">
            <rect x="8" y="12" width="64" height="56" rx="6" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>
            <line x1="40" y1="12" x2="40" y2="68" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
            <path d="M16 24 Q28 20 36 24" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2" stroke-linecap="round"/>
            <path d="M16 34 Q28 30 36 34" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2" stroke-linecap="round"/>
            <path d="M16 44 Q28 40 36 44" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2" stroke-linecap="round"/>
            <path d="M44 24 Q56 20 64 24" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2" stroke-linecap="round"/>
            <path d="M44 34 Q56 30 64 34" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2" stroke-linecap="round"/>
            <path d="M44 44 Q56 40 64 44" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <h1 class="brand-name">文衡</h1>
        <p class="brand-slogan">文聚学府，百事通达</p>
        <p class="brand-desc">校园二手书籍交易平台</p>
      </div>
    </div>

    <div class="auth-right">
      <div class="auth-form-wrapper">
        <h2 class="form-title">{{ isLogin ? '欢迎回来' : '创建账号' }}</h2>
        <p class="form-subtitle">{{ isLogin ? '登录以继续' : '注册一个新账号' }}</p>

        <el-form :model="loginForm" v-if="isLogin" label-position="top" @submit.prevent="handleLogin">
          <el-form-item>
            <el-input v-model="loginForm.email" placeholder="邮箱地址" size="large" />
          </el-form-item>
          <el-form-item>
            <el-input v-model="loginForm.password" type="password" placeholder="密码" show-password size="large" />
          </el-form-item>
          <el-button type="primary" round :loading="loading" @click="handleLogin" class="submit-btn">
            登录
          </el-button>
        </el-form>

        <el-form :model="regForm" v-else label-position="top" @submit.prevent="handleRegister">
          <el-form-item>
            <el-input v-model="regForm.nickname" placeholder="昵称" size="large" />
          </el-form-item>
          <el-form-item>
            <el-input v-model="regForm.realName" placeholder="姓名" size="large" />
          </el-form-item>
          <el-form-item>
            <el-input v-model="regForm.email" placeholder="邮箱地址" size="large" />
          </el-form-item>
          <el-form-item>
            <div class="code-row">
              <el-input v-model="regForm.code" placeholder="验证码" size="large" />
              <el-button @click="sendCode" :disabled="codeCooldown > 0" class="code-btn">
                {{ codeCooldown > 0 ? `${codeCooldown}s` : '发送验证码' }}
              </el-button>
            </div>
          </el-form-item>
          <el-form-item>
            <el-input v-model="regForm.password" type="password" placeholder="密码" show-password size="large" />
          </el-form-item>
          <el-form-item>
            <el-input v-model="regForm.confirmPassword" type="password" placeholder="确认密码" show-password size="large" />
          </el-form-item>
          <el-button type="primary" round :loading="loading" @click="handleRegister" class="submit-btn">
            注册
          </el-button>
        </el-form>

        <p class="toggle-text" @click="toggleMode">
          {{ isLogin ? '没有账号？去注册' : '已有账号？去登录' }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { authApi } from '@/api'

const userStore = useUserStore()
const router = useRouter()
const route = useRoute()

const isLogin = ref(true)
const loading = ref(false)
const codeCooldown = ref(0)
let cooldownTimer = null

const loginForm = ref({ email: '', password: '' })
const regForm = ref({ nickname: '', realName: '', email: '', code: '', password: '', confirmPassword: '' })

function toggleMode() {
  isLogin.value = !isLogin.value
}

async function sendCode() {
  if (!regForm.value.email) {
    ElMessage.warning('请先填写邮箱地址')
    return
  }
  try {
    await authApi.sendCode(regForm.value.email)
    ElMessage.success('验证码已发送至邮箱')
    codeCooldown.value = 60
    cooldownTimer = setInterval(() => {
      codeCooldown.value--
      if (codeCooldown.value <= 0) clearInterval(cooldownTimer)
    }, 1000)
  } catch {}
}

async function handleLogin() {
  if (!loginForm.value.email || !loginForm.value.password) {
    ElMessage.warning('请填写邮箱和密码')
    return
  }
  loading.value = true
  try {
    await userStore.login(loginForm.value.email, loginForm.value.password)
    ElMessage.success('登录成功')
    router.push(route.query.redirect || '/')
  } catch {} finally {
    loading.value = false
  }
}

async function handleRegister() {
  const f = regForm.value
  if (!f.nickname || !f.realName || !f.email || !f.code || !f.password) {
    ElMessage.warning('请填写所有字段')
    return
  }
  if (f.password !== f.confirmPassword) {
    ElMessage.warning('两次密码不一致')
    return
  }
  loading.value = true
  try {
    await userStore.register(f.nickname, f.realName, f.email, f.code, f.password)
    ElMessage.success('注册成功')
    router.push(route.query.redirect || '/')
  } catch {} finally {
    loading.value = false
  }
}

onUnmounted(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
})
</script>

<style scoped>
.auth-page {
  display: flex;
  min-height: 100vh;
  background: #e8f4fd;
}

.auth-left {
  flex: 1;
  background: linear-gradient(135deg, #4a9eff 0%, #6bb6ff 50%, #85c7ff 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}
.auth-left::before {
  content: '';
  position: absolute;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  top: -80px;
  right: -80px;
}
.auth-left::after {
  content: '';
  position: absolute;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  bottom: -60px;
  left: -60px;
}

.left-content {
  text-align: center;
  z-index: 1;
  color: #fff;
}
.logo-icon {
  margin-bottom: 24px;
}
.brand-name {
  font-size: 48px;
  font-weight: 700;
  letter-spacing: 8px;
  margin-bottom: 12px;
}
.brand-slogan {
  font-size: 18px;
  letter-spacing: 4px;
  opacity: 0.9;
  margin-bottom: 8px;
}
.brand-desc {
  font-size: 14px;
  opacity: 0.6;
  letter-spacing: 2px;
}

.auth-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f7fbff;
}
.auth-form-wrapper {
  width: 380px;
  padding: 40px;
}
.form-title {
  font-size: 28px;
  color: #1a3a5c;
  margin-bottom: 8px;
}
.form-subtitle {
  font-size: 14px;
  color: #8baec7;
  margin-bottom: 32px;
}

.code-row {
  display: flex;
  gap: 10px;
  width: 100%;
}
.code-btn {
  flex-shrink: 0;
  white-space: nowrap;
  color: #4a9eff;
  border-color: #4a9eff;
}
.code-btn:hover {
  background: #4a9eff;
  color: #fff;
}

.submit-btn {
  width: 100%;
  margin-top: 8px;
  --el-button-bg-color: #4a9eff;
  --el-button-border-color: #4a9eff;
  --el-button-hover-bg-color: #3a8eef;
  --el-button-hover-border-color: #3a8eef;
}

.toggle-text {
  text-align: center;
  margin-top: 24px;
  color: #4a9eff;
  cursor: pointer;
  font-size: 14px;
}
.toggle-text:hover {
  text-decoration: underline;
}

:deep(.el-input__wrapper) {
  border-radius: 12px;
  box-shadow: 0 0 0 1px #d0e3f5 inset;
}
:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #4a9eff inset;
}
</style>