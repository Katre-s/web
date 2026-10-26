<template>
  <div class="voice-switcher" :class="{ inline }">
    <template v-if="!inline">
      <transition name="pop">
        <div v-if="open" class="vs-panel">
          <div class="vs-title">{{ $t('voice.title') }}</div>
          <div class="vs-grid">
            <div
              v-for="v in quickVoices"
              :key="v.id"
              class="vs-card"
              :class="{ active: isActive(v.id) }"
              @click="choose(v.id)"
            >
              <div class="vs-emoji">{{ v.emoji }}</div>
              <div class="vs-name">{{ $t(`voice.${v.id}`) }}</div>
              <div class="vs-dot" v-if="isActive(v.id)"></div>
            </div>
          </div>
          <div class="vs-tip">{{ $t('voice.tip') }}</div>
        </div>
      </transition>
      <button class="vs-btn" :class="{ on: open }" @click="open = !open" :title="$t('voice.title')">
        <el-icon :size="20"><Microphone /></el-icon>
      </button>
    </template>

    <!-- 内联模式（个人中心）：点击展开的紧凑面板，与主题一致 -->
    <div v-else class="vs-inline" :class="{ open, compact }">
      <button
        type="button"
        class="vs-trigger"
        :aria-expanded="open"
        @click="open = !open"
      >
        <el-icon :size="15"><Microphone /></el-icon>
        <span class="vs-trigger-label">{{ $t('voice.title') }}</span>
        <span class="vs-current">{{ currentLabel }}</span>
        <el-icon :size="12" class="vs-caret"><ArrowDown /></el-icon>
      </button>
      <transition name="pop">
        <div v-if="open" class="vs-panel-sm">
          <div class="vs-quick">
            <div
              v-for="v in quickVoices"
              :key="v.id"
              class="vs-card-sm"
              :class="{ active: isActive(v.id) }"
              @click="choose(v.id)"
            >
              <div class="vs-emoji-sm">{{ v.emoji }}</div>
              <div class="vs-name-sm">{{ $t(`voice.${v.id}`) }}</div>
              <div class="vs-dot" v-if="isActive(v.id)"></div>
            </div>
          </div>
          <!-- 当前浏览器真实可用的中文音色：分组展示，精确可点选 -->
          <template v-if="groups.female.length || groups.male.length">
            <div v-if="groups.female.length" class="vs-group">
              <div class="vs-group-title">🎀 {{ $t('voice.female') }}</div>
              <div
                v-for="name in groups.female"
                :key="name"
                class="vs-voice-row"
                :class="{ active: isActive(name) }"
                @click="choose(name)"
              >
                <span class="vs-voice-name">{{ shortName(name) }}</span>
                <span class="vs-check" v-if="isActive(name)">✓</span>
              </div>
            </div>
            <div v-if="groups.male.length" class="vs-group">
              <div class="vs-group-title">🧢 {{ $t('voice.male') }}</div>
              <div
                v-for="name in groups.male"
                :key="name"
                class="vs-voice-row"
                :class="{ active: isActive(name) }"
                @click="choose(name)"
              >
                <span class="vs-voice-name">{{ shortName(name) }}</span>
                <span class="vs-check" v-if="isActive(name)">✓</span>
              </div>
            </div>
          </template>
          <div v-else class="vs-no-voice">{{ $t('voice.noVoice') }}</div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Microphone, ArrowDown } from '@element-plus/icons-vue'

const props = defineProps({
  inline: { type: Boolean, default: false },
  // 紧凑模式：只留图标 + 当前音色，用于个人中心余额行这种窄位置
  compact: { type: Boolean, default: false }
})

const { t } = useI18n()

const open = ref(false)
const current = ref(localStorage.getItem('ai_voice') || 'auto')
const available = ref([])

const quickVoices = [
  { id: 'auto', emoji: '✨' },
  { id: 'female', emoji: '🎀' },
  { id: 'male', emoji: '🧢' }
]

const FEMALE_HINT = ['xiaoxiao', 'xiaoyi', 'huihui', 'yaoyao', 'tingting', 'lili', 'anny', 'meijia', 'woman', 'female', 'google 普通话', 'google 中文']
const MALE_HINT = ['kangkang', 'yunxi', 'yunyang', 'yunjian', 'danny', 'george', 'man', 'male', 'google 中文（香港）']

function classify(name) {
  const n = name.toLowerCase()
  for (const h of FEMALE_HINT) if (n.includes(h)) return 'female'
  for (const h of MALE_HINT) if (n.includes(h)) return 'male'
  return 'other'
}

const groups = computed(() => {
  const g = { female: [], male: [], other: [] }
  for (const v of available.value) g[classify(v)].push(v)
  return g
})

function isActive(id) {
  if (current.value === id) return true
  // 快速档与具体音色的联动：选了女声但当前是具体女声音色也算激活
  if (id === 'female' && !['auto', 'female', 'male'].includes(current.value) && classify(current.value) === 'female') return true
  if (id === 'male' && !['auto', 'female', 'male'].includes(current.value) && classify(current.value) === 'male') return true
  return false
}

const currentLabel = computed(() => {
  // 三档快捷值走 i18n（自动 / 女声 / 男声），具体音色名保留浏览器给的原文
  if (['auto', 'female', 'male'].includes(current.value)) return t(`voice.${current.value}`)
  return shortName(current.value)
})

function shortName(name) {
  // "Microsoft Huihui - Chinese (Simplified, PRC)" → "Huihui"
  // "Xiaoxiao Online - Chinese (China)" → "Xiaoxiao"
  let n = String(name || '')
  n = n.split(' - ')[0].trim()
  n = n.replace(/^Microsoft\s+/i, '').replace(/^Google\s+/i, '')
  const skipWords = ['online', 'neural', 'natural', 'local']
  const words = n.split(/\s+/).filter(Boolean)
  if (words.length > 1) {
    let last = words[words.length - 1]
    if (skipWords.includes(last.toLowerCase()) && words.length > 1) last = words[words.length - 2]
    n = last
  }
  return n || String(name).slice(0, 18)
}

function choose(id) {
  localStorage.setItem('ai_voice', id)
  current.value = id
  window.dispatchEvent(new CustomEvent('ai-voice-changed', { detail: id }))
  // 内联面板选中即收起，避免挡住下面的内容
  if (props.inline) open.value = false
}

function refreshVoices(names) {
  if (Array.isArray(names) && names.length) {
    available.value = names.filter(n => /zh|Chinese|chinese/i.test(n) || /[\u4e00-\u9fa5]/.test(n))
  } else if (window.speechSynthesis) {
    const zh = speechSynthesis.getVoices().filter(v => v.lang && v.lang.toLowerCase().startsWith('zh'))
    if (zh.length) available.value = zh.map(v => v.name)
  }
}

function onVoiceChanged(e) {
  if (e.detail) current.value = e.detail
}

function onVoicesReady(e) {
  refreshVoices(e.detail)
}

function onDocClick(e) {
  if (!open.value) return
  if (!e.target.closest('.voice-switcher')) open.value = false
}

function onKeydown(e) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('ai-voice-changed', onVoiceChanged)
  window.addEventListener('ai-voices-ready', onVoicesReady)
  refreshVoices()
  if (window.speechSynthesis) {
    speechSynthesis.getVoices()
    speechSynthesis.onvoiceschanged = () => setTimeout(refreshVoices, 0)
    setTimeout(refreshVoices, 400)
  }
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('ai-voice-changed', onVoiceChanged)
  window.removeEventListener('ai-voices-ready', onVoicesReady)
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
.voice-switcher.inline {
  position: static;
  width: 100%;
  display: block;
}
/* 关键：inline-block，热区只覆盖胶囊本身，不再撑满整张卡片 */
.vs-inline {
  position: relative;
  display: inline-block;
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
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  cursor: pointer;
  transition: box-shadow 0.25s var(--ease-smooth), transform 0.2s var(--ease-spring);
  user-select: none;
  -webkit-tap-highlight-color: transparent;
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
.vs-inline.open .vs-caret {
  transform: rotate(180deg);
}
.vs-inline.open .vs-trigger {
  box-shadow: 0 6px 18px var(--accent-soft, rgba(66, 165, 245, 0.18));
}
/* 紧凑模式：藏掉「AI 音色」这层说明文字，只留图标 + 当前音色 + 箭头 */
.vs-inline.compact .vs-trigger-label {
  display: none;
}
.vs-inline.compact .vs-trigger {
  padding: 4px 10px;
  font-size: 12.5px;
  gap: 5px;
}
.vs-inline.compact .vs-current {
  font-size: 12px;
}
/* 迷你面板：218px 宽，音色列表限高滚动，整体不再拉很长 */
.vs-panel-sm {
  position: absolute;
  left: 0;
  top: 100%;
  margin-top: 6px;
  width: 218px;
  padding: 8px;
  border-radius: 14px;
  background: var(--nav-bg, rgba(255, 255, 255, 0.97));
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid var(--card-border, rgba(180, 160, 120, 0.2));
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.16);
  z-index: 60;
  max-height: 290px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.vs-quick {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-bottom: 6px;
}
.vs-card-sm {
  position: relative;
  cursor: pointer;
  border-radius: 10px;
  padding: 4px 3px 3px;
  border: 2px solid transparent;
  transition: all 0.22s var(--ease-spring);
  text-align: center;
}
.vs-card-sm:hover {
  transform: translateY(-2px);
  background: var(--accent-soft, rgba(66, 165, 245, 0.08));
}
.vs-card-sm.active {
  border-color: var(--accent);
  box-shadow: 0 5px 14px var(--accent-soft, rgba(66, 165, 245, 0.2));
}
.vs-emoji-sm {
  font-size: 18px;
  line-height: 1.2;
  margin-bottom: 1px;
}
.vs-name-sm {
  font-size: 10.5px;
  line-height: 1.3;
  color: var(--text-sub);
  font-weight: 600;
}
.vs-card-sm .vs-dot {
  top: 4px;
  right: 4px;
  width: 6px;
  height: 6px;
}
.vs-group {
  border-top: 1px dashed var(--card-border, rgba(180, 160, 120, 0.25));
  padding-top: 5px;
  margin-top: 3px;
}
.vs-group-title {
  font-size: 10.5px;
  color: var(--text-sub, #78909c);
  font-weight: 700;
  margin-bottom: 3px;
}
.vs-voice-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 7px;
  border-radius: 7px;
  cursor: pointer;
  font-size: 11.5px;
  line-height: 1.4;
  color: var(--text-main);
  transition: background 0.18s var(--ease-smooth);
}
.vs-voice-row:hover {
  background: var(--accent-soft, rgba(66, 165, 245, 0.08));
}
.vs-voice-row.active {
  background: var(--accent-soft, rgba(66, 165, 245, 0.14));
  color: var(--accent);
  font-weight: 700;
}
.vs-check {
  color: var(--accent);
  font-weight: 800;
}
.vs-no-voice {
  padding: 6px 4px 2px;
  font-size: 11px;
  color: var(--text-sub, #78909c);
  text-align: center;
  border-top: 1px dashed var(--card-border, rgba(180, 160, 120, 0.25));
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
