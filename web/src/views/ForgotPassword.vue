<template>
  <div class="forgot-page">
    <div class="forgot-card">
      <div class="fp-header">
        <div class="fp-seal">文</div>
        <h2>{{ t('forgot.title') }}</h2>
        <p class="fp-sub">{{ t('forgot.subtitle') }}</p>
      </div>

      <!-- 步骤1：输入邮箱 -->
      <div v-if="step === 1" class="fp-step">
        <el-input v-model="email" :placeholder="t('forgot.emailPlaceholder')" size="large" prefix-icon="Message" @keyup.enter="sendCode" />
        <el-button type="primary" round :loading="sending" @click="sendCode" class="fp-btn">
          {{ t('forgot.next') }}
        </el-button>
        <p class="fp-back"><a @click="goLogin">{{ t('forgot.backToLogin') }}</a></p>
      </div>

      <!-- 步骤2：验证码 + 新密码 -->
      <div v-else-if="step === 2" class="fp-step">
        <div class="fp-tip">{{ t('forgot.codeSentTo') }} {{ email }}</div>
        <div class="code-row">
          <el-input v-model="code" :placeholder="t('forgot.codePlaceholder')" size="large" prefix-icon="Key" maxlength="6" />
          <el-button @click="sendCode" :disabled="codeCooldown > 0 || sending" :loading="sending" class="code-btn">
            {{ codeCooldown > 0 ? `${codeCooldown}s` : t('forgot.resend') }}
          </el-button>
        </div>
        <el-input v-model="password" type="password" :placeholder="t('forgot.newPassword')" show-password size="large" prefix-icon="Lock" />
        <el-input v-model="confirmPassword" type="password" :placeholder="t('forgot.confirmPassword')" show-password size="large" prefix-icon="Lock" />
        <el-button type="primary" round :loading="submitting" @click="handleReset" class="fp-btn">
          {{ t('forgot.submit') }}
        </el-button>
      </div>

      <!-- 步骤3：成功 -->
      <div v-else class="fp-step fp-done">
        <div class="fp-ok">✓</div>
        <h3>{{ t('forgot.successTitle') }}</h3>
        <p class="fp-sub">{{ t('forgot.successSub') }}</p>
        <el-button type="primary" round @click="goLogin" class="fp-btn">{{ t('forgot.goLogin') }}</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>import { useI18n } from 'vue-i18n'
const { t } = useI18n()

import { ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus/es/components/message/index'
import { authApi } from '@/api'

const router = useRouter()
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

function goLogin() {
  router.push('/login')
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
.forgot-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(155deg, #14151c 0%, #1e2230 45%, #2a2438 100%);
  padding: 20px;
}
.forgot-card {
  width: 420px;
  max-width: 100%;
  background: linear-gradient(180deg, rgba(255, 252, 245, 0.96), rgba(250, 245, 234, 0.98));
  border-radius: 18px;
  border: 1px solid rgba(176, 150, 105, 0.28);
  box-shadow: 0 24px 60px -18px rgba(0, 0, 0, 0.5);
  padding: 40px 38px;
  animation: fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes fade-up {
  from { opacity: 0; transform: translateY(28px); }
  to { opacity: 1; transform: translateY(0); }
}
.fp-header {
  text-align: center;
  margin-bottom: 30px;
}
.fp-seal {
  width: 52px; height: 52px;
  margin: 0 auto 16px;
  background: #b5442f;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
  font-size: 28px;
  color: #f7f3ea;
  box-shadow: 0 6px 20px rgba(181, 68, 47, 0.4), inset 0 0 0 2px rgba(247, 243, 234, 0.25);
}
.fp-header h2 {
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
  font-size: 26px;
  letter-spacing: 5px;
  color: #3b3020;
  margin: 0 0 8px;
}
.fp-sub {
  color: #9a8a6c;
  font-size: 13px;
  letter-spacing: 1px;
}
.fp-step {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.fp-tip {
  font-size: 13px;
  color: #7c6438;
  background: #f6efdd;
  border: 1px solid #e4d8ba;
  border-radius: 10px;
  padding: 10px 14px;
  text-align: center;
}
.fp-btn {
  width: 100%;
  height: 48px;
  font-size: 15px;
  letter-spacing: 4px;
  border: none;
  background: linear-gradient(135deg, #a58a4b 0%, #c7a75f 50%, #a58a4b 100%);
  background-size: 200% 200%;
  box-shadow: 0 6px 18px rgba(150, 120, 60, 0.35);
  transition: all 0.35s ease;
  font-family: 'KaiTi', 'STKaiti', serif;
}
.fp-btn:hover {
  background-position: 100% 100%;
  box-shadow: 0 8px 26px rgba(150, 120, 60, 0.5);
}
.fp-back {
  text-align: center;
  margin: 4px 0 0;
}
.fp-back a {
  color: #8b7b58;
  cursor: pointer;
  font-size: 13px;
  text-decoration: none;
  border-bottom: 1px solid #bda46a;
  padding-bottom: 1px;
}
.fp-back a:hover { color: #7c6438; }
.code-row {
  display: flex;
  gap: 10px;
}
.code-btn {
  flex-shrink: 0;
  white-space: nowrap;
  color: #7c6438;
  border-color: #bda46a;
  border-radius: 12px;
  background: #faf5e8;
}
.code-btn:disabled { opacity: 0.55; }
.fp-done { align-items: center; text-align: center; padding: 10px 0; }
.fp-ok {
  width: 64px; height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7cb342, #558b2f);
  color: #fff;
  font-size: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 10px auto 16px;
  box-shadow: 0 8px 22px rgba(124, 179, 66, 0.4);
}
.fp-done h3 {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 20px;
  letter-spacing: 3px;
  color: #3b3020;
  margin: 0 0 6px;
}
:deep(.el-input__wrapper) {
  border-radius: 12px;
  box-shadow: 0 0 0 1px #dcd2ba inset;
  padding: 4px 14px;
  background: rgba(255, 253, 248, 0.85);
}
:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px #a58a4b inset;
}
:deep(.el-input__inner) { height: 44px; font-size: 15px; color: #3b3020; }
:deep(.el-input__inner::placeholder) { color: #b5a583; }
</style>
