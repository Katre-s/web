<template>
  <div class="auth-page">
    <div class="auth-left">
      <div class="floating-orb orb-1"></div>
      <div class="floating-orb orb-2"></div>
      <div class="floating-orb orb-3"></div>

      <div class="particles">
        <span v-for="n in 20" :key="n" class="particle" :style="particleStyle(n)"></span>
      </div>

      <div class="left-content">
        <div class="logo-wrap">
          <svg viewBox="0 0 100 100" width="80" height="80" class="logo-svg">
            <defs>
              <linearGradient id="bookGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#64b5f6" stop-opacity="0.9"/>
                <stop offset="100%" stop-color="#42a5f5" stop-opacity="0.6"/>
              </linearGradient>
            </defs>
            <rect x="15" y="20" width="70" height="60" rx="8" fill="none" stroke="url(#bookGrad)" stroke-width="2.5"/>
            <line x1="50" y1="20" x2="50" y2="80" stroke="url(#bookGrad)" stroke-width="2" stroke-opacity="0.5"/>
            <path d="M22 32 Q35 28 44 32" fill="none" stroke="#64b5f6" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
            <path d="M22 42 Q35 38 44 42" fill="none" stroke="#64b5f6" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
            <path d="M22 52 Q35 48 44 52" fill="none" stroke="#64b5f6" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
            <path d="M56 32 Q69 28 78 32" fill="none" stroke="#64b5f6" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
            <path d="M56 42 Q69 38 78 42" fill="none" stroke="#64b5f6" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
            <path d="M56 52 Q69 48 78 52" fill="none" stroke="#64b5f6" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
          </svg>
        </div>

        <h1 class="brand-name">文衡</h1>
        <div class="divider-line"></div>
        <p class="brand-slogan">文聚学府，百事通达</p>

        <div class="feature-tags">
          <span class="tag">ISBN 一键上架</span>
          <span class="tag">书单智能导入</span>
          <span class="tag">校园专属</span>
        </div>
      </div>

      <div class="bottom-deco">
        <div class="deco-line" v-for="n in 5" :key="n" :style="{ animationDelay: n * 0.3 + 's' }"></div>
      </div>
    </div>

    <div class="auth-right">
      <div class="auth-form-wrapper">
        <div class="form-header">
          <h2 class="form-title">{{ isLogin ? '欢迎回来' : '创建账号' }}</h2>
          <div class="title-underline"></div>
        </div>

        <transition name="form-fade" mode="out-in">
          <el-form :model="loginForm" v-if="isLogin" label-position="top" @submit.prevent="handleLogin" key="login">
            <el-form-item>
              <el-input v-model="loginForm.email" placeholder="邮箱地址" size="large" prefix-icon="Message" />
            </el-form-item>
            <el-form-item>
              <el-input v-model="loginForm.password" type="password" placeholder="密码" show-password size="large" prefix-icon="Lock" />
            </el-form-item>
            <el-button type="primary" round :loading="loading" @click="handleLogin" class="submit-btn">
              <span>登 录</span>
            </el-button>
          </el-form>

          <el-form :model="regForm" v-else label-position="top" @submit.prevent="handleRegister" key="register">
            <el-form-item>
              <el-input v-model="regForm.nickname" placeholder="昵称" size="large" prefix-icon="User" />
            </el-form-item>
            <el-form-item>
              <el-input v-model="regForm.realName" placeholder="姓名" size="large" prefix-icon="Postcard" />
            </el-form-item>
            <el-form-item>
              <el-input v-model="regForm.email" placeholder="邮箱地址" size="large" prefix-icon="Message" />
            </el-form-item>
            <el-form-item>
              <div class="code-row">
                <el-input v-model="regForm.code" placeholder="验证码" size="large" prefix-icon="Key" />
                <el-button @click="sendCode" :disabled="codeCooldown > 0" class="code-btn">
                  {{ codeCooldown > 0 ? `${codeCooldown}s` : '发送验证码' }}
                </el-button>
              </div>
            </el-form-item>
            <el-form-item>
              <el-input v-model="regForm.password" type="password" placeholder="密码" show-password size="large" prefix-icon="Lock" />
            </el-form-item>
            <el-form-item>
              <el-input v-model="regForm.confirmPassword" type="password" placeholder="确认密码" show-password size="large" prefix-icon="Lock" />
            </el-form-item>
            <el-button type="primary" round :loading="loading" @click="handleRegister" class="submit-btn">
              <span>注 册</span>
            </el-button>
          </el-form>
        </transition>

        <div class="toggle-area">
          <span class="toggle-text" @click="toggleMode">
            {{ isLogin ? '没有账号？去注册' : '已有账号？去登录' }}
          </span>
        </div>
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

function particleStyle(n) {
  const size = 3 + Math.random() * 5
  return {
    width: size + 'px',
    height: size + 'px',
    left: Math.random() * 100 + '%',
    top: Math.random() * 100 + '%',
    animationDelay: (n * 0.4) + 's',
    animationDuration: (4 + Math.random() * 4) + 's'
  }
}

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
  overflow: hidden;
}

/* ===== 左侧深色区 ===== */
.auth-left {
  flex: 1;
  background: linear-gradient(160deg, #0a1929 0%, #102a43 40%, #0d2847 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.floating-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  opacity: 0.4;
}
.orb-1 {
  width: 250px; height: 250px;
  background: radial-gradient(circle, #42a5f5, transparent);
  top: -60px; right: -60px;
  animation: float-orb 8s ease-in-out infinite;
}
.orb-2 {
  width: 200px; height: 200px;
  background: radial-gradient(circle, #1e88e5, transparent);
  bottom: -50px; left: -50px;
  animation: float-orb 10s ease-in-out infinite reverse;
}
.orb-3 {
  width: 150px; height: 150px;
  background: radial-gradient(circle, #64b5f6, transparent);
  top: 50%; left: 60%;
  animation: float-orb 6s ease-in-out infinite;
  opacity: 0.25;
}
@keyframes float-orb {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -30px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.95); }
}

.particles {
  position: absolute;
  width: 100%; height: 100%;
  pointer-events: none;
}
.particle {
  position: absolute;
  border-radius: 50%;
  background: rgba(100, 181, 246, 0.4);
  animation: float-particle linear infinite;
}
@keyframes float-particle {
  0% { transform: translateY(0) translateX(0); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateY(-120px) translateX(20px); opacity: 0; }
}

.left-content {
  text-align: center;
  z-index: 2;
  color: #fff;
  animation: fade-up 1s ease-out;
}
@keyframes fade-up {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

.logo-wrap {
  margin-bottom: 28px;
  animation: logo-pulse 4s ease-in-out infinite;
}
@keyframes logo-pulse {
  0%, 100% { transform: scale(1); filter: drop-shadow(0 0 10px rgba(100, 181, 246, 0.3)); }
  50% { transform: scale(1.05); filter: drop-shadow(0 0 20px rgba(100, 181, 246, 0.5)); }
}

.brand-name {
  font-size: 56px;
  font-weight: 800;
  letter-spacing: 12px;
  margin-bottom: 0;
  background: linear-gradient(135deg, #ffffff, #90caf9);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 0 40px rgba(100, 181, 246, 0.3);
}

.divider-line {
  width: 60px;
  height: 3px;
  background: linear-gradient(90deg, transparent, #64b5f6, transparent);
  margin: 16px auto;
  animation: line-expand 2s ease-in-out infinite;
}
@keyframes line-expand {
  0%, 100% { width: 60px; opacity: 0.6; }
  50% { width: 100px; opacity: 1; }
}

.brand-slogan {
  font-size: 18px;
  letter-spacing: 6px;
  opacity: 0.85;
  color: #b3d9f2;
}

.feature-tags {
  margin-top: 40px;
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
.tag {
  padding: 6px 16px;
  border: 1px solid rgba(100, 181, 246, 0.3);
  border-radius: 20px;
  font-size: 13px;
  color: #90caf9;
  background: rgba(100, 181, 246, 0.08);
  animation: tag-float 3s ease-in-out infinite;
}
.tag:nth-child(2) { animation-delay: 0.5s; }
.tag:nth-child(3) { animation-delay: 1s; }
@keyframes tag-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

.bottom-deco {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 80px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 4px;
  padding-bottom: 20px;
}
.deco-line {
  width: 3px;
  height: 20px;
  background: rgba(100, 181, 246, 0.2);
  border-radius: 2px;
  animation: deco-bounce 1.5s ease-in-out infinite;
}
@keyframes deco-bounce {
  0%, 100% { height: 15px; }
  50% { height: 40px; background: rgba(100, 181, 246, 0.5); }
}

/* ===== 右侧浅色区 ===== */
.auth-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #f8fbff 0%, #eef5fc 100%);
  position: relative;
}
.auth-right::before {
  content: '';
  position: absolute;
  width: 100%; height: 100%;
  background: radial-gradient(circle at 50% 30%, rgba(100, 181, 246, 0.06), transparent 60%);
}

.auth-form-wrapper {
  width: 400px;
  padding: 50px 40px;
  z-index: 1;
  animation: slide-in-right 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes slide-in-right {
  from { opacity: 0; transform: translateX(40px); }
  to { opacity: 1; transform: translateX(0); }
}

.form-header {
  margin-bottom: 36px;
}
.form-title {
  font-size: 30px;
  font-weight: 700;
  color: #0d2847;
  margin-bottom: 8px;
}
.title-underline {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(90deg, #42a5f5, #64b5f6);
  animation: underline-grow 0.8s ease-out 0.3s both;
}
@keyframes underline-grow {
  from { width: 0; }
  to { width: 40px; }
}

.form-fade-enter-active, .form-fade-leave-active {
  transition: all 0.3s ease;
}
.form-fade-enter-from { opacity: 0; transform: translateY(15px); }
.form-fade-leave-to { opacity: 0; transform: translateY(-15px); }

.code-row {
  display: flex;
  gap: 10px;
  width: 100%;
}
.code-btn {
  flex-shrink: 0;
  white-space: nowrap;
  color: #42a5f5;
  border-color: #42a5f5;
  border-radius: 12px;
  transition: all 0.3s;
}
.code-btn:hover:not(:disabled) {
  background: #42a5f5;
  color: #fff;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(66, 165, 245, 0.3);
}
.code-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.submit-btn {
  width: 100%;
  margin-top: 12px;
  height: 48px;
  font-size: 16px;
  letter-spacing: 4px;
  border: none;
  background: linear-gradient(135deg, #42a5f5, #1e88e5);
  background-size: 200% 200%;
  box-shadow: 0 4px 15px rgba(66, 165, 245, 0.35);
  transition: all 0.3s ease;
}
.submit-btn:hover {
  background-position: 100% 100%;
  box-shadow: 0 6px 25px rgba(66, 165, 245, 0.5);
  transform: translateY(-2px);
}
.submit-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(66, 165, 245, 0.3);
}

.toggle-area {
  text-align: center;
  margin-top: 28px;
}
.toggle-text {
  color: #78909c;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
  position: relative;
}
.toggle-text::after {
  content: '';
  position: absolute;
  bottom: -2px; left: 0;
  width: 0; height: 1px;
  background: #42a5f5;
  transition: width 0.3s;
}
.toggle-text:hover {
  color: #42a5f5;
}
.toggle-text:hover::after {
  width: 100%;
}

:deep(.el-input__wrapper) {
  border-radius: 14px;
  box-shadow: 0 0 0 1px #e0e7ef inset;
  transition: all 0.3s ease;
  padding: 4px 15px;
}
:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #90caf9 inset;
}
:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px #42a5f5 inset, 0 4px 12px rgba(66, 165, 245, 0.15) !important;
  transform: translateY(-1px);
}
:deep(.el-input__inner) {
  height: 44px;
  font-size: 15px;
}
:deep(.el-form-item) {
  margin-bottom: 20px;
  animation: field-enter 0.5s ease-out both;
}
:deep(.el-form-item:nth-child(1)) { animation-delay: 0.1s; }
:deep(.el-form-item:nth-child(2)) { animation-delay: 0.2s; }
:deep(.el-form-item:nth-child(3)) { animation-delay: 0.3s; }
:deep(.el-form-item:nth-child(4)) { animation-delay: 0.4s; }
:deep(.el-form-item:nth-child(5)) { animation-delay: 0.5s; }
:deep(.el-form-item:nth-child(6)) { animation-delay: 0.6s; }
@keyframes field-enter {
  from { opacity: 0; transform: translateX(15px); }
  to { opacity: 1; transform: translateX(0); }
}
</style>