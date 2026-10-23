<template>
  <div class="theme-switcher" :class="{ inline }">
    <template v-if="!inline">
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
    </template>

    <!-- 内联模式（个人中心）：紧凑入口，鼠标悬停自动渐变展开，带主题照片预览 -->
    <div v-else class="ts-inline" @mouseenter="open = true" @mouseleave="open = false">
      <div class="ts-trigger">
        <el-icon :size="15"><Brush /></el-icon>
        <span class="ts-trigger-label">{{ $t('theme.title') }}</span>
        <span class="ts-current">{{ $t(`theme.${themeStore.theme}`) }}</span>
        <el-icon :size="12" class="ts-caret"><ArrowDown /></el-icon>
      </div>
      <transition name="pop">
        <div v-if="open" class="ts-panel-sm">
          <div
            v-for="t in themes"
            :key="t.id"
            class="ts-card-sm"
            :class="{ active: themeStore.theme === t.id }"
            @click="choose(t.id)"
          >
            <div class="ts-photo" :style="{ backgroundImage: `url(${t.photo})` }"></div>
            <div class="ts-name-sm">{{ $t(`theme.${t.id}`) }}</div>
            <div class="ts-dot" v-if="themeStore.theme === t.id"></div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Brush } from '@element-plus/icons-vue'
import { useThemeStore } from '@/stores/theme'

const props = defineProps({
  inline: { type: Boolean, default: false }
})

const themeStore = useThemeStore()
const open = ref(false)

const themes = [
  { id: 'default', preview: 'linear-gradient(135deg,#e3f2fd,#fff3e0 55%,#e8f5e9)', photo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%27120%27%20height%3D%2772%27%3E%3Cdefs%3E%3ClinearGradient%20id%3D%27g%27%20x1%3D%270%27%20y1%3D%270%27%20x2%3D%270%27%20y2%3D%271%27%3E%3Cstop%20offset%3D%270%27%20stop-color%3D%27%238ed6ff%27%2F%3E%3Cstop%20offset%3D%271%27%20stop-color%3D%27%23d8f7e0%27%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20width%3D%27120%27%20height%3D%2772%27%20fill%3D%27url%28%23g%29%27%2F%3E%3Ccircle%20cx%3D%2799%27%20cy%3D%2715%27%20r%3D%279%27%20fill%3D%27%23ffd166%27%2F%3E%3Cpath%20d%3D%27M0%2052%20Q%2030%2038%2060%2050%20T%20120%2046%20V%2072%20H%200%20Z%27%20fill%3D%27%236cc96e%27%20opacity%3D%270.85%27%2F%3E%3Cpath%20d%3D%27M0%2060%20Q%2040%2050%2080%2058%20T%20120%2056%20V%2072%20H%200%20Z%27%20fill%3D%27%234db357%27%20opacity%3D%270.9%27%2F%3E%3Ccircle%20cx%3D%2726%27%20cy%3D%2722%27%20r%3D%277%27%20fill%3D%27%23fff%27%20opacity%3D%270.9%27%2F%3E%3Ccircle%20cx%3D%2734%27%20cy%3D%2722%27%20r%3D%277%27%20fill%3D%27%238ed6ff%27%2F%3E%3C%2Fsvg%3E' },
  { id: 'cute', preview: 'linear-gradient(135deg,#ffe0ef,#e9d5ff 55%,#fff0f6)', photo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%27120%27%20height%3D%2772%27%3E%3Cdefs%3E%3ClinearGradient%20id%3D%27g%27%20x1%3D%270%27%20y1%3D%270%27%20x2%3D%271%27%20y2%3D%271%27%3E%3Cstop%20offset%3D%270%27%20stop-color%3D%27%23ffd6ec%27%2F%3E%3Cstop%20offset%3D%271%27%20stop-color%3D%27%23e4d4ff%27%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20width%3D%27120%27%20height%3D%2772%27%20fill%3D%27url%28%23g%29%27%2F%3E%3Ccircle%20cx%3D%2718%27%20cy%3D%2714%27%20r%3D%272.6%27%20fill%3D%27%23ff8fb8%27%20opacity%3D%270.7%27%2F%3E%3Ccircle%20cx%3D%2760%27%20cy%3D%2710%27%20r%3D%272%27%20fill%3D%27%23c7a8ff%27%20opacity%3D%270.7%27%2F%3E%3Ccircle%20cx%3D%27104%27%20cy%3D%2722%27%20r%3D%272.4%27%20fill%3D%27%23ff8fb8%27%20opacity%3D%270.6%27%2F%3E%3Ccircle%20cx%3D%2744%27%20cy%3D%2760%27%20r%3D%272%27%20fill%3D%27%23c7a8ff%27%20opacity%3D%270.6%27%2F%3E%3Ccircle%20cx%3D%2792%27%20cy%3D%2750%27%20r%3D%272.2%27%20fill%3D%27%23ff8fb8%27%20opacity%3D%270.6%27%2F%3E%3Cpath%20d%3D%27M60%2030%20c-8%20-10%20-22%20-8%20-22%202%20c0%208%2010%2013%2022%2019%20c12%20-6%2022%20-11%2022%20-19%20c0%20-10%20-14%20-12%20-22%20-2%20z%27%20fill%3D%27%23ff6b9d%27%2F%3E%3Ccircle%20cx%3D%2722%27%20cy%3D%2726%27%20r%3D%278%27%20fill%3D%27%23fff%27%20opacity%3D%270.95%27%2F%3E%3Ccircle%20cx%3D%2732%27%20cy%3D%2726%27%20r%3D%278%27%20fill%3D%27%23ffd6ec%27%2F%3E%3Cpath%20d%3D%27M0%2058%20Q%2030%2050%2060%2056%20T%20120%2054%20V%2072%20H%200%20Z%27%20fill%3D%27%23ff9ec6%27%20opacity%3D%270.6%27%2F%3E%3C%2Fsvg%3E' },
  { id: 'tech', preview: 'linear-gradient(135deg,#0b1020,#1b2a5e 55%,#0e7490)', photo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%27120%27%20height%3D%2772%27%3E%3Cdefs%3E%3ClinearGradient%20id%3D%27g%27%20x1%3D%270%27%20y1%3D%270%27%20x2%3D%271%27%20y2%3D%271%27%3E%3Cstop%20offset%3D%270%27%20stop-color%3D%27%230b1020%27%2F%3E%3Cstop%20offset%3D%271%27%20stop-color%3D%27%231b2a5e%27%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20width%3D%27120%27%20height%3D%2772%27%20fill%3D%27url%28%23g%29%27%2F%3E%3Cpath%20d%3D%27M0%200%20H%20120%20M0%2012%20H%20120%20M0%2024%20H%20120%20M0%2036%20H%20120%20M0%2048%20H%20120%20M0%2060%20H%20120%20M0%2072%20H%20120%20M0%200%20V%2072%20M20%200%20V%2072%20M40%200%20V%2072%20M60%200%20V%2072%20M80%200%20V%2072%20M100%200%20V%2072%27%20stroke%3D%27rgba%2834%2C211%2C238%2C0.13%29%27%20stroke-width%3D%271%27%2F%3E%3Ccircle%20cx%3D%2718%27%20cy%3D%2714%27%20r%3D%271.2%27%20fill%3D%27%23fff%27%20opacity%3D%270.9%27%2F%3E%3Ccircle%20cx%3D%27100%27%20cy%3D%2710%27%20r%3D%271%27%20fill%3D%27%23fff%27%20opacity%3D%270.8%27%2F%3E%3Ccircle%20cx%3D%2776%27%20cy%3D%2728%27%20r%3D%271.4%27%20fill%3D%27%23fff%27%20opacity%3D%270.9%27%2F%3E%3Ccircle%20cx%3D%2752%27%20cy%3D%2752%27%20r%3D%271.2%27%20fill%3D%27%23fff%27%20opacity%3D%270.7%27%2F%3E%3Ccircle%20cx%3D%2760%27%20cy%3D%2736%27%20r%3D%2715%27%20fill%3D%27none%27%20stroke%3D%27%2322d3ee%27%20stroke-width%3D%272.2%27%2F%3E%3Ccircle%20cx%3D%2760%27%20cy%3D%2736%27%20r%3D%277%27%20fill%3D%27%2322d3ee%27%20opacity%3D%270.85%27%2F%3E%3Cpath%20d%3D%27M88%2056%20L104%2062%20L92%2066%20Z%27%20fill%3D%27%23a78bfa%27%20opacity%3D%270.9%27%2F%3E%3C%2Fsvg%3E' },
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
/* 内联模式：个人中心紧凑入口 + hover 渐变面板 */
.theme-switcher.inline {
  position: static;
  width: 100%;
  display: block;
}
.ts-inline {
  position: relative;
}
.ts-trigger {
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
.ts-trigger:hover {
  box-shadow: 0 6px 18px var(--accent-soft, rgba(66, 165, 245, 0.18));
  transform: translateY(-1px);
}
.ts-trigger-label { color: var(--text-sub, #78909c); }
.ts-current {
  color: var(--accent);
  font-weight: 700;
  font-size: 12.5px;
}
.ts-caret {
  color: var(--text-sub, #78909c);
  transition: transform 0.25s var(--ease-smooth);
}
.ts-inline:hover .ts-caret {
  transform: rotate(180deg);
}
.ts-panel-sm {
  position: absolute;
  left: 0;
  top: calc(100% + 8px);
  width: 292px;
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
.ts-card-sm {
  position: relative;
  cursor: pointer;
  border-radius: 12px;
  padding: 5px;
  border: 2px solid transparent;
  transition: all 0.22s var(--ease-spring);
  text-align: center;
}
.ts-card-sm:hover {
  transform: translateY(-3px);
}
.ts-card-sm.active {
  border-color: var(--accent);
  box-shadow: 0 6px 18px var(--accent-soft, rgba(66, 165, 245, 0.2));
}
.ts-photo {
  height: 58px;
  border-radius: 9px;
  background-size: cover;
  background-position: center;
  margin-bottom: 6px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
}
.ts-name-sm {
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
