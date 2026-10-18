<template>
  <!-- 悬浮按钮 -->
  <div v-if="isLoggedIn && !hidden && !opened" class="ai-float-btn" @click="opened = true" title="文衡AI助手">
    <el-icon :size="26"><MagicStick /></el-icon>
  </div>

  <!-- 悬浮聊天窗 -->
  <div v-if="isLoggedIn && !hidden && opened" class="ai-float-window">
    <div class="ai-float-header">
      <span class="ai-float-title">🤖 文衡智能助手</span>
      <div class="ai-float-ops">
        <span class="ai-op" title="收起" @click="opened = false"><el-icon><Minus /></el-icon></span>
        <span class="ai-op" title="隐藏悬浮窗" @click="hideFloat"><el-icon><Close /></el-icon></span>
      </div>
    </div>
    <div class="ai-float-messages" ref="msgBox">
      <div class="ai-msg" v-for="(m, i) in messages" :key="i" :class="{ user: m.role === 'user' }">
        <div class="ai-bubble">
          <div v-if="m.intent && m.role === 'assistant'" class="ai-intent">{{ intentText(m.intent) }}</div>
          <div class="ai-content">{{ m.content }}</div>
        </div>
      </div>
      <div v-if="loading" class="ai-msg">
        <div class="ai-bubble typing">正在思考…</div>
      </div>
    </div>
    <div class="ai-float-input">
      <el-input v-model="text" placeholder="问我：怎么买书？有什么编程书？" @keyup.enter="send" :disabled="loading" />
      <el-button type="primary" :loading="loading" @click="send">发送</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { agentApi } from '@/api'
import { ElMessage } from 'element-plus'
import { MagicStick, Minus, Close } from '@element-plus/icons-vue'

const userStore = useUserStore()
const isLoggedIn = computed(() => userStore.isLoggedIn)

const messages = ref([])
const text = ref('')
const loading = ref(false)
const msgBox = ref(null)
const opened = ref(false)
const hidden = ref(localStorage.getItem('ai_float_hidden') === '1')

const INTENTS = {
  buy: '🛒 想买书',
  sell: '📤 想卖书',
  search: '🔍 找书',
  order: '📦 订单',
  help: '💡 平台咨询',
  chat: '💬 闲聊'
}
function intentText(i) {
  return INTENTS[i] || ''
}

function scrollBottom() {
  nextTick(() => {
    if (msgBox.value) msgBox.value.scrollTop = msgBox.value.scrollHeight
  })
}

async function send() {
  const content = text.value.trim()
  if (!content || loading.value) return
  text.value = ''
  messages.value.push({ role: 'user', content })
  loading.value = true
  scrollBottom()

  const history = messages.value
    .slice(0, -1)
    .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))

  try {
    const res = await agentApi.chat(content, history)
    const data = res.data || res
    messages.value.push({ role: 'assistant', content: data.reply, intent: data.intent })
  } catch {
    ElMessage.error('AI 服务暂时不可用，请稍后再试')
  } finally {
    loading.value = false
    scrollBottom()
  }
}

function hideFloat() {
  hidden.value = true
  opened.value = false
  localStorage.setItem('ai_float_hidden', '1')
  ElMessage.info('悬浮窗已隐藏，可在顶部导航「AI助手」恢复')
}

function restore() {
  hidden.value = false
  opened.value = false
  localStorage.removeItem('ai_float_hidden')
}

window.addEventListener('ai-float-restore', restore)

onMounted(() => {
  messages.value.push({
    role: 'assistant',
    content: '你好呀！我是文衡智能助手，可以帮你找书、指导卖书、查订单，也可以陪你聊天～',
    intent: 'chat'
  })
})

onUnmounted(() => {
  window.removeEventListener('ai-float-restore', restore)
})
</script>

<style scoped>
.ai-float-btn {
  position: fixed;
  right: 24px;
  bottom: 88px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #42a5f5, #1e88e5);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 20px rgba(30, 136, 229, 0.45);
  cursor: pointer;
  z-index: 300;
  transition: transform 0.2s, box-shadow 0.2s;
}
.ai-float-btn:hover {
  transform: scale(1.08);
  box-shadow: 0 8px 26px rgba(30, 136, 229, 0.55);
}
.ai-float-window {
  position: fixed;
  right: 24px;
  bottom: 88px;
  width: 360px;
  height: 520px;
  max-height: 70vh;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(13, 40, 71, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 300;
}
.ai-float-header {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f4f8;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
}
.ai-float-title {
  font-size: 15px;
  font-weight: 700;
  color: #0d2847;
}
.ai-float-ops {
  display: flex;
  gap: 4px;
}
.ai-op {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #90a4ae;
  cursor: pointer;
  transition: all 0.2s;
}
.ai-op:hover {
  background: rgba(66, 165, 245, 0.1);
  color: #1e88e5;
}
.ai-float-messages {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #fafbfd;
}
.ai-msg { display: flex; }
.ai-msg.user { justify-content: flex-end; }
.ai-bubble {
  max-width: 78%;
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
.typing { color: #90a4ae; }
.ai-float-input {
  padding: 12px 14px;
  border-top: 1px solid #f0f4f8;
  display: flex;
  gap: 8px;
  background: #fff;
}
@media (max-width: 768px) {
  .ai-float-btn {
    right: 14px;
    bottom: 98px;
    width: 48px;
    height: 48px;
  }
  .ai-float-window {
    right: 10px;
    left: 10px;
    bottom: 98px;
    width: auto;
    height: 60vh;
  }
}
</style>
