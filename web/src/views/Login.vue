<template>
  <div class="auth-page">
    <!-- ===== 左侧：小池塘品牌区 ===== -->
    <section class="auth-brand">
      <div class="pond">
        <span v-for="n in 16" :key="n" class="bubble" :style="bubbleStyle(n)"></span>
        <div class="light-beam"></div>
        <div class="wave wave-1"></div>
        <div class="wave wave-2"></div>
      </div>

      <div class="brand-head">
        <BrandLogo :size="46" />
        <div class="brand-words">
          <b>{{ $t('login.brandName') }}</b>
          <span>XGXY · SECOND-HAND POND</span>
        </div>
      </div>

      <div class="brand-body">
        <p class="brand-kicker">{{ $t('login.brandKicker') }}</p>
        <h1 class="brand-title">
          {{ $t('login.brandSloganTop') }}<br />
          <em>{{ $t('login.brandSloganBottom') }}</em>
        </h1>
        <p class="brand-desc">{{ $t('login.brandDesc') }}</p>

        <ul class="brand-points">
          <li>
            <i>🛡️</i>
            <div>
              <b>{{ $t('login.point1') }}</b>
              <span>{{ $t('login.point1d') }}</span>
            </div>
          </li>
          <li>
            <i>🐟</i>
            <div>
              <b>{{ $t('login.point2') }}</b>
              <span>{{ $t('login.point2d') }}</span>
            </div>
          </li>
          <li>
            <i>💸</i>
            <div>
              <b>{{ $t('login.point3') }}</b>
              <span>{{ $t('login.point3d') }}</span>
            </div>
          </li>
        </ul>
      </div>

      <div class="brand-art">
        <BrandLogo :size="196" />
      </div>

      <p class="brand-foot">{{ $t('login.brandFoot') }}</p>
    </section>

    <!-- ===== 右侧：登录 / 注册 ===== -->
    <section class="auth-panel">
      <div class="panel-card">
        <div class="panel-brand">
          <BrandLogo :size="34" />
          <b>{{ $t('login.brandName') }}</b>
        </div>

        <header class="panel-head">
          <p class="eyebrow">{{ isLogin ? 'WELCOME BACK' : 'JOIN THE POND' }}</p>
          <h2>{{ isLogin ? $t('login.loginWelcome') : $t('login.regWelcome') }}</h2>
          <p class="panel-sub">{{ isLogin ? $t('login.loginHint') : $t('login.regHint') }}</p>
        </header>

        <div class="mode-switch">
          <span class="mode-thumb" :class="{ right: !isLogin }"></span>
          <button type="button" :class="{ active: isLogin }" @click="isLogin = true">
            {{ $t('login.submit') }}
          </button>
          <button type="button" :class="{ active: !isLogin }" @click="isLogin = false">
            {{ $t('login.submitReg') }}
          </button>
        </div>

        <transition name="form-fade" mode="out-in">
          <!-- 登录 -->
          <el-form :model="loginForm" v-if="isLogin" label-position="top" @submit.prevent="handleLogin" key="login" class="auth-form">
            <el-form-item>
              <el-input v-model="loginForm.email" :placeholder="$t('login.email')" size="large" prefix-icon="Message" />
            </el-form-item>
            <el-form-item>
              <el-input v-model="loginForm.password" type="password" :placeholder="$t('login.password')" show-password size="large" prefix-icon="Lock" />
            </el-form-item>
            <el-button type="primary" :loading="loading" @click="handleLogin" class="submit-btn">
              {{ $t('login.submit') }}
              <span class="arrow">→</span>
            </el-button>
            <div class="link-row">
              <span class="forgot-link" @click="goForgot">{{ $t('login.forgot') }}</span>
            </div>
          </el-form>

          <!-- 注册 -->
          <el-form :model="regForm" v-else label-position="top" @submit.prevent="handleRegister" key="register" class="auth-form">
            <div class="field-row two">
              <el-form-item>
                <el-input v-model="regForm.nickname" placeholder="昵称" size="large" prefix-icon="User" />
              </el-form-item>
              <el-form-item>
                <el-input v-model="regForm.realName" placeholder="姓名" size="large" prefix-icon="Postcard" />
              </el-form-item>
            </div>

            <el-form-item class="campus-field">
              <template #label>
                <span class="campus-label">所属校区</span>
              </template>
              <div class="campus-picker">
                <div
                  v-for="c in campuses"
                  :key="c"
                  class="campus-option"
                  :class="{ active: regForm.campus === c }"
                  @click="regForm.campus = c"
                >
                  <span class="campus-dot"></span>
                  <span class="campus-name">{{ c }}</span>
                </div>
              </div>
            </el-form-item>

            <el-form-item>
              <el-input v-model="regForm.email" placeholder="邮箱地址" size="large" prefix-icon="Message" />
            </el-form-item>
            <el-form-item>
              <div class="code-row">
                <el-input v-model="regForm.code" placeholder="验证码（6位）" size="large" prefix-icon="Key" maxlength="6" />
                <el-button @click="sendCode" :disabled="codeCooldown > 0 || sendingCode" :loading="sendingCode" class="code-btn">
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
            <el-button type="primary" :loading="loading" @click="handleRegister" class="submit-btn">
              {{ $t('login.submitReg') }}
              <span class="arrow">→</span>
            </el-button>
          </el-form>
        </transition>

        <p class="switch-hint" @click="toggleMode">
          {{ isLogin ? $t('login.toggleReg') : $t('login.toggleLogin') }}
        </p>
      </div>

      <p class="panel-foot">{{ $t('login.brandFoot') }}</p>
    </section>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus/es/components/message/index'

import { useUserStore } from '@/stores/user'
import { authApi } from '@/api'
import BrandLogo from '@/components/BrandLogo.vue'

const userStore = useUserStore()
const router = useRouter()
const route = useRoute()

const isLogin = ref(true)
const loading = ref(false)
const codeCooldown = ref(0)
const sendingCode = ref(false)
let cooldownTimer = null

const campuses = ['一期', '二期', '东校区']

const loginForm = ref({ email: '', password: '' })
const regForm = ref({ nickname: '', realName: '', campus: '', email: '', code: '', password: '', confirmPassword: '' })

const emailRegex = /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/

function bubbleStyle(n) {
  const size = 4 + ((n * 7) % 14)
  return {
    width: size + 'px',
    height: size + 'px',
    left: (n * 13) % 92 + '%',
    top: (n * 23) % 88 + '%',
    animationDelay: (n * 0.45) % 6 + 's',
    animationDuration: 5 + (n % 5) + 's'
  }
}

function toggleMode() {
  isLogin.value = !isLogin.value
}

function goForgot() {
  router.push('/forgot-password')
}

async function sendCode() {
  const email = regForm.value.email.trim()
  if (!email) {
    ElMessage.warning('请先填写邮箱地址')
    return
  }
  if (!emailRegex.test(email)) {
    ElMessage.warning('邮箱格式不正确')
    return
  }
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

async function handleLogin() {
  if (!loginForm.value.email || !loginForm.value.password) {
    ElMessage.warning('请填写账号和密码')
    return
  }
  loading.value = true
  try {
    await userStore.login(loginForm.value.email, loginForm.value.password)
    ElMessage.success('登录成功，欢迎回来！')
    router.push(route.query.redirect || '/')
  } catch {
  } finally {
    loading.value = false
  }
}

async function handleRegister() {
  const f = regForm.value
  if (!f.nickname || !f.realName) {
    ElMessage.warning('请填写昵称和姓名')
    return
  }
  if (!f.campus) {
    ElMessage.warning('请选择所属校区')
    return
  }
  if (!f.email) {
    ElMessage.warning('请填写邮箱地址')
    return
  }
  if (!emailRegex.test(f.email)) {
    ElMessage.warning('邮箱格式不正确')
    return
  }
  if (!f.code || f.code.length !== 6) {
    ElMessage.warning('请输入6位验证码')
    return
  }
  if (!f.password || f.password.length < 6) {
    ElMessage.warning('密码至少6位')
    return
  }
  if (f.password !== f.confirmPassword) {
    ElMessage.warning('两次密码不一致')
    return
  }
  loading.value = true
  try {
    await userStore.register(f.nickname, f.realName, f.email, f.code, f.password, f.campus)
    ElMessage.success('注册成功，欢迎加入小咸鱼！')
    router.push(route.query.redirect || '/')
  } catch {
  } finally {
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
  background: #f4faf9;
}

/* ================= 左侧品牌区 ================= */
.auth-brand {
  position: relative;
  flex: 1.08;
  overflow: hidden;
  padding: 46px 56px 40px;
  display: flex;
  flex-direction: column;
  color: #eaf7f5;
  background:
    radial-gradient(120% 90% at 85% 8%, rgba(255, 154, 90, 0.28), transparent 58%),
    radial-gradient(90% 80% at 10% 90%, rgba(122, 217, 196, 0.22), transparent 60%),
    linear-gradient(155deg, #082c3b 0%, #0c4356 46%, #0f5f70 100%);
}

.pond {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.bubble {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.12) 65%);
  box-shadow: 0 0 12px rgba(160, 235, 225, 0.25);
  animation: bubble-rise ease-in-out infinite;
  opacity: 0.55;
}
@keyframes bubble-rise {
  0% { transform: translateY(12px) scale(0.8); opacity: 0; }
  35% { opacity: 0.6; }
  100% { transform: translateY(-46px) scale(1.15); opacity: 0; }
}
.light-beam {
  position: absolute;
  top: -25%;
  left: 45%;
  width: 46%;
  height: 90%;
  background: linear-gradient(180deg, rgba(255, 236, 200, 0.16), transparent 72%);
  transform: rotate(14deg);
  filter: blur(6px);
}
.wave {
  position: absolute;
  left: -20%;
  right: -20%;
  bottom: -80px;
  height: 200px;
  border-radius: 46% 54% 0 0 / 60% 60% 0 0;
  background: rgba(122, 217, 196, 0.1);
}
.wave-2 {
  bottom: -120px;
  background: rgba(122, 217, 196, 0.07);
  animation: wave-drift 12s ease-in-out infinite alternate;
}
@keyframes wave-drift {
  from { transform: translateX(-18px); }
  to { transform: translateX(18px); }
}

.brand-head {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 12px;
}
.brand-words {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}
.brand-words b {
  font-size: 21px;
  letter-spacing: 2px;
  color: #fdf7ea;
}
.brand-words span {
  font-size: 9px;
  letter-spacing: 2.4px;
  color: rgba(234, 247, 245, 0.5);
}

.brand-body {
  position: relative;
  z-index: 2;
  margin-top: auto;
  margin-bottom: auto;
  max-width: 460px;
  padding: 26px 0;
}
.brand-kicker {
  display: inline-block;
  font-size: 12px;
  letter-spacing: 3px;
  color: #7ad9c4;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(122, 217, 196, 0.35);
}
.brand-title {
  margin: 22px 0 18px;
  font-size: 52px;
  line-height: 1.24;
  font-weight: 800;
  letter-spacing: 3px;
  color: #fdf7ea;
}
.brand-title em {
  font-style: normal;
  color: #ffb877;
  position: relative;
}
.brand-title em::after {
  content: '';
  position: absolute;
  left: 2px;
  right: 2px;
  bottom: 6px;
  height: 10px;
  border-radius: 6px;
  background: rgba(255, 154, 90, 0.22);
  z-index: -1;
}
.brand-desc {
  font-size: 14px;
  line-height: 1.95;
  color: rgba(234, 247, 245, 0.68);
  max-width: 400px;
}

.brand-points {
  list-style: none;
  margin-top: 30px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.brand-points li {
  display: flex;
  align-items: center;
  gap: 12px;
}
.brand-points i {
  width: 40px;
  height: 40px;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-style: normal;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(6px);
}
.brand-points div {
  display: flex;
  flex-direction: column;
  line-height: 1.5;
}
.brand-points b {
  font-size: 14px;
  color: #f4fbfa;
}
.brand-points span {
  font-size: 12px;
  color: rgba(234, 247, 245, 0.5);
}

.brand-art {
  position: absolute;
  right: -8px;
  bottom: 76px;
  z-index: 1;
  opacity: 0.95;
  animation: fish-float 7s ease-in-out infinite;
  filter: drop-shadow(0 22px 40px rgba(0, 0, 0, 0.28));
}
@keyframes fish-float {
  0%, 100% { transform: translateY(0) rotate(-3deg); }
  50% { transform: translateY(-16px) rotate(3deg); }
}

.brand-foot {
  position: relative;
  z-index: 2;
  font-size: 11px;
  letter-spacing: 1.6px;
  color: rgba(234, 247, 245, 0.36);
}

/* ================= 右侧表单区 ================= */
.auth-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 32px;
  background:
    radial-gradient(70% 60% at 100% 0%, rgba(122, 217, 196, 0.16), transparent 60%),
    radial-gradient(60% 50% at 0% 100%, rgba(255, 184, 120, 0.14), transparent 60%),
    #f4faf9;
}

.panel-card {
  width: 100%;
  max-width: 430px;
  padding: 38px 38px 30px;
  border-radius: 26px;
  background: #ffffff;
  border: 1px solid rgba(16, 102, 122, 0.08);
  box-shadow: 0 30px 70px -30px rgba(10, 60, 75, 0.35), 0 2px 8px rgba(10, 60, 75, 0.04);
  animation: card-in 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes card-in {
  from { opacity: 0; transform: translateY(22px); }
  to { opacity: 1; transform: translateY(0); }
}

.panel-foot {
  display: none;
}

.panel-brand {
  display: none;
  align-items: center;
  gap: 9px;
  margin-bottom: 20px;
}
.panel-brand b {
  font-size: 17px;
  letter-spacing: 1px;
  color: #0d3b4f;
}

.panel-head {
  margin-bottom: 22px;
}
.eyebrow {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 3px;
  color: #1a90a0;
}
.panel-head h2 {
  margin: 8px 0 6px;
  font-size: 27px;
  letter-spacing: 1px;
  color: #0d2f3d;
}
.panel-sub {
  font-size: 13px;
  color: #7b95a0;
}

/* 登录/注册切换 */
.mode-switch {
  position: relative;
  display: flex;
  padding: 5px;
  margin-bottom: 22px;
  border-radius: 14px;
  background: #eef6f5;
}
.mode-thumb {
  position: absolute;
  top: 5px;
  left: 5px;
  width: calc(50% - 5px);
  height: calc(100% - 10px);
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 4px 12px rgba(13, 59, 79, 0.1);
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}
.mode-thumb.right {
  transform: translateX(100%);
}
.mode-switch button {
  position: relative;
  z-index: 1;
  flex: 1;
  height: 38px;
  border: 0;
  background: transparent;
  font-size: 14px;
  font-weight: 600;
  color: #7b95a0;
  cursor: pointer;
  border-radius: 10px;
  transition: color 0.25s;
  font-family: inherit;
}
.mode-switch button.active {
  color: #0d3b4f;
}

/* 表单 */
.field-row.two {
  display: flex;
  gap: 10px;
}
.field-row.two .el-form-item {
  flex: 1;
}

.campus-label {
  font-size: 12px;
  font-weight: 600;
  color: #5d7b87;
  letter-spacing: 1px;
}
.campus-picker {
  display: flex;
  gap: 10px;
  width: 100%;
}
.campus-option {
  flex: 1;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border-radius: 12px;
  border: 1.5px solid #e2efee;
  background: #f8fcfb;
  color: #6e8a95;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.22s ease;
  user-select: none;
}
.campus-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #cbdfdd;
  transition: all 0.22s ease;
}
.campus-option:hover {
  border-color: #b7ded9;
  transform: translateY(-1px);
}
.campus-option.active {
  border-color: #1a90a0;
  background: #e9f7f5;
  color: #0d5b6a;
  box-shadow: 0 4px 12px rgba(26, 144, 160, 0.14);
}
.campus-option.active .campus-dot {
  background: #1a90a0;
  box-shadow: 0 0 0 3px rgba(26, 144, 160, 0.15);
}

.code-row {
  display: flex;
  gap: 10px;
  width: 100%;
}
.code-btn {
  flex-shrink: 0;
  white-space: nowrap;
  height: 46px;
  border-radius: 12px;
  border-color: #cfe6e3;
  background: #f3fbfa;
  color: #137c88;
  font-size: 13px;
  transition: all 0.25s;
}
.code-btn:hover:not(:disabled):not(.is-loading) {
  background: #1a90a0;
  border-color: #1a90a0;
  color: #fff;
}
.code-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.submit-btn {
  width: 100%;
  height: 50px;
  margin-top: 6px;
  border: 0;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #fff;
  background: linear-gradient(135deg, #12667a 0%, #1a90a0 55%, #23a7a5 100%);
  box-shadow: 0 12px 26px -10px rgba(18, 102, 122, 0.65);
  transition: all 0.28s ease;
}
.submit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 30px -10px rgba(18, 102, 122, 0.75);
}
.submit-btn .arrow {
  display: inline-block;
  margin-left: 6px;
  transition: transform 0.28s;
}
.submit-btn:hover .arrow {
  transform: translateX(4px);
}

.link-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}
.forgot-link {
  font-size: 12.5px;
  color: #849fa9;
  cursor: pointer;
  transition: color 0.2s;
}
.forgot-link:hover {
  color: #1a90a0;
}

.switch-hint {
  margin-top: 18px;
  text-align: center;
  font-size: 13px;
  color: #849fa9;
  cursor: pointer;
  transition: color 0.2s;
}
.switch-hint:hover {
  color: #137c88;
}

/* Element Plus 细节 */
:deep(.el-form-item) {
  margin-bottom: 14px;
}
:deep(.el-form-item__label) {
  padding-bottom: 4px !important;
}
:deep(.el-input__wrapper) {
  border-radius: 12px;
  background: #f8fcfb;
  box-shadow: 0 0 0 1.5px #e2efee inset;
  padding: 3px 13px;
  transition: all 0.22s ease;
}
:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1.5px #bfe0dc inset;
}
:deep(.el-input__wrapper.is-focus) {
  background: #fff;
  box-shadow: 0 0 0 2px #1a90a0 inset, 0 6px 16px rgba(26, 144, 160, 0.12) !important;
}
:deep(.el-input__inner) {
  height: 44px;
  font-size: 14.5px;
  color: #0d2f3d;
}
:deep(.el-input__inner::placeholder) {
  color: #a9bfc6;
}

.form-fade-enter-active,
.form-fade-leave-active {
  transition: all 0.25s ease;
}
.form-fade-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.form-fade-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

@media (max-width: 1024px) {
  .auth-brand {
    flex: 1;
    padding: 36px 34px;
  }
  .brand-title {
    font-size: 42px;
  }
  .brand-art {
    right: -40px;
    bottom: 40px;
    opacity: 0.5;
  }
  .brand-art :deep(svg) {
    width: 150px !important;
    height: 150px !important;
  }
}

@media (max-width: 860px) {
  .auth-brand {
    display: none;
  }
  .auth-panel {
    flex-direction: column;
    align-items: center;
    padding: 20px 14px calc(18px + env(safe-area-inset-bottom));
  }
  .panel-foot {
    display: block;
    margin-top: auto;
    padding-top: 22px;
    font-size: 10.5px;
    letter-spacing: 1px;
    color: #9db2ba;
    text-align: center;
  }
  .panel-card {
    margin: 8px auto;
    padding: 26px 20px 22px;
    border-radius: 22px;
  }
  .panel-brand {
    display: flex;
  }
  .panel-head h2 {
    font-size: 23px;
  }
  .campus-option {
    height: 40px;
    font-size: 12px;
    gap: 5px;
  }
}
</style>
