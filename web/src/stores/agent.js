import { defineStore } from 'pinia'

const STORAGE_KEY = 'ai_chat_messages'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export const useAgentStore = defineStore('agent', {
  state: () => ({
    messages: load()
  }),
  actions: {
    addMessage(msg) {
      this.messages.push(msg)
      this.persist()
    },
    persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.messages))
      } catch {}
    },
    clear() {
      this.messages = []
      this.persist()
    }
  }
})
