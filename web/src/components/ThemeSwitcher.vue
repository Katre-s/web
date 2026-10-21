<template>
  <div class="theme-switcher">
    <transition name="pop">
      <div v-if="open" class="ts-panel">
        <div class="ts-title">{{ $t('theme.title') }}</div>
        <div class="ts-grid">
          <div
            v-for="t in themes"
            :key="t.id"
            class="ts-card"
            :class="{ active: themeStore.theme === t.id }"
            @click="choose(t.id)"
          >
            <div class="ts-preview" :style="t.preview"></div>
            <div class="ts-name">{{ $t(`theme.${t.id}`) }}</div>
            <div class="ts-dot" v-if="themeStore.theme === t.id"></div>
          </div>
        </div>
        <div class="ts-tip">{{ $t('theme.tip') }}</div>
      </div>
    </transition>

    <button class="ts-btn" :class="{ on: open }" @click="open = !open" :title="$t('theme.title')">
      <el-icon :size="20"><Brush /></el-icon>
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Brush } from '@element-plus/icons-vue'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
const open = ref(false)

const themes = [
  { id: 'default', preview: 'linear-gradient(135deg,#e3f2fd,#fff3e0 55%,#e8f5e9)' },
  { id: 'cute', preview: 'linear-gradient(135deg,#ffe0ef,#e9d5ff 55%,#fff0f6)' },
  { id: 'tech', preview: 'linear-gradient(135deg,#0b1020,#1b2a5e 55%,#0e7490)' },
]

function choose(t) {
  themeStore.setTheme(t)
}

function onDocClick(e) {
  if (!open.value) return
  if (!e.target.closest('.theme-switcher')) open.value = false
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<style scoped>
.theme-switcher {
  position: fixed;
  right: 26px;
  bottom: 96px;
  z-index: 900;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.ts-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid var(--hero-glass-border, rgba(66, 165, 245, 0.35));
  background: var(--nav-bg, rgba(255, 255, 255, 0.9));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--accent);
  box-shadow: var(--glow, 0 0 20px rgba(66, 165, 245, 0.25));
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
}
.ts-btn:hover,
.ts-btn.on {
  transform: rotate(45deg) scale(1.08);
  box-shadow: 0 0 26px var(--accent-soft, rgba(66, 165, 245, 0.3));
}
.ts-panel {
  margin-bottom: 12px;
  width: 300px;
  padding: 16px;
  border-radius: 18px;
  background: var(--nav-bg, rgba(255, 255, 255, 0.95));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--card-border, rgba(180, 160, 120, 0.2));
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.18);
}
.ts-title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1px;
  margin-bottom: 12px;
  color: var(--text-main);
}
.ts-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.ts-card {
  position: relative;
  cursor: pointer;
  border-radius: 12px;
  padding: 8px;
  border: 2px solid transparent;
  transition: all 0.25s ease;
  text-align: center;
}
.ts-card:hover {
  transform: translateY(-3px);
}
.ts-card.active {
  border-color: var(--accent);
  box-shadow: 0 4px 16px var(--accent-soft, rgba(66, 165, 245, 0.2));
}
.ts-preview {
  height: 54px;
  border-radius: 10px;
  margin-bottom: 8px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
}
.ts-name {
  font-size: 12px;
  color: var(--text-sub);
  font-weight: 600;
}
.ts-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}
.ts-tip {
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-sub);
  opacity: 0.85;
}
.pop-enter-active,
.pop-leave-active {
  transition: all 0.25s ease;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.96);
}

@media (max-width: 768px) {
  .theme-switcher {
    right: 14px;
    bottom: calc(86px + env(safe-area-inset-bottom));
  }
  .ts-panel {
    width: 264px;
  }
  .ts-btn {
    width: 44px;
    height: 44px;
  }
}
</style>
