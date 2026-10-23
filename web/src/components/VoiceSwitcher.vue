<template>
  <div class="voice-switcher" :class="{ inline }">
    <template v-if="!inline">
      <transition name="pop">
        <div v-if="open" class="vs-panel">
          <div class="vs-title">{{ $t('voice.title') }}</div>
          <div class="vs-grid">
            <div
              v-for="v in voices"
              :key="v.id"
              class="vs-card"
              :class="{ active: current === v.id }"
              @click="choose(v.id)"
            >
              <div class="vs-emoji">{{ v.emoji }}</div>
              <div class="vs-name">{{ $t(`voice.${v.id}`) }}</div>
              <div class="vs-dot" v-if="current === v.id"></div>
            </div>
          </div>
          <div class="vs-tip">{{ $t('voice.tip') }}</div>
        </div>
      </transition>
      <button class="vs-btn" :class="{ on: open }" @click="open = !open" :title="$t('voice.title')">
        <el-icon :size="20"><Microphone /></el-icon>
      </button>
    </template>

    <!-- 内联模式（个人中心）：紧凑胶囊入口，hover 渐变展开，与主题一致 -->
    <div v-else class="vs-inline" @mouseenter="open = true" @mouseleave="open = false">
      <div class="vs-trigger">
        <el-icon :size="15"><Microphone /></el-icon>
        <span class="vs-trigger-label">{{ $t('voice.title') }}</span>
        <span class="vs-current">{{ $t(`voice.${current}`) }}</span>
        <el-icon :size="12" class="vs-caret"><ArrowDown /></el-icon>
      </div>
      <transition name="pop">
        <div v-if="open" class="vs-panel-sm">
          <div
            v-for="v in voices"
            :key="v.id"
            class="vs-card-sm"
            :class="{ active: current === v.id }"
            @click="choose(v.id)"
          >
            <div class="vs-emoji-sm">{{ v.emoji }}</div>
            <div class="vs-name-sm">{{ $t(`voice.${v.id}`) }}</div>
            <div class="vs-dot" v-if="current === v.id"></div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Microphone, ArrowDown } from '@element-plus/icons-vue'

const props = defineProps({
  inline: { type: Boolean, default: false }
})

const open = ref(false)
const current = ref(localStorage.getItem('ai_voice') || 'auto')
const voices = [
  { id: 'auto', emoji: '✨' },
  { id: 'female', emoji: '🎀' },
  { id: 'male', emoji: '🧢' }
]

function choose(id) {
  localStorage.setItem('ai_voice', id)
  current.value = id
  // 触发自定义事件，便于其他组件（如 AiChat）即时感知
  window.dispatchEvent(new CustomEvent('ai-voice-changed', { detail: id }))
}

function onVoiceChanged(e) {
  if (e.detail) current.value = e.detail
}

function onDocClick(e) {
  if (!open.value) return
  if (!e.target.closest('.voice-switcher')) open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  window.addEventListener('ai-voice-changed', onVoiceChanged)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  window.removeEventListener('ai-voice-changed', onVoiceChanged)
})
</script>

<style scoped>
.voice-switcher {
  position: fixed;
  right: 26px;
  bottom: 148px;
  z-index: 900;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
/* 内联模式：个人中心紧凑入口 + hover 渐变面板（与主题一致）*/
.voice-switcher.inline {
  position: static;
  width: 100%;
  display: block;
}
.vs-inline {
  position: relative;
}
.vs-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--accent-soft, rgba(66, 165, 245, 0.1));
  border: 1px solid var(--card-border, rgba(180, 160, 120, 0.2));
  color: var(--text-main);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: box-shadow 0.25s var(--ease-smooth), transform 0.2s var(--ease-spring);
  user-select: none;
}
.vs-trigger:hover {
  box-shadow: 0 6px 18px var(--accent-soft, rgba(66, 165, 245, 0.18));
  transform: translateY(-1px);
}
.vs-trigger-label { color: var(--text-sub, #78909c); }
.vs-current {
  color: var(--accent);
  font-weight: 700;
  font-size: 12.5px;
}
.vs-caret {
  color: var(--text-sub, #78909c);
  transition: transform 0.25s var(--ease-smooth);
}
.vs-inline:hover .vs-caret {
  transform: rotate(180deg);
}
.vs-panel-sm {
  position: absolute;
  left: 0;
  top: calc(100% + 8px);
  width: 248px;
  padding: 12px;
  border-radius: 16px;
  background: var(--nav-bg, rgba(255, 255, 255, 0.97));
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid var(--card-border, rgba(180, 160, 120, 0.2));
  box-shadow: 0 16px 44px rgba(0, 0, 0, 0.16);
  z-index: 60;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.vs-card-sm {
  position: relative;
  cursor: pointer;
  border-radius: 12px;
  padding: 8px 5px 6px;
  border: 2px solid transparent;
  transition: all 0.22s var(--ease-spring);
  text-align: center;
}
.vs-card-sm:hover {
  transform: translateY(-3px);
  background: var(--accent-soft, rgba(66, 165, 245, 0.08));
}
.vs-card-sm.active {
  border-color: var(--accent);
  box-shadow: 0 6px 18px var(--accent-soft, rgba(66, 165, 245, 0.2));
}
.vs-emoji-sm {
  font-size: 26px;
  margin-bottom: 4px;
}
.vs-name-sm {
  font-size: 11.5px;
  color: var(--text-sub);
  font-weight: 600;
}
.pop-enter-active,
.pop-leave-active {
  transition: all 0.24s var(--ease-smooth);
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.97);
}
</style>
