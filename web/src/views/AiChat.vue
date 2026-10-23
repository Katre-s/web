<template>
  <div class="ai-chat-page">
    <div class="ai-header">
      <span class="ai-title">{{ $t('ai.pageTitle') }}</span>
      <span class="ai-tag">{{ $t('ai.tag') }}</span>
      <div class="ai-header-right">
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
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { agentApi } from '@/api'
import { ElMessage } from 'element-plus/es/components/message/index'
import { Microphone } from '@element-plus/icons-vue'
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
  else startMic()
}

function startMic() {
  if (!SpeechRecognition) return
  stopSpeak() // 用户要说话时，先打断 AI 朗读（听用户先说）
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
      text.value = (finalTranscript + interim).trim()
      scrollBottom()
    }
    recognition.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        ElMessage.error(t('ai.micDenied'))
      }
      isListening.value = false
    }
    recognition.onend = () => {
      isListening.value = false
      // 说话结束后若有完整识别结果，自动发送（实时通话体验）
      if (finalTranscript.trim() && !loading.value) {
        send()
      }
    }
    recognition.start()
    isListening.value = true
  } catch (err) {
    isListening.value = false
    ElMessage.error(t('ai.micError'))
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

function pickZhVoice() {
  const voices = window.speechSynthesis ? speechSynthesis.getVoices() : []
  return voices.find(v => v.lang && v.lang.toLowerCase().startsWith('zh')) || null
}

function stopSpeak() {
  if (window.speechSynthesis) speechSynthesis.cancel()
  if (utterTimer) { clearTimeout(utterTimer); utterTimer = null }
  speakingIndex.value = -1
}

function speakText(content, idx) {
  if (!window.speechSynthesis) return
  if (speakingIndex.value === idx) { stopSpeak(); return }
  stopSpeak()
  const u = new SpeechSynthesisUtterance(content)
  const v = pickZhVoice()
  if (v) u.voice = v
  u.lang = 'zh-CN'
  u.rate = 1.05
  u.pitch = 1
  speakingIndex.value = idx
  u.onend = () => { speakingIndex.value = -1 }
  u.onerror = () => { speakingIndex.value = -1 }
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
  stopMic()
  text.value = ''
  agentStore.addMessage({ role: 'user', content })
  loading.value = true
  scrollBottom()

  const history = agentStore.messages
    .slice(0, -1)
    .filter(m => !m.welcome)
    .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))

  try {
    const res = await agentApi.chat(content, history)
    const data = res.data || res
    agentStore.addMessage({ role: 'assistant', content: data.reply, intent: data.intent, actions: data.actions || [] })
    // 实时通话：开启语音播报时自动朗读 AI 回复
    if (speakOnReply.value && data.reply) {
      nextTick(() => speakText(data.reply, messages.value.length - 1))
    }
  } catch {
    ElMessage.error(t('ai.error'))
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
@media (max-width: 768px) {
  .ai-chat-page { height: calc(100vh - 160px); }
}
</style>
