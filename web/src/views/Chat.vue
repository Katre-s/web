<template>
  <div class="chat-page">
    <h2 class="page-title">我的对话</h2>
    <div v-loading="loading">
      <div v-if="messages.length" class="message-list">
        <div v-for="msg in messages" :key="msg.id" class="message-card">
          <div class="msg-header">
            <span class="msg-product" v-if="msg.productId">商品 #{{ msg.productId }}</span>
            <span class="msg-time">{{ formatTime(msg.createdAt) }}</span>
          </div>
          <p class="msg-content">{{ msg.content }}</p>
          <div class="msg-status">
            <el-tag size="small" :type="msg.isRead ? 'info' : 'primary'">
              {{ msg.isRead ? '已读' : '未读' }}
            </el-tag>
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无消息" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { messageApi } from '@/api'

const messages = ref([])
const loading = ref(false)

async function loadMessages() {
  loading.value = true
  try {
    const res = await messageApi.list()
    messages.value = res.data || res || []
  } finally {
    loading.value = false
  }
}

function formatTime(time) {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

onMounted(loadMessages)
</script>

<style scoped>
.page-title {
  font-size: 22px;
  font-weight: 700;
  color: #0d2847;
  margin-bottom: 20px;
}
.message-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.message-card {
  background: #fff;
  border-radius: 14px;
  padding: 20px 24px;
  box-shadow: 0 2px 12px rgba(13, 40, 71, 0.06);
  transition: all 0.3s;
}
.message-card:hover {
  box-shadow: 0 4px 20px rgba(66, 165, 245, 0.12);
}
.msg-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}
.msg-product {
  font-size: 14px;
  color: #42a5f5;
  font-weight: 500;
}
.msg-time {
  font-size: 13px;
  color: #90a4ae;
}
.msg-content {
  font-size: 15px;
  color: #37474f;
  line-height: 1.6;
  margin-bottom: 12px;
}
</style>