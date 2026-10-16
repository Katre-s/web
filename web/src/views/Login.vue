<template>
  <div class="auth-page">
    <!-- ===== 左侧：墨韵 · 书法区 ===== -->
    <div class="auth-left">
      <div class="ink-wash ink-wash-1"></div>
      <div class="ink-wash ink-wash-2"></div>
      <div class="ink-wash ink-wash-3"></div>
      <div class="mountain-silhouette"></div>

      <div class="ink-ripple-layer">
        <span v-for="n in 14" :key="n" class="ink-ripple" :style="rippleStyle(n)"></span>
      </div>

      <div class="left-content">
        <div class="seal-logo">
          <span>文</span>
        </div>

        <h1 class="calligraphy-title">文 衡</h1>
        <div class="ornament-line">
          <i></i><b></b><i></i>
        </div>
        <p class="brand-slogan">文聚学府 · 百事通达</p>

        <div class="vertical-poem">
          <span>萬</span>
          <span>卷</span>
          <span>诗</span>
          <span>书</span>
          <span>传</span>
          <span>雅</span>
          <span>韵</span>
        </div>

        <div class="literary-tags">
          <span class="ltag">📖 ISBN 一键上架</span>
          <span class="ltag">🖋 书单智能导入</span>
          <span class="ltag">🏮 校园专属</span>
        </div>

        <p class="left-footer">—— 学生 · 书友 · 校园交易平台 ——</p>
      </div>

      <div class="dangling-tassel">
        <div class="tassel-line"></div>
        <div class="tassel-knot"></div>
        <div class="tassel-fringe"></div>
      </div>
    </div>

    <!-- ===== 右侧：宣纸 · 表单区 ===== -->
    <div class="auth-right">
      <div class="paper-texture"></div>
      <div class="corner-badge">文衡</div>
      <div class="ink-splatter"></div>
      <div class="right-poem">
        <p>非学无以广才</p>
        <p>非志无以成学</p>
      </div>

      <div class="auth-form-wrapper">
        <div class="form-header">
          <h2 class="form-title">{{ isLogin ? '欢迎归来' : '雅集新友' }}</h2>
          <div class="title-ornament">
            <span class="to-line"></span>
            <span class="to-dot"></span>
            <span class="to-line"></span>
          </div>
          <p class="form-subtitle">{{ isLogin ? '登录以续写你的藏书雅集' : '加入文衡，开启你的笔墨与书缘' }}</p>
        </div>

        <transition name="form-fade" mode="out-in">
          <!-- 登录 -->
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

          <!-- 注册 -->
          <el-form :model="regForm" v-else label-position="top" @submit.prevent="handleRegister" key="register">
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
                  <span class="campus-icon">
                    <svg v-if="c === '一期'" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 18v-6a2 2 0 0 1 2-2h3v8H3z M8 10h8M8 10v8h8v-8M16 12a5 5 0 0 1 5 5v1h-5"/></svg>
                    <svg v-else-if="c === '二期'" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M3 12l4-4M3 12l4 4M21 12l-4-4M21 12l-4 4"/></svg>
                    <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20v-8l8-7 8 7v8M4 12h16M9 20v-6h6v6"/></svg>
                  </span>
                  <span class="campus-name">{{ c }}</span>
                  <span class="campus-check" v-if="regForm.campus === c">✓</span>
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
              <el-input v-model="regForm.password" type="password" placeholder="密码（至少6位）" show-password size="large" prefix-icon="Lock" />
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
            {{ isLogin ? '尚未入会？前往注册' : '已是雅士？直接登录' }}
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
const sendingCode = ref(false)
let cooldownTimer = null

const campuses = ['一期', '二期', '东校区']

const loginForm = ref({ email: '', password: '' })
const regForm = ref({ nickname: '', realName: '', campus: '', email: '', code: '', password: '', confirmPassword: '' })

const emailRegex = /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/

function rippleStyle(n) {
  return {
    left: Math.random() * 100 + '%',
    top: Math.random() * 100 + '%',
    animationDelay: (n * 0.7) + 's',
    animationDuration: (6 + Math.random() * 5) + 's'
  }
}

function toggleMode() {
  isLogin.value = !isLogin.value
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
    ElMessage.warning('请填写邮箱和密码')
    return
  }
  loading.value = true
  try {
    await userStore.login(loginForm.value.email, loginForm.value.password)
    ElMessage.success('登录成功')
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
    ElMessage.success('注册成功，欢迎加入文衡！')
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
  overflow: hidden;
}

/* ================= 左侧：墨韵书法区 ================= */
.auth-left {
  flex: 1.15;
  background: linear-gradient(155deg, #14151c 0%, #1e2230 45%, #2a2438 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.ink-wash {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.35;
}
.ink-wash-1 {
  width: 380px; height: 380px;
  background: radial-gradient(circle, rgba(120, 108, 180, 0.5), transparent 70%);
  top: -80px; left: -80px;
  animation: ink-drift 12s ease-in-out infinite;
}
.ink-wash-2 {
  width: 320px; height: 320px;
  background: radial-gradient(circle, rgba(60, 90, 130, 0.5), transparent 70%);
  bottom: -60px; right: -60px;
  animation: ink-drift 16s ease-in-out infinite reverse;
}
.ink-wash-3 {
  width: 220px; height: 220px;
  background: radial-gradient(circle, rgba(150, 132, 90, 0.35), transparent 70%);
  top: 55%; left: 58%;
  animation: ink-drift 9s ease-in-out infinite;
}
@keyframes ink-drift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(36px, -28px) scale(1.15); }
  66% { transform: translate(-24px, 22px) scale(0.9); }
}

.mountain-silhouette {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 30%;
  background: linear-gradient(180deg, transparent, rgba(10, 12, 18, 0.55) 40%);
  clip-path: polygon(0 100%, 0 55%, 12% 42%, 22% 55%, 33% 30%, 45% 52%, 56% 35%, 66% 55%, 78% 28%, 88% 50%, 100% 40%, 100% 100%);
  opacity: 0.5;
}

.ink-ripple-layer {
  position: absolute;
  width: 100%; height: 100%;
  pointer-events: none;
}
.ink-ripple {
  position: absolute;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(214, 202, 255, 0.7), transparent);
  box-shadow: 0 0 18px 6px rgba(160, 148, 220, 0.25);
  animation: ripple-fade linear infinite;
  opacity: 0;
}
@keyframes ripple-fade {
  0% { transform: scale(0.2); opacity: 0; }
  20% { opacity: 0.9; }
  80% { opacity: 0.6; }
  100% { transform: scale(3.2); opacity: 0; }
}

.left-content {
  text-align: center;
  z-index: 2;
  color: #efe8dc;
  position: relative;
  animation: fade-up 1.1s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes fade-up {
  from { opacity: 0; transform: translateY(34px); }
  to { opacity: 1; transform: translateY(0); }
}

.seal-logo {
  width: 62px; height: 62px;
  margin: 0 auto 26px;
  background: #b5442f;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
  font-size: 34px;
  font-weight: 700;
  color: #f7f3ea;
  box-shadow: 0 6px 24px rgba(181, 68, 47, 0.4), inset 0 0 0 2px rgba(247, 243, 234, 0.25);
  position: relative;
  animation: seal-breathe 3.6s ease-in-out infinite;
}
.seal-logo::after {
  content: '';
  position: absolute;
  inset: 4px;
  border: 1px solid rgba(247, 243, 234, 0.55);
  border-radius: 3px;
}
@keyframes seal-breathe {
  0%, 100% { transform: rotate(-2deg) scale(1); }
  50% { transform: rotate(2deg) scale(1.06); }
}

.calligraphy-title {
  font-family: 'KaiTi', 'STKaiti', 'STSong', 'SimSun', serif;
  font-size: 64px;
  font-weight: 700;
  letter-spacing: 18px;
  margin-bottom: 4px;
  background: linear-gradient(180deg, #fbf6ec 0%, #d8c9a3 60%, #b9a87e 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 0 46px rgba(216, 201, 163, 0.25);
}

.ornament-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 18px auto;
}
.ornament-line i {
  width: 44px; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(216, 201, 163, 0.8));
}
.ornament-line b {
  width: 44px; height: 1px;
  background: linear-gradient(90deg, rgba(216, 201, 163, 0.8), transparent);
}
.ornament-line i::after { content: ''; }

.brand-slogan {
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: 19px;
  letter-spacing: 7px;
  color: #cabfa4;
}

.vertical-poem {
  position: absolute;
  right: -92px;
  top: 50%;
  transform: translateY(-50%);
  writing-mode: vertical-rl;
  display: flex;
  gap: 14px;
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 21px;
  letter-spacing: 10px;
  color: rgba(216, 201, 163, 0.4);
  animation: poem-fade 2.4s ease-out 0.6s both;
}
.vertical-poem span {
  display: inline-block;
  transition: all 0.5s;
}
.vertical-poem span:hover {
  color: rgba(240, 222, 175, 0.95);
  transform: scale(1.18);
}
@keyframes poem-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

.literary-tags {
  margin-top: 46px;
  display: flex;
  gap: 14px;
  justify-content: center;
  flex-wrap: wrap;
}
.ltag {
  padding: 7px 18px;
  border: 1px solid rgba(216, 201, 163, 0.35);
  border-radius: 30px;
  font-size: 13px;
  color: #d8c9a3;
  background: rgba(216, 201, 163, 0.06);
  backdrop-filter: blur(4px);
  transition: all 0.4s;
}
.ltag:hover {
  background: rgba(216, 201, 163, 0.16);
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.left-footer {
  margin-top: 34px;
  font-size: 12px;
  letter-spacing: 3px;
  color: rgba(216, 201, 163, 0.45);
}

.dangling-tassel {
  position: absolute;
  right: 26px; top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 3;
}
.tassel-line {
  width: 1px; height: 130px;
  background: linear-gradient(180deg, transparent, rgba(181, 68, 47, 0.7));
}
.tassel-knot {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: #b5442f;
  box-shadow: 0 0 10px rgba(181, 68, 47, 0.5);
}
.tassel-fringe {
  width: 1px; height: 46px;
  background: linear-gradient(180deg, rgba(181, 68, 47, 0.7), transparent);
  position: relative;
}
.tassel-fringe::after {
  content: '';
  position: absolute;
  left: -4px; top: 0;
  width: 9px; height: 46px;
  background: repeating-linear-gradient(180deg, transparent 0 8px, rgba(181, 68, 47, 0.5) 8px 9px);
}

/* ================= 右侧：宣纸表单区 ================= */
.auth-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(165deg, #f6f1e7 0%, #efe7d6 55%, #e8deC9 100%);
  position: relative;
  overflow: hidden;
}
.auth-right::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(45deg, rgba(160, 140, 100, 0.035) 0 2px, transparent 2px 4px);
  pointer-events: none;
}
.auth-right::after {
  content: '';
  position: absolute;
  left: -180px; bottom: -180px;
  width: 440px; height: 440px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(140, 120, 80, 0.12), transparent 68%);
}

.paper-texture {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 20% 10%, rgba(255, 255, 255, 0.5), transparent 55%),
              radial-gradient(ellipse at 85% 90%, rgba(160, 140, 100, 0.16), transparent 55%);
  pointer-events: none;
}

.corner-badge {
  position: absolute;
  top: 26px; right: 30px;
  writing-mode: vertical-rl;
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 15px;
  letter-spacing: 8px;
  color: #8f7c55;
  border-right: 2px solid rgba(143, 124, 85, 0.5);
  padding-right: 8px;
}

.ink-splatter {
  position: absolute;
  left: -40px; top: 40%;
  width: 130px; height: 130px;
  background: radial-gradient(circle at 40% 40%,
    rgba(51, 45, 60, 0.12) 0 12px,
    transparent 12px 14px,
    rgba(51, 45, 60, 0.06) 14px 26px,
    transparent 26px 30px,
    rgba(51, 45, 60, 0.04) 30px 44px,
    transparent 44px);
  border-radius: 50%;
  filter: blur(2px);
  opacity: 0.7;
}

.right-poem {
  position: absolute;
  right: 34px;
  bottom: 46px;
  text-align: right;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: 15px;
  line-height: 2.1;
  letter-spacing: 3px;
  color: rgba(118, 100, 68, 0.55);
}
.right-poem p { margin: 0; }

.auth-form-wrapper {
  width: 430px;
  padding: 46px 44px;
  z-index: 1;
  background: linear-gradient(180deg, rgba(255, 252, 245, 0.82), rgba(250, 245, 234, 0.92));
  border-radius: 18px;
  border: 1px solid rgba(176, 150, 105, 0.28);
  box-shadow:
    0 24px 60px -18px rgba(90, 72, 40, 0.35),
    0 2px 8px rgba(90, 72, 40, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
  animation: slide-in-right 0.85s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes slide-in-right {
  from { opacity: 0; transform: translateX(48px); }
  to { opacity: 1; transform: translateX(0); }
}

.form-header {
  margin-bottom: 30px;
  text-align: center;
}
.form-title {
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: 8px;
  color: #3b3020;
  margin-bottom: 12px;
}
.title-ornament {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 12px;
}
.to-line {
  width: 42px; height: 1px;
  background: linear-gradient(90deg, transparent, #a58a4b);
}
.to-line:last-child {
  background: linear-gradient(90deg, #a58a4b, transparent);
}
.to-dot {
  width: 7px; height: 7px;
  background: #a58a4b;
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(165, 138, 75, 0.5);
}
.form-subtitle {
  font-size: 13px;
  letter-spacing: 2px;
  color: #9a8a6c;
}

.field-row.two {
  display: flex;
  gap: 12px;
}
.field-row.two .el-form-item {
  flex: 1;
}

/* ---- 校区徽章选择器 ---- */
.campus-picker {
  display: flex;
  gap: 10px;
  width: 100%;
}
.campus-option {
  flex: 1;
  height: 54px;
  border-radius: 12px;
  border: 1.5px solid #d9cdb4;
  background: linear-gradient(180deg, #fbf7ee, #f4edde);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  cursor: pointer;
  position: relative;
  transition: all 0.3s ease;
  color: #8b7b58;
  user-select: none;
}
.campus-option:hover {
  border-color: #a58a4b;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(120, 100, 60, 0.16);
}
.campus-option.active {
  border-color: #a58a4b;
  background: linear-gradient(180deg, #efe5cd, #e6d8b8);
  color: #5c4a28;
  box-shadow: 0 6px 18px rgba(165, 138, 75, 0.28), inset 0 0 0 1px rgba(165, 138, 75, 0.3);
  transform: translateY(-2px);
}
.campus-icon {
  line-height: 1;
  color: inherit;
}
.campus-name {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 2px;
}
.campus-check {
  position: absolute;
  top: -7px; right: -7px;
  width: 19px; height: 19px;
  border-radius: 50%;
  background: #a58a4b;
  color: #fff;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(120, 100, 60, 0.4);
}
.campus-label {
  letter-spacing: 2px;
  color: #5c4a28;
  font-weight: 600;
  font-size: 13px;
}

/* ---- 验证码 ---- */
.code-row {
  display: flex;
  gap: 10px;
  width: 100%;
}
.code-btn {
  flex-shrink: 0;
  white-space: nowrap;
  color: #7c6438;
  border-color: #bda46a;
  border-radius: 12px;
  background: #faf5e8;
  transition: all 0.3s;
}
.code-btn:hover:not(:disabled):not(.is-loading) {
  background: #a58a4b;
  color: #fff;
  border-color: #a58a4b;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(165, 138, 75, 0.35);
}
.code-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* ---- 提交按钮：鎏金质感 ---- */
.submit-btn {
  width: 100%;
  margin-top: 10px;
  height: 50px;
  font-size: 16px;
  letter-spacing: 6px;
  border: none;
  background: linear-gradient(135deg, #a58a4b 0%, #c7a75f 50%, #a58a4b 100%);
  background-size: 200% 200%;
  box-shadow: 0 6px 18px rgba(150, 120, 60, 0.35);
  transition: all 0.35s ease;
  font-family: 'KaiTi', 'STKaiti', serif;
}
.submit-btn:hover {
  background-position: 100% 100%;
  box-shadow: 0 8px 26px rgba(150, 120, 60, 0.5);
  transform: translateY(-2px);
}
.submit-btn:active {
  transform: translateY(0);
  box-shadow: 0 3px 10px rgba(150, 120, 60, 0.3);
}

.toggle-area {
  text-align: center;
  margin-top: 24px;
}
.toggle-text {
  color: #8b7b58;
  cursor: pointer;
  font-size: 14px;
  letter-spacing: 1px;
  transition: all 0.3s;
  position: relative;
}
.toggle-text::after {
  content: '';
  position: absolute;
  bottom: -2px; left: 0;
  width: 0; height: 1px;
  background: #a58a4b;
  transition: width 0.3s;
}
.toggle-text:hover {
  color: #7c6438;
}
.toggle-text:hover::after {
  width: 100%;
}

/* ---- 表单控件 ---- */
:deep(.el-form-item) {
  margin-bottom: 18px;
  animation: field-enter 0.55s ease-out both;
}
:deep(.el-form-item:nth-child(1)) { animation-delay: 0.08s; }
:deep(.el-form-item:nth-child(2)) { animation-delay: 0.16s; }
:deep(.el-form-item:nth-child(3)) { animation-delay: 0.24s; }
:deep(.el-form-item:nth-child(4)) { animation-delay: 0.32s; }
:deep(.el-form-item:nth-child(5)) { animation-delay: 0.4s; }
:deep(.el-form-item:nth-child(6)) { animation-delay: 0.48s; }
:deep(.el-form-item:nth-child(7)) { animation-delay: 0.56s; }
:deep(.el-form-item:nth-child(8)) { animation-delay: 0.64s; }
:deep(.el-form-item:nth-child(9)) { animation-delay: 0.72s; }
@keyframes field-enter {
  from { opacity: 0; transform: translateX(18px); }
  to { opacity: 1; transform: translateX(0); }
}

:deep(.el-input__wrapper) {
  border-radius: 12px;
  box-shadow: 0 0 0 1px #dcd2ba inset;
  transition: all 0.3s ease;
  padding: 4px 14px;
  background: rgba(255, 253, 248, 0.85);
}
:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #bda46a inset;
}
:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px #a58a4b inset, 0 6px 16px rgba(165, 138, 75, 0.18) !important;
  transform: translateY(-1px);
}
:deep(.el-input__inner) {
  height: 46px;
  font-size: 15px;
  color: #3b3020;
}
:deep(.el-input__inner::placeholder) {
  color: #b5a583;
}

.form-fade-enter-active, .form-fade-leave-active {
  transition: all 0.3s ease;
}
.form-fade-enter-from { opacity: 0; transform: translateY(16px); }
.form-fade-leave-to { opacity: 0; transform: translateY(-16px); }

@media (max-width: 900px) {
  .auth-left { display: none; }
  .auth-page { flex-direction: column; }
  .auth-form-wrapper { width: 90%; margin: 30px auto; }
}
</style>