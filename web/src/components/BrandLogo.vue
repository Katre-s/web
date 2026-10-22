<template>
  <span
    class="brand-logo"
    :style="{ width: size + 'px', height: size + 'px' }"
    :class="{ 'with-bg': withBg }"
  >
    <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="徐工院小咸鱼">
      <defs>
        <linearGradient :id="`bg-${uid}`" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0d3b4f" />
          <stop offset="55%" stop-color="#10667a" />
          <stop offset="100%" stop-color="#1a90a0" />
        </linearGradient>
        <linearGradient :id="`body-${uid}`" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stop-color="#ffd9a8" />
          <stop offset="55%" stop-color="#ffb877" />
          <stop offset="100%" stop-color="#ff9a5a" />
        </linearGradient>
        <linearGradient :id="`fin-${uid}`" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ffc48c" />
          <stop offset="100%" stop-color="#ff8f5e" />
        </linearGradient>
        <linearGradient :id="`belly-${uid}`" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fff6e6" stop-opacity="0.95" />
          <stop offset="100%" stop-color="#ffe2bd" stop-opacity="0.6" />
        </linearGradient>
      </defs>

      <!-- 圆角底 -->
      <rect v-if="withBg" x="4" y="4" width="112" height="112" rx="28" :fill="`url(#bg-${uid})`" />
      <g v-if="withBg" fill="#ffffff" opacity="0.18">
        <circle cx="98" cy="26" r="4.5" />
        <circle cx="106" cy="40" r="2.4" />
        <circle cx="20" cy="96" r="3" />
      </g>

      <!-- 气泡 -->
      <g fill="#ffffff" :opacity="withBg ? 0.55 : 0.45">
        <circle cx="99" cy="36" r="4.2" />
        <circle cx="108" cy="47" r="2.3" />
        <circle cx="91" cy="25" r="2.1" />
      </g>

      <!-- 尾巴 -->
      <path
        d="M44 70c-9-2-17-9-22-19 0 9-1 17 1 25-2 8-1 16 1 23 6-10 13-17 21-20z"
        :fill="`url(#fin-${uid})`"
      />

      <!-- 背鳍 -->
      <path d="M62 50c3-9 12-14 21-13-6 4-9 9-10 15z" :fill="`url(#fin-${uid})`" />

      <!-- 身体 -->
      <path
        d="M46 72c0-15 14-27 32-27s32 12 32 27-14 27-32 27-32-12-32-27z"
        :fill="`url(#body-${uid})`"
      />
      <!-- 肚皮 -->
      <path
        d="M58 82c7 7 17 10 27 8 7-2 13-6 17-12-3 10-12 17-24 18-9 1-16-3-20-14z"
        :fill="`url(#belly-${uid})`"
      />
      <!-- 鳃线 -->
      <path d="M78 57c-5 3-7 9-6 15" stroke="#ff9a5a" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.45" />

      <!-- 眼睛 -->
      <circle cx="94" cy="65" r="7.4" fill="#ffffff" />
      <circle cx="95.6" cy="65.4" r="3.6" fill="#12303c" />
      <circle cx="96.8" cy="63.8" r="1.2" fill="#ffffff" />
      <!-- 腮红 -->
      <circle cx="82" cy="78" r="4.6" fill="#ff7a59" opacity="0.32" />
      <!-- 嘴 -->
      <path d="M95 76c3.6 2.8 7.8 2.8 11.4 0" stroke="#c4622f" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.75" />
    </svg>
  </span>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  size: { type: Number, default: 40 },
  withBg: { type: Boolean, default: false }
})

// 同页面可能出现多个 logo，渐变 id 需唯一，否则会被首个实例覆盖
const uid = ref('l' + Math.random().toString(36).slice(2, 7))
</script>

<style scoped>
.brand-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 0;
}
.brand-logo svg {
  width: 100%;
  height: 100%;
  display: block;
}
.brand-logo.with-bg {
  border-radius: 28%;
  box-shadow: 0 8px 22px rgba(13, 59, 79, 0.22);
}
</style>
