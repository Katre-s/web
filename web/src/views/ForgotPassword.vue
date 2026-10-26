<template>
  <div class="auth-page">
    <!-- ===== 左侧：小池塘品牌区（与登录页一致）===== -->
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
          <b>{{ t('login.brandName') }}</b>
          <span>XGXY · SECOND-HAND POND</span>
        </div>
      </div>

      <div class="brand-body">
        <p class="brand-kicker">{{ t('forgot.kicker') }}</p>
        <h1 class="brand-title">
          {{ t('forgot.sloganTop') }}<br />
          <em>{{ t('forgot.sloganBottom') }}</em>
        </h1>
        <p class="brand-desc">{{ t('forgot.brandDesc') }}</p>
        <ul class="brand-points">
          <li><i>🔐</i><div><b>{{ t('forgot.point1') }}</b><span>{{ t('forgot.point1d') }}</span></div></li>
          <li><i>📮</i><div><b>{{ t('forgot.point2') }}</b><span>{{ t('forgot.point2d') }}</span></div></li>
          <li><i>⚡</i><div><b>{{ t('forgot.point3') }}</b><span>{{ t('forgot.point3d') }}</span></div></li>
        </ul>
      </div>

      <div class="brand-art">
        <BrandLogo :size="196" />
      </div>
      <p class="brand-foot">{{ t('forgot.brandFoot') }}</p>
    </section>

    <!-- ===== 右侧：找回密码面板 ===== -->
    <section class="auth-panel">
      <div class="panel-card">
        <div class="panel-brand">
          <BrandLogo :size="34" />
          <b>{{ t('login.brandName') }}</b>
        </div>

        <header class="panel-head">
          <p class="eyebrow">{{ t('forgot.eyebrow') }}</p>
          <h2>{{ t('forgot.title') }}</h2>
          <p class="panel-sub">{{ t('forgot.subtitle') }}</p>
        </header>

        <!-- 步骤1：输入邮箱 -->
        <transition name="form-fade" mode="out-in">
          <div v-if="step === 1" key="s1" class="fp-step">
            <el-input v-model="email" :placeholder="t('forgot.emailPlaceholder')" size="large" prefix-icon="Message" @keyup.enter="sendCode" />
            <el-button type="primary" round :loading="sending" @click="sendCode" class="submit-btn">
              {{ t('forgot.next') }} <span class="arrow">→</span>
            </el-button>
            <div class="link-row">
              <span class="back-link" @click="goLogin">{{ t('forgot.backToLogin') }}</span>
            </div>
          </div>

          <!-- 步骤2：验证码 + 新密码 -->
          <div v-else-if="step === 2" key="s2" class="fp-step">
            <div class="fp-tip">
              <span class="fp-tip-icon">📩</span>
              {{ t('forgot.codeSentTo') }}
              <b class="fp-mail">{{ email }}</b>
            </div>
            <div class="code-row">
              <el-input v-model="code" :placeholder="t('forgot.codePlaceholder')" size="large" prefix-icon="Key" maxlength="6" />
              <el-button @click="sendCode" :disabled="codeCooldown > 0 || sending" :loading="sending" class="code-btn">
                {{ codeCooldown > 0 ? `${codeCooldown}s` : t('forgot.resend') }}
              </el-button>
            </div>
            <el-input v-model="password" type="password" :placeholder="t('forgot.newPassword')" show-password size="large" prefix-icon="Lock" />
            <el-input v-model="confirmPassword" type="password" :placeholder="t('forgot.confirmPassword')" show-password size="large" prefix-icon="Lock" />
            <el-button type="primary" round :loading="submitting" @click="handleReset" class="submit-btn">
              {{ t('forgot.submit') }} <span class="arrow">→</span>
            </el-button>
            <div class="link-row">
              <span class="back-link" @click="goLogin">{{ t('forgot.backToLogin') }}</span>
            </div>
          </div>

          <!-- 步骤3：成功 -->
          <div v-else key="s3" class="fp-step fp-done">
            <div class="fp-ok">
              <span class="fp-ok-fish">🐟</span>
            </div>
            <h3 class="fp-done-title">{{ t('forgot.successTitle') }}</h3>
            <p class="fp-done-sub">{{ t('forgot.successSub') }}</p>
            <el-button type="primary" round @click="goLogin" class="submit-btn">
              {{ t('forgot.goLogin') }} <span class="arrow">→</span>
            </el-button>
          </div>
        </transition>
      </div>
    </section>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

import { ref, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus/es/components/message/index'
import { authApi } from '@/api'
import { openAuthDialog } from '@/stores/authDialog'
import BrandLogo from '@/components/BrandLogo.vue'

const router = useRouter()
const route = useRoute()
const step = ref(1)
const email = ref('')
const code = ref('')
const password = ref('')
const confirmPassword = ref('')
const sending = ref(false)
const submitting = ref(false)
const codeCooldown = ref(0)
let cooldownTimer = null

const emailRegex = /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/

function bubbleStyle(n) {
  const left = (n * 61) % 100
  const size = 6 + (n * 13) % 12
  const delay = (n * 1.7) % 8
  const dur = 7 + (n * 2.1) % 6
  return { left: left + '%', width: size + 'px', height: size + 'px', animationDelay: delay + 's', animationDuration: dur + 's' }
}

function goLogin() {
  // 登录已是弹窗：回首页并把登录窗唤起来
  const back = route.query.redirect
  router.push('/')
  openAuthDialog('login', typeof back === 'string' ? back : '')
}

async function sendCode() {
  const mail = email.value.trim()
  if (!mail) {
    ElMessage.warning(t('forgot.enterEmail'))
    return
  }
  if (!emailRegex.test(mail)) {
    ElMessage.warning(t('forgot.invalidEmail'))
    return
  }
  sending.value = true
  try {
    await authApi.sendResetCode(mail)
    ElMessage.success(t('forgot.codeSent'))
    codeCooldown.value = 60
    cooldownTimer = setInterval(() => {
      codeCooldown.value--
      if (codeCooldown.value <= 0) clearInterval(cooldownTimer)
    }, 1000)
    step.value = 2
  } catch (err) {
    ElMessage.warning(err?.response?.data?.message || t('forgot.sendFail'))
  } finally {
    sending.value = false
  }
}

async function handleReset() {
  if (!code.value || code.value.length !== 6) {
    ElMessage.warning(t('forgot.enterCode'))
    return
  }
  if (!password.value || password.value.length < 6) {
    ElMessage.warning(t('forgot.passTooShort'))
    return
  }
  if (password.value !== confirmPassword.value) {
    ElMessage.warning(t('forgot.passMismatch'))
    return
  }
  submitting.value = true
  try {
    await authApi.resetPassword(email.value.trim(), code.value, password.value)
    step.value = 3
  } catch (err) {
    ElMessage.warning(err?.response?.data?.message || t('forgot.resetFail'))
  } finally {
    submitting.value = false
  }
}

onUnmounted(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
})
</script>

<style scoped>
/* ================= 整体布局（与登录页一致）================= */
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
  overflow: hidden;
  pointer-events: none;
}
.bubble {
  position: absolute;
  bottom: -30px;
  border-radius: 50%;
  background: radial-gradient(circle at 32% 30%, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.08));
  border: 1px solid rgba(255, 255, 255, 0.22);
  animation: bubble-rise 8s linear infinite;
  opacity: 0.5;
}
@keyframes bubble-rise {
  0% { transform: translateY(0); opacity: 0; }
  8% { opacity: 0.55; }
  92% { opacity: 0.45; }
  100% { transform: translateY(-110vh); opacity: 0; }
}
.light-beam {
  position: absolute;
  top: -20%;
  left: -8%;
  width: 64%;
  height: 150%;
  transform: rotate(16deg);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent);
  animation: beam-sway 9s ease-in-out infinite;
}
@keyframes beam-sway {
  0%, 100% { transform: rotate(14deg) translateX(-2%); }
  50% { transform: rotate(18deg) translateX(3%); }
}
.wave {
  position: absolute;
  bottom: -4px;
  left: -10%;
  width: 120%;
  height: 90px;
  opacity: 0.2;
}
.wave-1 {
  background: radial-gradient(ellipse 50% 100% at 50% 0%, rgba(190, 242, 230, 0.4), transparent);
  animation: wave-drift 8s ease-in-out infinite;
}
.wave-2 {
  background: radial-gradient(ellipse 40% 90% at 60% 0%, rgba(255, 214, 165, 0.3), transparent);
  animation: wave-drift 11s ease-in-out infinite reverse;
}
@keyframes wave-drift {
  0%, 100% { transform: translateX(-2%); }
  50% { transform: translateX(2%); }
}
.brand-head {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 2;
}
.brand-words {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.brand-words b {
  font-size: 20px;
  letter-spacing: 2px;
  color: #eaf7f5;
}
.brand-words span {
  font-size: 10px;
  letter-spacing: 3.5px;
  color: rgba(234, 247, 245, 0.65);
}
.brand-body {
  position: relative;
  margin-top: 46px;
  z-index: 2;
}
.brand-kicker {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 4px;
  color: rgba(160, 224, 210, 0.85);
  text-transform: uppercase;
  margin: 0 0 14px;
}
.brand-title {
  margin: 0 0 14px;
  font-size: 42px;
  line-height: 1.22;
  letter-spacing: 1px;
  color: #f4fcfb;
  font-weight: 800;
}
.brand-title em {
  font-style: normal;
  background: linear-gradient(100deg, #7fe3d0, #ffc98a);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.brand-desc {
  font-size: 13.5px;
  line-height: 1.7;
  color: rgba(234, 247, 245, 0.72);
  max-width: 400px;
  margin: 0 0 26px;
}
.brand-points {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 400px;
}
.brand-points li {
  display: flex;
  align-items: center;
  gap: 12px;
}
.brand-points li i {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-style: normal;
}
.brand-points li div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.brand-points li b {
  font-size: 14px;
  color: #eaf7f5;
}
.brand-points li span {
  font-size: 12px;
  color: rgba(234, 247, 245, 0.6);
}
.brand-art {
  position: absolute;
  right: -40px;
  bottom: 26px;
  opacity: 0.28;
  transform: rotate(-8deg);
  z-index: 1;
}
.brand-foot {
  margin-top: auto;
  font-size: 11px;
  letter-spacing: 1.5px;
  color: rgba(234, 247, 245, 0.45);
  z-index: 2;
}

/* ================= 右侧面板（随主题系统变色）================= */
.auth-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 32px;
  background:
    radial-gradient(70% 60% at 100% 0%, var(--accent-soft), transparent 60%),
    radial-gradient(60% 50% at 0% 100%, var(--accent-soft), transparent 60%),
    var(--page-bg, #f4faf9);
}
.panel-card {
  width: 100%;
  max-width: 430px;
  padding: 38px 38px 30px;
  border-radius: 26px;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--card-border, rgba(16, 102, 122, 0.08));
  box-shadow: 0 30px 70px -30px rgba(10, 60, 75, 0.35), 0 2px 8px rgba(10, 60, 75, 0.04);
  animation: card-in 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes card-in {
  from { opacity: 0; transform: translateY(22px); }
  to { opacity: 1; transform: translateY(0); }
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
  color: var(--text-main, #0d3b4f);
}
.panel-head {
  margin-bottom: 22px;
}
.eyebrow {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 3px;
  color: var(--accent, #1a90a0);
  text-transform: uppercase;
}
.panel-head h2 {
  margin: 8px 0 6px;
  font-size: 27px;
  letter-spacing: 1px;
  color: var(--text-main, #0d2f3d);
}
.panel-sub {
  font-size: 13px;
  color: var(--text-sub, #849fa9);
}
.fp-step {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.fp-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-sub, #0d2f3d);
  background: var(--accent-soft, #e8f5f3);
  border: 1px solid var(--card-border, rgba(16, 102, 122, 0.14));
  border-radius: 12px;
  padding: 11px 14px;
}
.fp-tip-icon { font-size: 15px; }
.fp-mail {
  color: var(--accent, #1a90a0);
  font-weight: 700;
  word-break: break-all;
}
.code-row {
  display: flex;
  gap: 10px;
}
.code-btn {
  flex-shrink: 0;
  white-space: nowrap;
  color: var(--accent, #1a90a0);
  border-color: var(--card-border, rgba(16, 102, 122, 0.3));
  border-radius: 12px;
  background: var(--card-bg, #fff);
}
.code-btn:disabled { opacity: 0.55; }
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
  background: linear-gradient(135deg, var(--accent, #12667a), var(--accent, #1a90a0) 55%, var(--accent, #23a7a5));
  box-shadow: 0 12px 26px -10px var(--accent-soft, rgba(18, 102, 122, 0.65));
  transition: transform 0.28s var(--ease-spring), box-shadow 0.28s var(--ease-smooth);
}
.submit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 30px -10px var(--accent-soft, rgba(18, 102, 122, 0.75)), 0 0 24px var(--accent-soft);
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
  justify-content: center;
  margin-top: 8px;
}
.back-link {
  font-size: 12.5px;
  color: var(--text-sub, #849fa9);
  cursor: pointer;
  transition: color 0.2s;
}
.back-link:hover {
  color: var(--accent, #1a90a0);
}
/* 成功态 */
.fp-done {
  align-items: center;
  text-align: center;
  padding: 10px 0;
}
.fp-ok {
  width: 78px;
  height: 78px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent, #1a90a0), var(--accent, #23a7a5));
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 6px auto 18px;
  font-size: 34px;
  box-shadow: 0 12px 30px var(--accent-soft, rgba(124, 179, 66, 0.4));
  animation: fp-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes fp-pop {
  from { transform: scale(0.4); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.fp-ok-fish { filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.2)); }
.fp-done-title {
  font-size: 20px;
  letter-spacing: 2px;
  color: var(--text-main, #0d2f3d);
  margin: 0 0 8px;
}
.fp-done-sub {
  font-size: 13px;
  color: var(--text-sub, #849fa9);
  margin: 0 0 22px;
}

/* Element Plus 细节（随主题）*/
:deep(.el-input__wrapper) {
  border-radius: 12px;
  background: var(--card-bg, #f8fcfb);
  box-shadow: 0 0 0 1.5px var(--card-border, #e2efee) inset;
  padding: 3px 13px;
  transition: all 0.22s ease;
}
:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1.5px var(--accent-soft, #bfe0dc) inset;
}
:deep(.el-input__wrapper.is-focus) {
  background: var(--card-bg, #fff);
  box-shadow: 0 0 0 2px var(--accent, #1a90a0) inset, 0 6px 16px var(--accent-soft) !important;
}
:deep(.el-input__inner) {
  height: 44px;
  font-size: 14.5px;
  color: var(--text-main, #0d2f3d);
}
:deep(.el-input__inner::placeholder) {
  color: var(--text-sub, #a9bfc6);
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
  .brand-title { font-size: 32px; }
}
@media (max-width: 820px) {
  .auth-brand {
    display: none;
  }
  .auth-panel {
    padding: 24px 18px;
  }
  .panel-card {
    padding: 30px 24px 24px;
  }
  .panel-brand {
    display: flex;
  }
}
</style>
