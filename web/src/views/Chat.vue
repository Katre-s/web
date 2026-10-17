<template>
  <div class="chat-page">
    <h2 class="page-title">我的对话</h2>
    <div v-loading="loading">
      <div class="chat-layout" v-if="conversations.length">
        <div class="conv-list" v-show="!isMobile || !mobileShowChat">
          <div
            v-for="conv in conversations"
            :key="conv.id"
            class="conv-item"
            :class="{ active: activeConvId === conv.id }"
            @click="selectConv(conv)"
          >
            <div class="conv-avatar">
              {{ getOtherUser(conv)?.nickname?.charAt(0) || '?' }}
            </div>
            <div class="conv-info">
              <div class="conv-top">
                <span class="conv-name">{{ getOtherUser(conv)?.nickname || '未知' }}</span>
                <span class="conv-time">{{ formatTime(conv.lastMessageAt) }}</span>
              </div>
              <div class="conv-bottom">
                <span class="conv-last">{{ conv.lastMessage || '开始对话...' }}</span>
                <el-badge v-if="conv.unreadCount" :value="conv.unreadCount" class="conv-badge" />
              </div>
            </div>
          </div>
        </div>

        <div class="chat-window" v-show="!isMobile || mobileShowChat">
          <div class="chat-header" v-if="activeConv">
            <button v-if="isMobile" class="chat-back" @click="backToList">
              <el-icon><ArrowLeft /></el-icon>
            </button>
            <span>{{ getOtherUser(activeConv)?.nickname || '对话' }}</span>
            <span class="chat-product" v-if="activeConv.product?.bookTitle">
              {{ activeConv.product.bookTitle }}
            </span>
          </div>
          <div class="chat-messages" ref="msgContainer">
            <div
              v-for="msg in messages"
              :key="msg.id"
              class="msg-row"
              :class="{ mine: msg.senderId === userStore.userInfo?.id }"
            >
              <div class="msg-bubble">{{ msg.content }}</div>
              <div class="msg-time">{{ formatTime(msg.created_at) }}</div>
            </div>
            <el-empty v-if="!messages.length" description="暂无消息" />
          </div>
          <div class="chat-input" v-if="activeConv">
            <el-input
              v-model="inputText"
              placeholder="输入消息..."
              @keyup.enter="sendMsg"
            />
            <el-button type="primary" @click="sendMsg">发送</el-button>
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无对话，去交易市场联系卖家吧" />
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { conversationApi } from '@/api'
import { useUserStore } from '@/stores/user'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'

const userStore = useUserStore()
const loading = ref(false)
const conversations = ref([])
const activeConvId = ref(null)
const activeConv = ref(null)
const messages = ref([])
const inputText = ref('')
const msgContainer = ref(null)
const isMobile = ref(window.innerWidth <= 768)
const mobileShowChat = ref(false)
let pollTimer = null

function onResize() {
  isMobile.value = window.innerWidth <= 768
  if (!isMobile.value) mobileShowChat.value = false
}

function getOtherUser(conv) {
  if (!conv) return null
  return conv.buyer?.id === userStore.userInfo?.id ? conv.seller : conv.buyer
}

function formatTime(time) {
  if (!time) return ''
  const d = new Date(time)
  const now = new Date()
  const diff = now - d
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

async function loadConversations(silent = false) {
  if (!silent) loading.value = true
  try {
    const res = await conversationApi.list()
    conversations.value = res.data || res || []
    if (conversations.value.length && !activeConvId.value && !isMobile.value) {
      selectConv(conversations.value[0])
    }
  } finally {
    if (!silent) loading.value = false
  }
}

async function selectConv(conv) {
  activeConvId.value = conv.id
  activeConv.value = conv
  if (isMobile.value) mobileShowChat.value = true
  await refreshMessages(conv.id)
}

function backToList() {
  mobileShowChat.value = false
}

function onBackPress() {
  if (isMobile.value && mobileShowChat.value) {
    backToList()
    window.__backConsumed = true
  }
}

async function refreshMessages(convId) {
  try {
    const res = await conversationApi.getMessages(convId)
    messages.value = res.data || res || []
    await nextTick()
    scrollToBottom()
  } catch {}
}

function scrollToBottom() {
  if (msgContainer.value) {
    msgContainer.value.scrollTop = msgContainer.value.scrollHeight
  }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    try {
      const res = await conversationApi.list()
      conversations.value = res.data || res || []
    } catch {}
    if (activeConvId.value) {
      await refreshMessages(activeConvId.value)
    }
  }, 3000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function sendMsg() {
  if (!inputText.value.trim() || !activeConvId.value) return
  try {
    await conversationApi.sendMessage(activeConvId.value, inputText.value)
    inputText.value = ''
    await refreshMessages(activeConvId.value)
    loadConversations(true)
  } catch {
    ElMessage.error('发送失败')
  }
}

onMounted(() => {
  loadConversations()
  startPolling()
  window.addEventListener('resize', onResize)
  window.addEventListener('wenheng:back-press', onBackPress)
})

onUnmounted(() => {
  stopPolling()
  window.removeEventListener('resize', onResize)
  window.removeEventListener('wenheng:back-press', onBackPress)
})
</script>

<style scoped>
.chat-page { padding-bottom: 40px; }
.page-title { font-size: 22px; font-weight: 700; color: #0d2847; margin-bottom: 20px; }
.chat-layout {
  display: flex;
  gap: 16px;
  height: calc(100vh - 160px);
  min-height: 400px;
}
.conv-list {
  width: 280px;
  background: #fff;
  border-radius: 14px;
  overflow-y: auto;
  box-shadow: 0 2px 12px rgba(13, 40, 71, 0.06);
  flex-shrink: 0;
}
.conv-item {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid #f0f4f8;
}
.conv-item:hover { background: #f5f7fa; }
.conv-item.active { background: rgba(66, 165, 245, 0.08); }
.conv-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #42a5f5, #1e88e5);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  flex-shrink: 0;
}
.conv-info { flex: 1; min-width: 0; }
.conv-top { display: flex; justify-content: space-between; margin-bottom: 4px; }
.conv-name { font-size: 14px; font-weight: 600; color: #0d2847; }
.conv-time { font-size: 11px; color: #b0bec5; }
.conv-bottom { display: flex; justify-content: space-between; align-items: center; }
.conv-last {
  font-size: 12px;
  color: #90a4ae;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}
.chat-window {
  flex: 1;
  background: #fff;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 12px rgba(13, 40, 71, 0.06);
  overflow: hidden;
}
.chat-header {
  padding: 16px 20px;
  border-bottom: 1px solid #f0f4f8;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  color: #0d2847;
}
.chat-product { font-size: 13px; color: #42a5f5; font-weight: 400; }
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.msg-row { display: flex; flex-direction: column; gap: 4px; }
.msg-row.mine { align-items: flex-end; }
.msg-bubble {
  max-width: 70%;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  background: #f0f4f8;
  color: #37474f;
  word-break: break-word;
}
.msg-row.mine .msg-bubble {
  background: linear-gradient(135deg, #42a5f5, #1e88e5);
  color: #fff;
}
.msg-time { font-size: 11px; color: #b0bec5; }
.chat-input {
  padding: 12px 16px;
  border-top: 1px solid #f0f4f8;
  display: flex;
  gap: 10px;
}
.chat-back {
  display: none;
  border: none;
  background: transparent;
  padding: 4px;
  margin-right: 4px;
  color: #0d2847;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}
@media (max-width: 768px) {
  .chat-page { padding-bottom: 16px; }
  .chat-layout {
    flex-direction: column;
    height: auto;
    min-height: calc(100vh - 200px);
  }
  .conv-list {
    width: 100%;
    max-height: none;
    flex: none;
  }
  .chat-window {
    min-height: calc(100vh - 250px);
    width: 100%;
  }
  .chat-back {
    display: flex;
  }
  .chat-header {
    padding: 12px 14px;
  }
  .chat-input {
    padding: 10px 12px;
  }
}
</style>