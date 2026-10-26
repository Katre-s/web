<template>
  <teleport to="body">
    <transition name="auth-fade">
      <div v-if="visible" class="auth-mask" @click.self="handleClose">
        <div class="auth-card" role="dialog" aria-modal="true">
          <button type="button" class="auth-close" :title="$t('common.cancel')" @click="handleClose">✕</button>

          <div class="auth-brand">
            <BrandLogo :size="34" />
            <div class="auth-brand-words">
              <b>{{ $t('login.brandName') }}</b>
              <span>XGXY · SECOND-HAND POND</span>
            </div>
          </div>

          <header class="auth-head">
            <p class="auth-eyebrow">{{ isLogin ? 'WELCOME BACK' : 'JOIN THE POND' }}</p>
            <h2>{{ isLogin ? $t('login.loginWelcome') : $t('login.regWelcome') }}</h2>
            <p class="auth-sub">{{ isLogin ? $t('login.loginHint') : $t('login.regHint') }}</p>
          </header>

          <div class="mode-switch">
            <span class="mode-thumb" :class="{ right: !isLogin }"></span>
            <button type="button" :class="{ active: isLogin }" @click="isLogin = true">{{ $t('login.submit') }}</button>
            <button type="button" :class="{ active: !isLogin }" @click="isLogin = false">{{ $t('login.submitReg') }}</button>
          </div>

          <!-- 登录 -->
          <el-form v-if="isLogin" :model="loginForm" label-position="top" @submit.prevent="handleLogin" class="auth-form">
            <el-form-item>
              <el-input v-model="loginForm.email" :placeholder="$t('login.email')" size="large" prefix-icon="Message" />
            </el-form-item>
            <el-form-item>
              <el-input
                v-model="loginForm.password"
                type="password"
                :placeholder="$t('login.password')"
                show-password
                size="large"
                prefix-icon="Lock"
                @keyup.enter="handleLogin"
              />
            </el-form-item>
            <el-button type="primary" :loading="loading" class="submit-btn" @click="handleLogin">
              {{ $t('login.submit') }}
            </el-button>
            <div class="link-row">
              <span class="forgot-link" @click="goForgot">{{ $t('login.forgot') }}</span>
            </div>
          </el-form>

          <!-- 注册 -->
          <el-form v-else :model="regForm" label-position="top" @submit.prevent="handleRegister" class="auth-form">
            <div class="field-row two">
              <el-form-item>
                <el-input v-model="regForm.nickname" placeholder="昵称" size="large" prefix-icon="User" />
              </el-form-item>
              <el-form-item>
                <el-input v-model="regForm.realName" placeholder="姓名" size="large" prefix-icon="Postcard" />
              </el-form-item>
            </div>

            <el-form-item label="所属校区" class="campus-field">
              <div class="campus-picker">
                <div
                  v-for="c in campuses"
                  :key="c"
                  class="campus-option"
                  :class="{ active: regForm.campus === c }"
                  @click="regForm.campus = c"
                >
                  <span class="campus-dot"></span>
                  <span>{{ c }}</span>
                </div>
              </div>
            </el-form-item>

            <el-form-item>
              <el-input v-model="regForm.email" placeholder="邮箱地址" size="large" prefix-icon="Message" />
            </el-form-item>
            <el-form-item>
              <div class="code-row">
                <el-input v-model="regForm.code" placeholder="验证码（6位）" size="large" prefix-icon="Key" maxlength="6" />
                <el-button :disabled="codeCooldown > 0 || sendingCode" :loading="sendingCode" class="code-btn" @click="sendCode">
                  {{ codeCooldown > 0 ? `${codeCooldown}s` : '获取验证码' }}
                </el-button>
              </div>
            </el-form-item>
            <el-form-item>
              <el-input v-model="regForm.password" type="password" :placeholder="$t('login.passwordReg')" show-password size="large" prefix-icon="Lock" />
            </el-form-item>
            <el-form-item>
              <el-input v-model="regForm.confirmPassword" type="password" :placeholder="$t('login.confirm')" show-password size="large" prefix-icon="Lock" />
            </el-form-item>
            <el-button type="primary" :loading="loading" class="submit-btn" @click="handleRegister">
              {{ $t('login.submitReg') }}
            </el-button>
          </el-form>

          <p class="switch-hint" @click="isLogin = !isLogin">
            {{ isLogin ? $t('login.toggleReg') : $t('login.toggleLogin') }}
          </p>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus/es/components/message/index'

import { useUserStore } from '@/stores/user'
import { visible, mode, redirect, closeAuthDialog } from '@/stores/authDialog'
import { authApi } from '@/api'
import BrandLogo from '@/components/BrandLogo.vue'

const userStore = useUserStore()
const router = useRouter()
const route = useRoute()

// 独立维护 isLogin，外部打开时按 openAuthDialog 的入参同步
const isLogin = ref(true)
const loading = ref(false)
const codeCooldown = ref(0)
const sendingCode = ref(false)
let cooldownTimer = null

const campuses = ['一期', '二期', '东校区']

const loginForm = ref({ email: '', password: '' })
const regForm = ref({ nickname: '', realName: '', campus: '', email: '', code: '', password: '', confirmPassword: '' })

const emailRegex = /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/

// 每次打开都按调用方指定的模式来，并回到干净状态（避免上次的密码 / 报错残留）
watch(visible, (v) => {
  if (!v) return
  isLogin.value = mode.value !== 'register'
  loading.value = false
})

function handleClose() {
  closeAuthDialog()
}

function onKeydown(e) {
  if (e.key === 'Escape' && visible.value) handleClose()
}

function goForgot() {
  const back = redirect.value
  closeAuthDialog()
  router.push({ path: '/forgot-password', query: back ? { redirect: back } : {} })
}

async function sendCode() {
  const email = regForm.value.email.trim()
  if (!email) return ElMessage.warning('请先填写邮箱地址')
  if (!emailRegex.test(email)) return ElMessage.warning('邮箱格式不正确')
  sendingCode.value = true
  try {
    await authApi.sendCode(email)
    ElMessage.success('验证码已发送至邮箱')
    codeCooldown.value = 60
    cooldownTimer = setInterval(() => {
      codeCooldown.value--
      if (codeCooldown.value <= 0) clearInterval(cooldownTimer)
    }, 1000)
  } catch {
  } finally {
    sendingCode.value = false
  }
}

// 登录/注册成功后统一收尾：关弹窗，能回目标页就回去
function afterAuth() {
  const target = redirect.value
  closeAuthDialog()
  if (!target || target === '/') return
  if (target === route.fullPath) {
    // 目标就是当前页（比如登录态过期被拦下来的订单页）：原地重载把数据拉一遍
    router.go(0)
  } else {
    router.push(target)
  }
}

async function handleLogin() {
  if (!loginForm.value.email || !loginForm.value.password) {
    return ElMessage.warning('请填写账号和密码')
  }
  loading.value = true
  try {
    await userStore.login(loginForm.value.email, loginForm.value.password)
    ElMessage.success('登录成功，欢迎回来！')
    afterAuth()
  } catch {
  } finally {
    loading.value = false
  }
}

async function handleRegister() {
  const f = regForm.value
  if (!f.nickname || !f.realName) return ElMessage.warning('请填写昵称和姓名')
  if (!f.campus) return ElMessage.warning('请选择所属校区')
  if (!f.email) return ElMessage.warning('请填写邮箱地址')
  if (!emailRegex.test(f.email)) return ElMessage.warning('邮箱格式不正确')
  if (!f.code || f.code.length !== 6) return ElMessage.warning('请输入6位验证码')
  if (!f.password || f.password.length < 6) return ElMessage.warning('密码至少6位')
  if (f.password !== f.confirmPassword) return ElMessage.warning('两次密码不一致')
  loading.value = true
  try {
    await userStore.register(f.nickname, f.realName, f.email, f.code, f.password, f.campus)
    ElMessage.success('注册成功，欢迎加入小咸鱼！')
    afterAuth()
  } catch {
  } finally {
    loading.value = false
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  if (cooldownTimer) clearInterval(cooldownTimer)
})
</script>

<style scoped>
.auth-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(10, 30, 45, 0.42);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.auth-card {
  position: relative;
  width: min(432px, 100%);
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  padding: 26px 28px 22px;
  border-radius: 22px;
  background: var(--card-bg, #fff);
  border: 1px solid var(--card-border, rgba(180, 160, 120, 0.2));
  box-shadow: 0 30px 70px -24px rgba(8, 40, 60, 0.45);
  animation: auth-card-in 0.32s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
}
@keyframes auth-card-in {
  from { opacity: 0; transform: translateY(18px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.auth-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-sub, #78909c);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s;
}
.auth-close:hover {
  background: var(--accent-soft, rgba(66, 165, 245, 0.12));
  color: var(--accent);
}

.auth-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 16px;
}
.auth-brand-words {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.auth-brand-words b {
  font-size: 15px;
  letter-spacing: 1px;
  color: var(--text-main);
}
.auth-brand-words span {
  font-size: 8.5px;
  letter-spacing: 2px;
  color: var(--text-sub, #78909c);
  opacity: 0.8;
}

.auth-head {
  margin-bottom: 16px;
}
.auth-eyebrow {
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 2.6px;
  color: var(--accent);
}
.auth-head h2 {
  margin: 6px 0 4px;
  font-size: 22px;
  letter-spacing: 1px;
  color: var(--text-main);
}
.auth-sub {
  font-size: 12.5px;
  color: var(--text-sub, #78909c);
}

.mode-switch {
  position: relative;
  display: flex;
  padding: 4px;
  margin-bottom: 16px;
  border-radius: 12px;
  background: var(--accent-soft, rgba(66, 165, 245, 0.1));
}
.mode-thumb {
  position: absolute;
  top: 4px;
  left: 4px;
  width: calc(50% - 4px);
  height: calc(100% - 8px);
  border-radius: 9px;
  background: var(--card-bg, #fff);
  box-shadow: 0 4px 12px rgba(13, 59, 79, 0.1);
  transition: transform 0.32s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
}
.mode-thumb.right {
  transform: translateX(100%);
}
.mode-switch button {
  position: relative;
  z-index: 1;
  flex: 1;
  height: 34px;
  border: 0;
  background: transparent;
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-sub, #78909c);
  border-radius: 9px;
  cursor: pointer;
  transition: color 0.25s;
}
.mode-switch button.active {
  color: var(--accent);
}

.field-row.two {
  display: flex;
  gap: 10px;
}
.field-row.two .el-form-item {
  flex: 1;
}

.campus-picker {
  display: flex;
  gap: 8px;
  width: 100%;
}
.campus-option {
  flex: 1;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 11px;
  border: 1.5px solid var(--card-border, #e2efee);
  background: transparent;
  color: var(--text-sub, #6e8a95);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
}
.campus-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--card-border, #cbdfdd);
  transition: all 0.2s ease;
}
.campus-option:hover {
  border-color: var(--accent);
}
.campus-option.active {
  border-color: var(--accent);
  background: var(--accent-soft, rgba(66, 165, 245, 0.1));
  color: var(--accent);
}
.campus-option.active .campus-dot {
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft, rgba(66, 165, 245, 0.18));
}

.code-row {
  display: flex;
  gap: 8px;
  width: 100%;
}
.code-btn {
  flex-shrink: 0;
  white-space: nowrap;
  height: 42px;
  border-radius: 11px;
  font-size: 12.5px;
}

.submit-btn {
  width: 100%;
  height: 46px;
  margin-top: 4px;
  border: 0;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 2px;
}

.link-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.forgot-link {
  font-size: 12px;
  color: var(--text-sub, #849fa9);
  cursor: pointer;
  transition: color 0.2s;
}
.forgot-link:hover {
  color: var(--accent);
}

.switch-hint {
  margin-top: 14px;
  text-align: center;
  font-size: 12.5px;
  color: var(--text-sub, #849fa9);
  cursor: pointer;
  transition: color 0.2s;
}
.switch-hint:hover {
  color: var(--accent);
}

:deep(.el-form-item) {
  margin-bottom: 12px;
}
:deep(.el-form-item__label) {
  padding-bottom: 3px !important;
  font-size: 12px;
  color: var(--text-sub, #5d7b87);
  letter-spacing: 1px;
}
:deep(.el-input__wrapper) {
  border-radius: 11px;
}
:deep(.el-input__inner) {
  height: 40px;
  font-size: 14px;
}

.auth-fade-enter-active,
.auth-fade-leave-active {
  transition: opacity 0.22s ease;
}
.auth-fade-enter-from,
.auth-fade-leave-to {
  opacity: 0;
}

@media (max-width: 520px) {
  .auth-mask {
    padding: 12px;
    align-items: flex-end;
  }
  .auth-card {
    padding: 22px 18px 18px;
    border-radius: 20px;
    max-height: calc(100vh - 24px);
  }
  .auth-head h2 {
    font-size: 20px;
  }
}
</style>
