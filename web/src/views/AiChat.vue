<template>
  <div class="ai-chat-page">
    <div class="ai-header">
      <span class="ai-title">🤖 文衡智能助手</span>
      <span class="ai-tag">AI</span>
    </div>
    <div class="ai-messages" ref="msgBox">
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
    <div class="ai-input">
      <el-input
        v-model="text"
        placeholder="问我：怎么买书？有什么编程书？"
        @keyup.enter="send"
        :disabled="loading"
      />
      <el-button type="primary" :loading="loading" @click="send">发送</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted } from 'vue'
import { agentApi } from '@/api'
import { ElMessage } from 'element-plus'

const messages = ref([])
const text = ref('')
const loading = ref(false)
const msgBox = ref(null)

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

onMounted(() => {
  messages.value.push({
    role: 'assistant',
    content: '你好呀！我是文衡智能助手，可以帮你找书、指导卖书、查订单，也可以陪你聊天～',
    intent: 'chat'
  })
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
}
.ai-title { font-size: 16px; font-weight: 700; color: #0d2847; }
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
.typing { color: #90a4ae; }
.ai-input {
  padding: 12px 16px;
  border-top: 1px solid #f0f4f8;
  display: flex;
  gap: 10px;
}
@media (max-width: 768px) {
  .ai-chat-page { height: calc(100vh - 160px); }
}
</style>
