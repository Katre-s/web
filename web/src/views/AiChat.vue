<template>
  <div class="ai-chat-page">
    <div class="ai-header">
      <span class="ai-title">{{ $t('ai.pageTitle') }}</span>
      <span class="ai-tag">{{ $t('ai.tag') }}</span>
      <div class="ai-header-right">
        <el-button size="small" round class="ai-call-btn" :class="{ calling: inCall }" @click="toggleCall">
          <el-icon :size="14"><Phone /></el-icon>
          <span>{{ inCall ? $t('ai.hangup') : $t('ai.call') }}</span>
        </el-button>
        <span class="ai-voice-label">{{ $t('ai.voiceReply') }}</span>
        <el-switch
          v-model="speakOnReply"
          size="small"
          @change="onSpeakSwitch"
        />
      </div>
    </div>
    <div class="ai-messages" ref="msgBox">
      <div class="ai-msg" v-for="(m, i) in messages" :key="i" :class="{ user: m.role === 'user' }">
        <div class="ai-bubble">
          <div v-if="m.intent && m.role === 'assistant'" class="ai-intent">{{ intentText(m.intent) }}</div>
          <div class="ai-content">{{ m.content }}</div>
          <div v-if="m.role === 'assistant' && m.actions && m.actions.length" class="ai-actions">
            <el-button
              v-for="(a, ai) in m.actions"
              :key="ai"
              size="small"
              type="primary"
              plain
              round
              @click="doAction(a)"
            >
              {{ a.label }}
            </el-button>
            <el-button size="small" round class="ai-speak-btn" :class="{ speaking: speakingIndex === i }" @click="speakMsg(m, i)">
              {{ speakingIndex === i ? $t('ai.stopSpeak') : $t('ai.speak') }}
            </el-button>
          </div>
          <div v-else-if="m.intent && m.role === 'assistant' && actionFor(m.intent)" class="ai-actions">
            <el-button size="small" type="primary" plain round @click="go(actionFor(m.intent))">
              {{ actionText(m.intent) }}
            </el-button>
            <el-button size="small" round class="ai-speak-btn" :class="{ speaking: speakingIndex === i }" @click="speakMsg(m, i)">
              {{ speakingIndex === i ? $t('ai.stopSpeak') : $t('ai.speak') }}
            </el-button>
          </div>
          <div v-else-if="m.role === 'assistant' && m.content" class="ai-actions">
            <el-button size="small" round class="ai-speak-btn" :class="{ speaking: speakingIndex === i }" @click="speakMsg(m, i)">
              {{ speakingIndex === i ? $t('ai.stopSpeak') : $t('ai.speak') }}
            </el-button>
          </div>
        </div>
      </div>
      <div v-if="loading" class="ai-msg">
        <div class="ai-bubble typing">{{ $t('ai.typing') }}</div>
      </div>
    </div>
    <div class="ai-input">
      <el-button
        class="ai-mic-btn"
        :class="{ listening: isListening }"
        :title="$t('ai.micTip')"
        circle
        @click="toggleMic"
      >
        <el-icon :size="18"><Microphone /></el-icon>
      </el-button>
      <el-input
        v-model="text"
        :placeholder="isListening ? $t('ai.listening') : $t('ai.placeholder')"
        @keyup.enter="send"
        :disabled="loading"
      />
      <el-button type="primary" :loading="loading" @click="send">{{ $t('ai.send') }}</el-button>
    </div>

    <!-- ===== 实时通话模式：像打电话一样与 AI 交流 ===== -->
    <teleport to="body">
      <transition name="call-fade">
        <div v-if="inCall" class="call-overlay">
          <div class="call-stage">
            <div class="call-avatar">
              <span class="call-fish">🐟</span>
              <span class="call-ring ring1"></span>
              <span class="call-ring ring2"></span>
            </div>
            <div class="call-status">
              <span class="call-status-text">{{ callStatusText }}</span>
              <div class="call-waves" v-if="callStatus === 'listening' || callStatus === 'speaking'">
                <i v-for="n in 7" :key="n" :style="{ animationDelay: n * 0.12 + 's' }"></i>
              </div>
            </div>
            <div class="call-tip">{{ callTipText }}</div>
            <button class="call-hangup" @click="hangupCall">
              <el-icon :size="26"><PhoneFilled /></el-icon>
            </button>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { agentApi } from '@/api'
import { ElMessage } from 'element-plus/es/components/message/index'
import { Microphone, Phone, PhoneFilled } from '@element-plus/icons-vue'
import { useAgentStore } from '@/stores/agent'
import { runAgentAction } from '@/utils/agentAction'

const router = useRouter()
const { t } = useI18n()
const agentStore = useAgentStore()
const text = ref('')
const loading = ref(false)
const msgBox = ref(null)
// messages 来自全局 store（localStorage 持久化），切换页面/刷新后仍保留
const messages = computed(() => agentStore.messages)

/* ============ 语音输入（浏览器原生 SpeechRecognition）============ */
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
const isListening = ref(false)
let recognition = null
let finalTranscript = ''
let micSupported = !!SpeechRecognition

function toggleMic() {
  if (!micSupported) {
    ElMessage.warning(t('ai.micUnsupported'))
    return
  }
  if (isListening.value) stopMic()
  else {
    stopSpeak() // 手动开麦：先打断 AI 朗读
    startMic()
  }
}

function startMic() {
  if (!SpeechRecognition) return
  // 注意：不在 startMic 里 stopSpeak，避免误打断；用户一开口（onresult 有内容）才打断
  try {
    recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    finalTranscript = ''
    recognition.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalTranscript += r[0].transcript
        else interim += r[0].transcript
      }
      const combined = (finalTranscript + interim).trim()
      text.value = combined
      if (combined) {
        lastSpeechAt = Date.now() // 有人在说话，刷新静默计时
        stopSpeak() // 用户一开口立即打断 AI 朗读（听用户先说）
      }
      scrollBottom()
    }
    recognition.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        if (!inCall.value) ElMessage.error(t('ai.micDenied'))
      }
      isListening.value = false
    }
    recognition.onend = () => {
      isListening.value = false
      // 识别意外中断（非主动停止）：通话中自动重连，保持电话在线
      if (callRunning && inCall.value && !loading.value) {
        setTimeout(beginListening, 400)
      } else if (finalTranscript.trim() && !loading.value) {
        send()
      }
    }
    recognition.start()
    isListening.value = true
  } catch (err) {
    isListening.value = false
    if (!inCall.value) ElMessage.error(t('ai.micError'))
    else setTimeout(beginListening, 600)
  }
}

function stopMic() {
  try {
    recognition && recognition.stop()
  } catch {}
  isListening.value = false
}

/* ============ 语音朗读（浏览器原生 speechSynthesis，可打断）============ */
const speakOnReply = ref(localStorage.getItem('ai_speak_on') !== '0')
const speakingIndex = ref(-1)
let utterTimer = null

/* ============ 实时通话模式：像打电话一样 ============ */
const inCall = ref(false)
const callStatus = ref('idle') // idle | listening | thinking | speaking
let callRunning = false

const callStatusText = computed(() => {
  const map = {
    idle: t('ai.callConnecting'),
    listening: t('ai.callListening'),
    thinking: t('ai.callThinking'),
    speaking: t('ai.callSpeaking')
  }
  return map[callStatus.value] || ''
})
const callTipText = computed(() => {
  if (callStatus.value === 'listening') return t('ai.callTipListening')
  if (callStatus.value === 'thinking') return t('ai.callTipThinking')
  if (callStatus.value === 'speaking') return t('ai.callTipSpeaking')
  return t('ai.callConnecting')
})

function toggleCall() {
  if (inCall.value) hangupCall()
  else startCall()
}

function startCall() {
  if (!micSupported) {
    ElMessage.warning(t('ai.micUnsupported'))
    return
  }
  inCall.value = true
  callRunning = true
  callStatus.value = 'idle'
  // 短暂连接提示后开始聆听
  setTimeout(() => {
    if (callRunning) beginListening()
  }, 700)
}

function hangupCall() {
  callRunning = false
  inCall.value = false
  callStatus.value = 'idle'
  clearWatchdog()
  stopMic()
  stopSpeak()
}

/* ===== 通话核心：听 → 2秒静默 → 自动应答 ===== */
let lastSpeechAt = 0
let watchdogTimer = null

function beginListening() {
  if (!callRunning || !inCall.value || loading.value) return
  callStatus.value = 'listening'
  // 新聆听轮次才重置静默计时并启动看门狗；识别异常重连时不重置，避免无限推迟应答
  if (!watchdogTimer) {
    lastSpeechAt = Date.now()
    startWatchdog()
  }
  // 识别已在跑（用户正说话/被打断场景）就不重启，保留已识别内容
  if (!isListening.value) startMic()
}

/* 静默看门狗：每 500ms 检查一次；用户 2 秒没说话就自动应答 */
function startWatchdog() {
  clearWatchdog()
  watchdogTimer = setInterval(() => {
    if (!callRunning || !inCall.value) { clearWatchdog(); return }
    // 思考中或 AI 正在朗读时不触发引导；用户开口打断朗读后由 onresult 走下一轮
    if (loading.value || callStatus.value === 'thinking') return
    if (callStatus.value === 'speaking') return
    if (Date.now() - lastSpeechAt < 2000) return
    clearWatchdog()
    if (finalTranscript.trim()) {
      // 用户说完了但停住 → 提交并等 AI 回复
      commitSpeech()
    } else {
      // 完全没说话 → AI 主动引导一句，继续听
      aiPromptSpeech()
    }
  }, 500)
}

function clearWatchdog() {
  if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null }
}

function commitSpeech() {
  const content = finalTranscript.trim()
  if (!content || loading.value) { beginListening(); return }
  finalTranscript = '' // 提交后清空，识别器继续听下一句
  text.value = content
  if (inCall.value) {
    send()
  } else {
    stopMic()
    send()
  }
}

/* AI 引导话术：没听到内容时主动回应（同步写入聊天记录 + 朗读） */
function aiPromptSpeech() {
  const prompt = t('ai.callPromptNone')
  const msgIdx = messages.value.length
  agentStore.addMessage({ role: 'assistant', content: prompt })
  callStatus.value = 'speaking'
  nextTick(() => speakText(prompt, msgIdx))
  // speakText onend 会自动恢复聆听
}

function pickZhVoice() {
  const voices = window.speechSynthesis ? speechSynthesis.getVoices() : []
  if (!voices.length) return null
  // 优先自然音色：Edge 在线自然语音 / Google 普通话 / 系统中文
  const prefers = [
    'xiaoxiao online', 'xiaoyi online', 'yunxi online', 'yunyang online',
    'google 普通话', 'google 中文', 'huihui', 'yaoyao', 'kangkang', 'tingting'
  ]
  for (const p of prefers) {
    const hit = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('zh') && v.name.toLowerCase().includes(p))
    if (hit) return hit
  }
  return voices.find(v => v.lang && v.lang.toLowerCase().startsWith('zh')) || null
}

function stopSpeak() {
  if (window.speechSynthesis) speechSynthesis.cancel()
  if (utterTimer) { clearTimeout(utterTimer); utterTimer = null }
  speakingIndex.value = -1
}

function speakText(content, idx) {
  // 无语音合成能力时：通话模式自动继续下一轮聆听（避免卡死在 speaking）
  if (!window.speechSynthesis) {
    if (callRunning && inCall.value) setTimeout(beginListening, 300)
    return
  }
  if (speakingIndex.value === idx) { stopSpeak(); return }
  stopSpeak()
  const u = new SpeechSynthesisUtterance(content)
  const v = pickZhVoice()
  if (v) u.voice = v
  u.lang = 'zh-CN'
  u.rate = 1.05
  u.pitch = 1
  speakingIndex.value = idx
  u.onend = () => {
    speakingIndex.value = -1
    // 通话模式下：AI 说完自动继续听（打电话式循环）
    if (callRunning && inCall.value) beginListening()
  }
  u.onerror = () => {
    speakingIndex.value = -1
    if (callRunning && inCall.value) beginListening()
  }
  speechSynthesis.speak(u)
}

function speakMsg(m, i) {
  speakText(m.content, i)
}

function onSpeakSwitch(v) {
  localStorage.setItem('ai_speak_on', v ? '1' : '0')
  if (!v) stopSpeak()
}

function intentText(i) {
  return t(`ai.intent.${i}`) || ''
}

const ACTIONS = {
  buy: '/trade',
  sell: '/publish',
  search: '/trade',
  order: '/profile'
}
function actionFor(i) {
  return ACTIONS[i] || ''
}
function actionText(i) {
  return t(`ai.action.${i}`) || ''
}
function go(to) {
  router.push(to)
}

function doAction(action) {
  runAgentAction(action, router)
}

function scrollBottom() {
  nextTick(() => {
    if (msgBox.value) msgBox.value.scrollTop = msgBox.value.scrollHeight
  })
}

async function send() {
  const content = text.value.trim()
  if (!content || loading.value) return
  if (!inCall.value) stopMic() // 通话模式保持识别常开，thinking 阶段也能继续听
  text.value = ''
  agentStore.addMessage({ role: 'user', content })
  loading.value = true
  if (inCall.value) callStatus.value = 'thinking'
  scrollBottom()

  const history = agentStore.messages
    .slice(0, -1)
    .filter(m => !m.welcome)
    .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))

  try {
    const res = await agentApi.chat(content, history)
    const data = res.data || res
    agentStore.addMessage({ role: 'assistant', content: data.reply, intent: data.intent, actions: data.actions || [] })
    // 通话模式下：AI 回复自动朗读，形成"打电话式"对话；朗读期间保持监听，用户开口即打断
    if (inCall.value && data.reply) {
      callStatus.value = 'speaking'
      nextTick(() => speakText(data.reply, messages.value.length - 1))
    } else if (speakOnReply.value && data.reply) {
      nextTick(() => speakText(data.reply, messages.value.length - 1))
    }
  } catch {
    ElMessage.error(t('ai.error'))
    if (inCall.value) {
      beginListening()
    }
  } finally {
    loading.value = false
    scrollBottom()
  }
}

onMounted(() => {
  // 仅当没有任何历史记录时，才插入欢迎语
  if (agentStore.messages.length === 0) {
    agentStore.addMessage({
      role: 'assistant',
      content: t('ai.welcome'),
      intent: 'chat',
      welcome: true
    })
  }
  // 预加载语音列表（部分浏览器异步加载 voices）
  if (window.speechSynthesis) speechSynthesis.getVoices()
})

onUnmounted(() => {
  hangupCall()
  stopMic()
  stopSpeak()
})
</script>

<style scoped>
.ai-chat-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
  min-height: 420px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 2px 12px rgba(13, 40, 71, 0.06);
  overflow: hidden;
}
.ai-header {
  padding: 14px 18px;
  border-bottom: 1px solid #f0f4f8;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}
.ai-title { font-size: 16px; font-weight: 700; color: #0d2847; }
.ai-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ai-voice-label { font-size: 12px; color: #78909c; }
.ai-tag {
  background: linear-gradient(135deg, #42a5f5, #1e88e5);
  color: #fff;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
}
.ai-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ai-msg { display: flex; }
.ai-msg.user { justify-content: flex-end; }
.ai-bubble {
  max-width: 75%;
  padding: 10px 14px;
  border-radius: 12px;
  background: #f0f4f8;
  color: #37474f;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
}
.ai-msg.user .ai-bubble {
  background: linear-gradient(135deg, #42a5f5, #1e88e5);
  color: #fff;
}
.ai-intent {
  display: inline-block;
  font-size: 11px;
  background: #e3f2fd;
  color: #1565c0;
  padding: 1px 6px;
  border-radius: 8px;
  margin-bottom: 6px;
}
.ai-content { white-space: pre-wrap; }
.ai-actions {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ai-actions .el-button {
  margin: 0;
  font-size: 12px;
}
.typing { color: #90a4ae; }
.ai-input {
  padding: 12px 16px;
  border-top: 1px solid #f0f4f8;
  display: flex;
  gap: 10px;
}
/* 语音输入麦克风按钮：iOS 质感圆形，监听时红色脉冲 */
.ai-mic-btn {
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  background: linear-gradient(135deg, #42a5f5, #1e88e5) !important;
  border: none !important;
  color: #fff !important;
  box-shadow: 0 4px 14px rgba(66, 165, 245, 0.35);
  transition: transform 0.2s var(--ease-spring), box-shadow 0.3s;
}
.ai-mic-btn.listening {
  background: linear-gradient(135deg, #ef5350, #d32f2f) !important;
  box-shadow: 0 4px 18px rgba(239, 83, 80, 0.45);
  animation: mic-pulse 1.2s ease-in-out infinite;
}
@keyframes mic-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}
.ai-speak-btn {
  margin: 0 !important;
  font-size: 12px;
  border-radius: 999px !important;
}
.ai-speak-btn.speaking {
  background: linear-gradient(135deg, #66bb6a, #43a047) !important;
  border-color: transparent !important;
  color: #fff !important;
  animation: mic-pulse 1s ease-in-out infinite;
}
.ai-call-btn {
  margin: 0 2px 0 0 !important;
  font-size: 12px;
  font-weight: 600;
  border-radius: 999px !important;
}
.ai-call-btn.calling {
  background: linear-gradient(135deg, #26c6da, #00acc1) !important;
  border-color: transparent !important;
  color: #fff !important;
  animation: mic-pulse 1.4s ease-in-out infinite;
}
@media (max-width: 768px) {
  .ai-chat-page { height: calc(100vh - 160px); }
}
</style>

<style>
/* ===== 实时通话界面（teleport 到 body）===== */
.call-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(60% 50% at 50% 18%, rgba(66, 165, 245, 0.22), transparent 62%),
    radial-gradient(50% 45% at 82% 82%, rgba(167, 139, 250, 0.16), transparent 60%),
    linear-gradient(180deg, #0b1220 0%, #101b33 55%, #0d1628 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.call-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding-bottom: 24px;
  user-select: none;
}
.call-avatar {
  position: relative;
  width: 132px;
  height: 132px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.call-fish {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: linear-gradient(135deg, #22d3ee, #3b82f6 60%, #a78bfa);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 44px;
  box-shadow: 0 12px 44px rgba(34, 211, 238, 0.4);
  z-index: 2;
  animation: call-breathe 2.6s ease-in-out infinite;
}
@keyframes call-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); }
}
.call-ring {
  position: absolute;
  border-radius: 50%;
  border: 2px solid rgba(34, 211, 238, 0.4);
  inset: 0;
  animation: call-ring 2.4s ease-out infinite;
}
.call-ring.ring2 {
  animation-delay: 1.2s;
}
@keyframes call-ring {
  0% { transform: scale(0.9); opacity: 0.8; }
  100% { transform: scale(1.55); opacity: 0; }
}
.call-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  min-height: 62px;
}
.call-status-text {
  color: #e8f6ff;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 1px;
}
.call-tip {
  color: rgba(143, 179, 201, 0.85);
  font-size: 12.5px;
  letter-spacing: 0.4px;
}
.call-waves {
  display: flex;
  align-items: flex-end;
  gap: 5px;
  height: 30px;
}
.call-waves i {
  width: 4px;
  height: 12px;
  border-radius: 999px;
  background: linear-gradient(180deg, #22d3ee, #a78bfa);
  animation: wave 0.9s ease-in-out infinite;
}
@keyframes wave {
  0%, 100% { transform: scaleY(0.4); }
  50% { transform: scaleY(1.15); }
}
.call-hangup {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  background: linear-gradient(135deg, #ef5350, #d32f2f);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 32px rgba(239, 83, 80, 0.45);
  transition: transform 0.2s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)), box-shadow 0.25s;
  margin-top: 8px;
}
.call-hangup:hover {
  transform: scale(1.08);
  box-shadow: 0 14px 40px rgba(239, 83, 80, 0.55);
}
.call-hangup:active {
  transform: scale(0.94);
}
.call-fade-enter-active,
.call-fade-leave-active {
  transition: opacity 0.3s ease;
}
.call-fade-enter-from,
.call-fade-leave-to {
  opacity: 0;
}
</style>
