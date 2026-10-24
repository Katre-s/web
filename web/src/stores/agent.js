import { defineStore } from 'pinia'

// 历史记录必须按用户隔离。
// 之前 key 是写死的 'ai_chat_messages'：同一台电脑（机房/宿舍共用浏览器）上
// 任何账号登录都会读到同一份 AI 聊天记录，既串号又越来越长。
const STORAGE_PREFIX = 'ai_chat_messages'
// 只保留最近 N 条，避免无限膨胀导致进页面要拉很久
const MAX_KEEP = 80

function keyOf(uid) {
  return `${STORAGE_PREFIX}_${uid || 'guest'}`
}

function load(uid) {
  try {
    const raw = localStorage.getItem(keyOf(uid))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export const useAgentStore = defineStore('agent', {
  state: () => ({
    uid: '',
    messages: []
  }),
  actions: {
    /**
     * 绑定当前登录用户并载入他 / 她自己的历史。
     * 登录态变化（换账号、退出）时都要调一次。
     */
    bindUser(uid) {
      const next = String(uid || 'guest')
      if (next === this.uid) return
      // 迁移期清理：老的共享 key 无法确定归属，直接丢弃，避免继续串号
      try { localStorage.removeItem(STORAGE_PREFIX) } catch {}
      this.uid = next
      this.messages = load(next)
    },
    addMessage(msg) {
      this.messages.push(msg)
      if (this.messages.length > MAX_KEEP) {
        this.messages = this.messages.slice(-MAX_KEEP)
      }
      this.persist()
    },
    persist() {
      if (!this.uid) return
      try {
        localStorage.setItem(keyOf(this.uid), JSON.stringify(this.messages))
      } catch {}
    },
    clear() {
      this.messages = []
      this.persist()
    }
  }
})
