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
        :class="{ listening: micActive }"
        :title="$t('ai.micTip')"
        circle
        @click="toggleMic"
      >
        <el-icon :size="18"><Microphone /></el-icon>
      </el-button>
      <el-input
        v-model="text"
        :placeholder="micActive ? $t('ai.listening') : $t('ai.placeholder')"
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
// 麦克风仅在 HTTPS 或 localhost 下可用（Chrome 安全上下文策略）
const secureCtx = !!(window.isSecureContext || location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))
const micError = ref(false)
let micFailCount = 0

/* ============ 录音兜底：MediaRecorder → 服务端识别 ============
   手机端打不了电话的两个真实原因：
     1. 打包成 APK 后页面跑在 Android WebView 里，它没有实现 webkitSpeechRecognition；
     2. 站点是自签名证书，浏览器拿到的是「不安全上下文」，getUserMedia 也会被拒。
   所以除了原生识别，再留一条通用通路：录一小段音频 → 上传 → 后台转文字 → 正常走对话。 */
const hasSR = !!SpeechRecognition
const hasMR = !!(window.MediaRecorder && navigator.mediaDevices?.getUserMedia)
const recSupported = hasMR
// 安卓（含 APK 里的 WebView）优先走录音通路：那套原生识别要么压根不存在，
// 要么背后连的是境外服务，在国内基本只会返回 network error。
// iOS Safari 的原生识别是本地能力，可以继续用；桌面端先用原生，失败再降级。
const isAndroid = /Android/i.test(navigator.userAgent || '')
let micMode = hasSR && !isAndroid ? 'sr' : (hasMR ? 'mr' : (hasSR ? 'sr' : 'none'))
let asrUnavailable = false // 服务端没配 ASR 时置位，避免反复弹提示

let mrRecorder = null
let mrStream = null
let mrChunks = []
let mrMimeType = ''
let mrAudioCtx = null
let mrVadTimer = null
let mrSpoke = false
let mrSilenceAt = 0
let mrStartAt = 0
const mrBusy = ref(false)
let mrSingleShot = false // true=点麦克风说一句；false=通话中的一轮

function pickAudioMime() {
  const cands = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  for (const m of cands) {
    try {
      if (window.MediaRecorder.isTypeSupported(m)) return m
    } catch {}
  }
  return ''
}

function releaseRec() {
  if (mrVadTimer) { clearInterval(mrVadTimer); mrVadTimer = null }
  if (mrAudioCtx) {
    try { mrAudioCtx.close() } catch {}
    mrAudioCtx = null
  }
  if (mrStream) {
    try { mrStream.getTracks().forEach(t => t.stop()) } catch {}
    mrStream = null
  }
  mrRecorder = null
}

/** 录一轮：说话后静音约 1.1 秒自动结束，或最长 20 秒强制结束 */
async function startRecTurn(singleShot = false) {
  if (!recSupported || mrBusy.value) return
  if (!singleShot && (!callRunning || !inCall.value)) return
  if (asrUnavailable) {
    ElMessage.warning(t('ai.asrUnavailable'))
    return
  }

  mrBusy.value = true
  mrSingleShot = singleShot
  mrChunks = []
  mrSpoke = false
  callStatus.value = 'listening'

  try {
    mrStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    })
  } catch (err) {
    mrBusy.value = false
    micError.value = true
    callStatus.value = 'idle'
    clearWatchdog()
    ElMessage.error(t('ai.micDenied'))
    return
  }

  // 静音检测（VAD）：直接用音量包络判断是否说完，比固定时长自然得多
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (Ctx) {
      mrAudioCtx = new Ctx()
      const src = mrAudioCtx.createMediaStreamSource(mrStream)
      const analyser = mrAudioCtx.createAnalyser()
      analyser.fftSize = 1024
      src.connect(analyser)
      const buf = new Uint8Array(analyser.fftSize)
      mrVadTimer = setInterval(() => {
        if (!mrRecorder || mrRecorder.state !== 'recording') return
        analyser.getByteTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / buf.length)
        const now = Date.now()
        if (rms > 0.022) {
          mrSpoke = true
          mrSilenceAt = 0
        } else if (mrSpoke && !mrSilenceAt) {
          mrSilenceAt = now
        }
        const silentTooLong = mrSpoke && mrSilenceAt && now - mrSilenceAt > 1100
        if (silentTooLong || now - mrStartAt > 20000) stopRecTurn()
      }, 100)
    }
  } catch {
    // 没有 AudioContext 就退化为固定 6 秒录音
    mrVadTimer = setTimeout(() => stopRecTurn(), 6000)
  }

  try {
    mrMimeType = pickAudioMime()
    mrRecorder = mrMimeType
      ? new MediaRecorder(mrStream, { mimeType: mrMimeType })
      : new MediaRecorder(mrStream)
    mrMimeType = mrRecorder.mimeType || mrMimeType || 'audio/webm'
    mrRecorder.ondataavailable = (e) => { if (e.data && e.data.size) mrChunks.push(e.data) }
    mrRecorder.onstop = () => finishRecTurn()
    mrStartAt = Date.now()
    mrRecorder.start()
  } catch {
    mrBusy.value = false
    releaseRec()
    micError.value = true
    callStatus.value = 'idle'
    clearWatchdog()
    ElMessage.error(t('ai.micError'))
  }
}

function stopRecTurn() {
  if (mrVadTimer) {
    clearInterval(mrVadTimer)
    clearTimeout(mrVadTimer)
    mrVadTimer = null
  }
  try {
    if (mrRecorder && mrRecorder.state === 'recording') mrRecorder.stop()
  } catch {}
}

async function finishRecTurn() {
  const chunks = mrChunks
  mrChunks = []
  releaseRec()
  const blob = new Blob(chunks, { type: mrMimeType || 'audio/webm' })
  // 小于 1.5KB 基本是环境噪声/没说话，直接开下一轮，别浪费一次识别
  if (!chunks.length || blob.size < 1500) {
    mrBusy.value = false
    if (mrSingleShot) { callStatus.value = 'idle'; return }
    if (callRunning && inCall.value) setTimeout(() => startRecTurn(), 250)
    return
  }
  await transcribeAndSend(blob)
}

async function transcribeAndSend(blob) {
  const ext = /mp4|m4a/.test(mrMimeType) ? 'm4a' : /ogg/.test(mrMimeType) ? 'ogg' : 'webm'
  const fd = new FormData()
  fd.append('file', blob, `speech.${ext}`)
  try {
    const res = await agentApi.asr(fd)
    const code = res?.code
    if (code === 2001) {
      asrUnavailable = true
      micError.value = true
      callStatus.value = 'idle'
      ElMessage.warning(res.message || t('ai.asrUnavailable'))
      mrBusy.value = false
      return
    }
    if (code && code !== 0) {
      ElMessage.warning(res?.message || t('ai.asrFail'))
      mrBusy.value = false
      if (!mrSingleShot && callRunning && inCall.value) setTimeout(() => startRecTurn(), 400)
      return
    }
    const content = String(res?.data?.text || '').trim()
    mrBusy.value = false
    if (!content) {
      // 没识别出内容：通话里继续听，单次模式就停下
      if (mrSingleShot) { callStatus.value = 'idle'; return }
      if (callRunning && inCall.value) setTimeout(() => startRecTurn(), 300)
      return
    }
    text.value = content
    if (inCall.value) send()
    else send()
  } catch {
    mrBusy.value = false
    if (!mrSingleShot && callRunning && inCall.value) setTimeout(() => startRecTurn(), 600)
  }
}

/** 停掉录音通路（挂断/离开页面） */
function abortRec() {
  if (mrVadTimer) { clearInterval(mrVadTimer); clearTimeout(mrVadTimer); mrVadTimer = null }
  mrBusy.value = false
  mrChunks = []
  try {
    if (mrRecorder && mrRecorder.state !== 'inactive') {
      mrRecorder.onstop = null
      mrRecorder.stop()
    }
  } catch {}
  releaseRec()
}


function toggleMic() {
  if (micMode === 'none') {
    ElMessage.warning(t('ai.micUnsupported'))
    return
  }
  // 录音通路：点一下录一句（录完自动发送）
  if (micMode === 'mr') {
    if (mrBusy.value) { stopRecTurn(); return }
    stopSpeak()
    startRecTurn(true)
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
      // 原生识别「不可用」类错误（不是用户明确拒绝，而是这条路走不通）：
      // 安卓 WebView 无此 API、国内网络连不上背后的识别服务、非安全上下文等。
      // 只要有录音能力就切到「录音上传识别」，别让整通电话死在这。
      const srDead = ['not-allowed', 'service-not-allowed', 'network', 'audio-capture', 'language-not-supported'].includes(e.error)
      if (srDead && hasMR && micMode === 'sr' && !asrUnavailable) {
        micMode = 'mr'
        isListening.value = false
        micFailCount = 0
        try { recognition.abort() } catch {}
        if (inCall.value) {
          setTimeout(() => { if (callRunning && inCall.value) startRecTurn() }, 300)
        }
        return
      }
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        micError.value = true
        if (!inCall.value) ElMessage.error(t('ai.micDenied'))
        else {
          clearWatchdog() // 权限被拒：停止无限"我在听"引导，提示用户检查麦克风
          callStatus.value = 'idle'
        }
      } else if (inCall.value) {
        // 其它识别错误：累计失败次数，连续失败进入故障提示
        micFailCount++
        if (micFailCount > 3) {
          micError.value = true
          clearWatchdog()
          callStatus.value = 'idle'
        }
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
    else {
      micFailCount++
      if (micFailCount > 3) {
        micError.value = true
        clearWatchdog()
        callStatus.value = 'idle'
      } else {
        setTimeout(beginListening, 600)
      }
    }
  }
}

function stopMic() {
  try {
    recognition && recognition.stop()
  } catch {}
  isListening.value = false
}

/* ============ 语音朗读（浏览器原生 speechSynthesis，可打断）============ */
// 音色列表是异步加载的：模块级缓存 + voiceschanged 监听，保证朗读时一定能拿到真实音色
let zhVoiceCache = []
const ZH_VOICES_READY = new Set()

function refreshVoiceCache() {
  if (!window.speechSynthesis) return
  const all = speechSynthesis.getVoices() || []
  const zh = all.filter(v => v.lang && v.lang.toLowerCase().startsWith('zh'))
  // 有变化才更新缓存并广播给全站（VoiceSwitcher 等组件可即时刷新列表）
  if (zh.length && JSON.stringify(zh.map(v => v.name)) !== JSON.stringify(zhVoiceCache.map(v => v.name))) {
    zhVoiceCache = zh
    window.dispatchEvent(new CustomEvent('ai-voices-ready', { detail: zh.map(v => v.name) }))
  }
  if (all.length) {
    speechSynthesis.onvoiceschanged = () => setTimeout(refreshVoiceCache, 0)
  }
}

function zhVoices() {
  if (zhVoiceCache.length) return zhVoiceCache
  const all = window.speechSynthesis ? speechSynthesis.getVoices() || [] : []
  const zh = all.filter(v => v.lang && v.lang.toLowerCase().startsWith('zh'))
  if (zh.length) zhVoiceCache = zh
  return zh
}
const speakOnReply = ref(localStorage.getItem('ai_speak_on') !== '0')
const speakingIndex = ref(-1)
let utterTimer = null

/* ============ 实时通话模式：像打电话一样 ============ */
const inCall = ref(false)
const callStatus = ref('idle') // idle | listening | thinking | speaking
let callRunning = false

const micActive = computed(() => isListening.value || mrBusy.value)

const callStatusText = computed(() => {
  if (micError.value) return t('ai.callMicError')
  const map = {
    idle: t('ai.callConnecting'),
    listening: t('ai.callListening'),
    thinking: t('ai.callThinking'),
    speaking: t('ai.callSpeaking')
  }
  return map[callStatus.value] || ''
})
const callTipText = computed(() => {
  if (micError.value) return t('ai.callMicErrorTip')
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
  if (micMode === 'none') {
    ElMessage.warning(t('ai.micUnsupported'))
    return
  }
  // 语音识别/麦克风仅在 HTTPS 或 localhost 下可用（Chrome 安全策略）
  if (!secureCtx) {
    ElMessage.warning(t('ai.needHttps'))
    return
  }
  if (micMode === 'mr' && asrUnavailable) {
    ElMessage.warning(t('ai.asrUnavailable'))
    return
  }
  inCall.value = true
  callRunning = true
  callStatus.value = 'idle'
  micError.value = false
  micFailCount = 0
  // 接通后：先说一句欢迎语（仅此一次），然后开始聆听
  setTimeout(() => {
    if (!callRunning) return
    greetingOnce()
    beginListening()
  }, 700)
}

/* 接通欢迎语：只在刚接通时说一次，之后保持安静聆听，绝不重复 */
function greetingOnce() {
  const prompt = t('ai.callPromptNone')
  const msgIdx = messages.value.length
  agentStore.addMessage({ role: 'assistant', content: prompt })
  callStatus.value = 'speaking'
  nextTick(() => speakText(prompt, msgIdx))
  // speakText onend 会自动 beginListening 恢复聆听
}

function hangupCall() {
  callRunning = false
  inCall.value = false
  callStatus.value = 'idle'
  clearWatchdog()
  abortRec()
  stopMic()
  stopSpeak()
}

/* ===== 通话核心：听 → 2秒静默 → 自动应答 ===== */
let lastSpeechAt = 0
let watchdogTimer = null

function beginListening() {
  if (!callRunning || !inCall.value || loading.value) return
  // 麦克风故障：进入提示态，不再无限引导
  if (micError.value) {
    callStatus.value = 'idle'
    clearWatchdog()
    return
  }
  callStatus.value = 'listening'

  // 录音通路（APK / 无原生识别的浏览器）：走「录一轮 → 上传识别 → 下一轮」的循环
  if (micMode === 'mr') {
    if (!mrBusy.value) startRecTurn()
    return
  }

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
    // 思考中或 AI 正在朗读时不触发；用户开口打断朗读后由 onresult 走下一轮
    if (loading.value || callStatus.value === 'thinking') return
    if (callStatus.value === 'speaking') return
    if (Date.now() - lastSpeechAt < 2000) return
    clearWatchdog()
    if (finalTranscript.trim()) {
      // 用户说完了但停住 → 提交并等 AI 回复
      commitSpeech()
    } else {
      // 完全没说话：保持安静聆听（不重复任何引导语）
      lastSpeechAt = Date.now()
      startWatchdog()
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

function pickZhVoice() {
  const voices = zhVoices()
  if (!voices.length) return null
  const mode = (localStorage.getItem('ai_voice') || 'auto').toLowerCase()
  const zh = v => v.lang && v.lang.toLowerCase().startsWith('zh')
  // 用户直接选中的具体音色名（如 Microsoft Kangkang...）→ 优先精确命中
  if (mode && !['auto', 'female', 'male'].includes(mode)) {
    const exact = voices.find(v => v.name.toLowerCase() === mode)
    if (exact) return exact
    const fuzzy = voices.find(v => zh(v) && v.name.toLowerCase().includes(mode))
    if (fuzzy) return fuzzy
  }
  const femalePrefs = [
    'xiaoxiao online', 'xiaoyi online', 'google 普通话', 'google 中文',
    'meijia', 'xiaoxiao', 'xiaoyi', 'huihui', 'yaoyao', 'tingting', 'lili', 'anny', 'woman', 'female', 'meijia'
  ]
  const malePrefs = [
    'yunxi online', 'yunyang online', 'google 中文（香港）',
    'yunxi', 'yunyang', 'kangkang', 'yunjian', 'danny', 'george', 'man', 'male'
  ]
  // 按用户选择的音色优先匹配，找不到则回退另一种性别，最后回退任意中文音色
  const prefs = mode === 'male' ? malePrefs.concat(femalePrefs) : mode === 'female' ? femalePrefs.concat(malePrefs) : femalePrefs.concat(malePrefs)
  for (const p of prefs) {
    const hit = voices.find(v => zh(v) && v.name.toLowerCase().includes(p))
    if (hit) return hit
  }
  return voices.find(zh) || null
}

function stopSpeak() {
  if (window.speechSynthesis) speechSynthesis.cancel()
  if (utterTimer) { clearTimeout(utterTimer); utterTimer = null }
  if (typeof clearSpeakWatchdog === 'function') clearSpeakWatchdog()
  if (nativeTts) { try { nativeTts.stop() } catch {} }
  speakingIndex.value = -1
}

/* ============ 语音朗读 ============
   三条路，按可用性降级：
     1. 安卓原生 TextToSpeech —— WebView 里根本没有可用的 speechSynthesis，
        不接这条路，APK 里 AI「只会发文字」而且通话会卡死在 speaking 状态；
     2. 浏览器 speechSynthesis —— 网页端/桌面端正常走这条；
     3. 都没有 —— 不朗读，直接继续听，绝不让通话卡住。
   任何一条都带超时看门狗，防止 onend 不回调把整通电话挂死。 */
let nativeTts = null
let nativeTtsTried = false
let speakWatchdog = null
let ttsFailCount = 0
let ttsBroken = false

const inNativeShell = () => !!(window.Capacitor?.isNativePlatform?.())

function clearSpeakWatchdog() {
  if (speakWatchdog) { clearTimeout(speakWatchdog); speakWatchdog = null }
}

function startSpeakWatchdog(content, idx) {
  clearSpeakWatchdog()
  // 中文按 ~4 字/秒 估算，再留 3 秒余量；估算偏大没关系，只是兜底
  const est = Math.max(4000, String(content || '').length * 260 + 3000)
  speakWatchdog = setTimeout(() => {
    if (speakingIndex.value !== idx) return
    speakingIndex.value = -1
    if (callRunning && inCall.value) beginListening()
  }, est)
}

async function loadNativeTts() {
  if (nativeTtsTried && !nativeTts) return false
  nativeTtsTried = true
  try {
    const mod = await import('@capacitor-community/text-to-speech')
    nativeTts = mod.TextToSpeech || null
    return !!nativeTts
  } catch {
    return false
  }
}

async function speakText(content, idx) {
  if (speakingIndex.value === idx) { stopSpeak(); return }
  stopSpeak()

  const finish = () => {
    speakingIndex.value = -1
    clearSpeakWatchdog()
    if (callRunning && inCall.value) beginListening()
  }

  // 1) 原生 TTS（APK）
  if (inNativeShell() && !ttsBroken) {
    const ok = await loadNativeTts()
    if (ok) {
      speakingIndex.value = idx
      startSpeakWatchdog(content, idx)
      try {
        await nativeTts.stop().catch(() => {})
        await nativeTts.speak({
          text: content,
          lang: 'zh-CN',
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0,
          // 关键：等真正播完再 resolve，否则通话会立刻进入下一轮录音
          awaitSpeakCompletion: true
        })
        ttsFailCount = 0
        finish()
        return
      } catch {
        ttsFailCount++
        // 手机没装中文语音引擎时会连续报错：两次之后就不再尝试，直接静音继续对话
        if (ttsFailCount >= 2) ttsBroken = true
        clearSpeakWatchdog()
        speakingIndex.value = -1
      }
    }
  }

  // 2) 浏览器合成
  if (window.speechSynthesis) {
    speakingIndex.value = idx
    startSpeakWatchdog(content, idx)
    // Chrome 的 cancel() 后立即 speak 可能被吞掉：等一小段再播，且保证音色列表已就绪
    utterTimer = setTimeout(() => {
      try {
        const u = new SpeechSynthesisUtterance(content)
        const v = pickZhVoice()
        if (v) u.voice = v
        u.lang = 'zh-CN'
        u.rate = 1.05
        u.pitch = 1
        u.onend = finish
        u.onerror = finish
        speechSynthesis.speak(u)
      } catch {
        finish()
      }
    }, 60)
    return
  }

  // 3) 彻底没有语音能力：不朗读，继续听
  if (callRunning && inCall.value) setTimeout(beginListening, 250)
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
  if (!inCall.value) { stopMic(); abortRec() } // 通话模式保持识别常开，thinking 阶段也能继续听
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
  // 预加载语音列表（部分浏览器异步加载 voices）+ 监听就绪事件
  if (window.speechSynthesis) {
    speechSynthesis.getVoices()
    speechSynthesis.onvoiceschanged = () => setTimeout(refreshVoiceCache, 0)
    setTimeout(refreshVoiceCache, 400)
  }
})

onUnmounted(() => {
  hangupCall()
  abortRec()
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
