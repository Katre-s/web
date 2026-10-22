<template>
  <div class="home">
    <!-- ===== Hero ===== -->
    <section class="hero">
      <div class="hero-deco" aria-hidden="true">
        <span class="deco-bubble b1"></span>
        <span class="deco-bubble b2"></span>
        <span class="deco-bubble b3"></span>
        <span class="deco-bubble b4"></span>
        <div class="deco-wave"></div>
        <div class="deco-fish"><BrandLogo :size="280" /></div>
      </div>

      <div class="hero-main">
        <p class="hero-tag">
          <span class="dot"></span>
          {{ $t('home.tagline') }}
        </p>
        <h1 class="hero-title">
          {{ greeting }}，{{ userStore.userInfo?.nickname || t('home.student') }}
        </h1>
        <p class="hero-sub">{{ greetingSub }}<span class="sep">·</span>{{ $t('home.heroSub') }}</p>

        <div class="hero-actions">
          <button class="btn primary" @click="goTrade()">
            {{ $t('home.goTrade') }}<span class="arrow">→</span>
          </button>
          <button class="btn ghost" @click="goPublish">{{ $t('home.publishIdle') }}</button>
        </div>

        <div class="hero-stats">
          <div class="hs">
            <b>{{ stats ? stats.todayBooks : '—' }}</b>
            <span>{{ $t('home.todayNew') }}</span>
          </div>
          <i></i>
          <div class="hs">
            <b>{{ hotBoards.length }}</b>
            <span>{{ $t('home.hotItems') }}</span>
          </div>
          <i></i>
          <div class="hs">
            <b>{{ categories.length }}</b>
            <span>{{ $t('home.catCount') }}</span>
          </div>
        </div>
      </div>

      <aside class="hero-side">
        <div class="mascot">
          <BrandLogo :size="132" />
        </div>

        <div class="weather-card" v-if="weather" :title="weatherSource">
          <div class="wc-top">
            <span class="wc-icon">{{ weatherIcon }}</span>
            <div class="wc-temp">
              <b>{{ Math.round(weather.temperature) }}°</b>
              <span>{{ t(`home.weatherScene.${weather.scene}`) }}</span>
            </div>
            <span class="wc-city">{{ weather.city }}</span>
          </div>
          <div class="wc-sun" v-if="weather.sunrise">
            <span>🌅 {{ t('home.sunrise') }} {{ timeOfDay(weather.sunrise) }}</span>
            <span>🌇 {{ t('home.sunset') }} {{ timeOfDay(weather.sunset) }}</span>
          </div>
        </div>
        <div class="weather-card skeleton" v-else>
          <div class="wc-top">
            <span class="wc-icon">🌤️</span>
            <div class="wc-temp"><b>--°</b><span>{{ $t('common.loading') }}</span></div>
          </div>
        </div>
      </aside>
    </section>

    <!-- ===== 类目入口 ===== -->
    <section class="block">
      <div class="block-head">
        <div>
          <h2>{{ $t('home.exploreCats') }}</h2>
          <p>{{ $t('home.exploreCatsSub') }}</p>
        </div>
        <button class="head-link" @click="goTrade()">{{ $t('home.viewAll') }}<span>→</span></button>
      </div>
      <div class="cat-grid">
        <button
          v-for="c in categories"
          :key="c.value"
          class="cat-card"
          @click="goTrade(c.value)"
        >
          <span class="cat-emoji">{{ c.icon }}</span>
          <span class="cat-name">{{ $t('tradeCat.' + c.key) }}</span>
          <span class="cat-desc">{{ $t('tradeCatHint.' + c.key) }}</span>
        </button>
      </div>
    </section>

    <!-- ===== 今日热销 ===== -->
    <section class="block" v-if="hotBoards.length">
      <div class="block-head">
        <div>
          <h2>{{ $t('home.hotToday') }}</h2>
          <p>{{ $t('home.hotTodaySub') }}</p>
        </div>
        <button class="head-link" @click="goTrade()">{{ $t('home.viewAll') }}<span>→</span></button>
      </div>

      <div class="hot-grid">
        <article
          v-for="b in hotBoards"
          :key="b.id"
          class="hot-card"
          @click="goDetail(b)"
        >
          <div class="hot-cover" :style="coverStyle(b.bookCover)">
            <span class="hot-rank" v-if="b.sellerCount > 0">{{ b.sellerCount }} 人在卖</span>
          </div>
          <div class="hot-info">
            <h3>{{ b.bookTitle }}</h3>
            <p class="hot-author" v-if="b.bookAuthor">{{ b.bookAuthor }}</p>
            <div class="hot-meta">
              <span class="hot-price" v-if="b.minPrice">¥{{ b.minPrice }}<em>起</em></span>
              <span class="hot-price empty" v-else>{{ $t('home.noSeller') }}</span>
              <span class="hot-views">👁 {{ b.viewCount }}</span>
            </div>
          </div>
        </article>
      </div>
    </section>

    <!-- ===== 发布 CTA ===== -->
    <section class="cta">
      <div class="cta-fish"><BrandLogo :size="96" /></div>
      <div class="cta-text">
        <h3>{{ $t('home.ctaTitle') }}</h3>
        <p>{{ $t('home.ctaDesc') }}</p>
      </div>
      <button class="btn light" @click="goPublish">
        {{ $t('home.publishIdle') }}<span class="arrow">→</span>
      </button>
    </section>
  </div>
</template>

<script setup>import { useI18n } from 'vue-i18n'
const { t } = useI18n()

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { booksApi, weatherApi } from '@/api'
import { resolveImg } from '@/utils/image'
import BrandLogo from '@/components/BrandLogo.vue'
import { TRADE_CATEGORIES } from '@/constants/categories'

const userStore = useUserStore()
const router = useRouter()
const categories = TRADE_CATEGORIES

/* ------------------------------ 实时天气 ------------------------------ */
const weather = ref(null)
let weatherTimer = null

// 时间段优先按天气接口给的真实日出日落算，拿不到再退回固定时段
const period = computed(() => {
  const now = new Date()
  const h = now.getHours()
  const fallback = h >= 5 && h < 9 ? 'morning' : h >= 9 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'evening' : 'night'

  const w = weather.value
  if (!w || typeof w.isDay !== 'boolean') return fallback
  if (!w.isDay) return 'night'

  const rise = Date.parse(w.sunrise)
  const set = Date.parse(w.sunset)
  if (Number.isNaN(rise) || Number.isNaN(set)) return fallback

  const ts = now.getTime()
  if (ts < rise + 90 * 60 * 1000) return 'morning'   // 日出后一个半小时内算清晨
  if (ts > set - 120 * 60 * 1000) return 'evening'  // 日落前两小时算黄昏
  return 'day'
})

const greeting = computed(() => {
  const h = new Date().getHours()
  if (period.value === 'night') return h >= 22 || h < 5 ? t('home.greetingNight') : t('home.greetingEvening')
  if (period.value === 'morning') return t('home.greetingMorning')
  if (period.value === 'evening') return t('home.greetingEvening')
  if (h < 12) return t('home.greetingLateMorning')
  if (h < 14) return t('home.greetingNoon')
  return t('home.greetingAfternoon')
})

const greetingSub = computed(() => {
  const subs = {
    morning: t('home.mottoMorning'),
    day: t('home.mottoDay'),
    evening: t('home.mottoEvening'),
    night: t('home.mottoNight')
  }
  return subs[period.value]
})

const WEATHER_ICONS = {
  clear: '☀️',
  partly: '⛅',
  cloudy: '☁️',
  fog: '🌫️',
  drizzle: '🌦️',
  rain: '🌧️',
  snow: '❄️',
  thunder: '⛈️'
}

const weatherIcon = computed(() => {
  const w = weather.value
  if (!w) return ''
  if (w.scene === 'clear' && w.isDay === false) return '🌙'
  return WEATHER_ICONS[w.scene] || '🌤️'
})

const weatherSource = computed(() => {
  if (!weather.value) return ''
  const d = new Date(weather.value.updatedAt || Date.now())
  const pad = (n) => String(n).padStart(2, '0')
  return `实时天气 · Open-Meteo · 更新于 ${pad(d.getHours())}:${pad(d.getMinutes())}`
})

function timeOfDay(iso) {
  if (!iso) return '--:--'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--:--'
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 固定默认城市（徐州云龙区），不申请定位权限；城市在服务端 .env 里改
async function loadWeather() {
  try {
    const res = await weatherApi.current()
    const data = res?.data || res
    if (data && data.scene) weather.value = data
  } catch {
    // 天气失败不影响首页
  }
}

/* ------------------------------ 热销数据 ------------------------------ */
const stats = ref(null)
const hotBoards = computed(() => (stats.value?.hotBoards || []).slice(0, 8))

async function loadStats() {
  try {
    const res = await booksApi.homeStats()
    stats.value = res.data
  } catch {}
}

function coverStyle(cover) {
  const url = resolveImg(cover)
  if (!url) return {}
  return { backgroundImage: `url("${url}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
}

function goDetail(b) {
  const key = b.isbn || b.bookTitle
  router.push(`/book/${encodeURIComponent(key)}`)
}

function goTrade(category) {
  router.push(category ? { path: '/trade', query: { category } } : '/trade')
}

function goPublish() {
  router.push('/publish')
}

onMounted(() => {
  loadStats()
  loadWeather()
  // 每 30 分钟刷新一次，长时间挂着页面也能跟上天气变化
  weatherTimer = setInterval(loadWeather, 30 * 60 * 1000)
})

onUnmounted(() => {
  if (weatherTimer) clearInterval(weatherTimer)
})
</script>

<style scoped>
.home {
  padding-bottom: 36px;
  --ink: #0b2f3f;
  --ink-soft: #5d7b87;
  --pond: #1a90a0;
  --pond-deep: #10667a;
  --coral: #ff9a5a;
}

/* ================= Hero ================= */
.hero {
  position: relative;
  overflow: hidden;
  display: flex;
  gap: 28px;
  padding: 42px 44px;
  margin-bottom: 30px;
  border-radius: 28px;
  border: 1px solid rgba(26, 144, 160, 0.12);
  background:
    radial-gradient(60% 90% at 92% 6%, rgba(255, 154, 90, 0.3), transparent 62%),
    radial-gradient(55% 80% at 4% 96%, rgba(122, 217, 196, 0.42), transparent 62%),
    linear-gradient(125deg, #effbf8 0%, #e3f4f4 48%, #eef8fc 100%);
  box-shadow: 0 24px 60px -40px rgba(11, 47, 63, 0.5);
  animation: rise 0.55s var(--ease-smooth) backwards;
}
/* 科技感光带：每隔几秒有一束柔光掠过 hero */
.hero::after {
  content: '';
  position: absolute;
  top: -20%;
  bottom: -20%;
  left: -45%;
  width: 38%;
  background: linear-gradient(105deg, transparent, rgba(255, 255, 255, 0.38), transparent);
  transform: skewX(-14deg);
  pointer-events: none;
  animation: hero-sweep 7.5s var(--ease-smooth) infinite;
  will-change: transform;
}
@keyframes hero-sweep {
  0%, 58% { transform: skewX(-14deg) translateX(0); }
  100% { transform: skewX(-14deg) translateX(460%); }
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.hero-deco {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.deco-bubble {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.15) 68%);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.5);
  animation: bob 8s ease-in-out infinite;
}
.b1 { width: 54px; height: 54px; right: 34%; top: 14%; animation-delay: 0.4s; }
.b2 { width: 22px; height: 22px; right: 28%; top: 30%; animation-delay: 1.6s; }
.b3 { width: 14px; height: 14px; left: 42%; bottom: 20%; animation-delay: 2.4s; }
.b4 { width: 34px; height: 34px; left: 8%; top: 16%; animation-delay: 3.2s; opacity: 0.7; }
@keyframes bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-14px); }
}
.deco-wave {
  position: absolute;
  left: -10%;
  right: -10%;
  bottom: -92px;
  height: 180px;
  border-radius: 48% 52% 0 0 / 70% 70% 0 0;
  background: rgba(26, 144, 160, 0.07);
}
.deco-fish {
  position: absolute;
  right: -70px;
  bottom: -60px;
  opacity: 0.09;
  transform: rotate(-8deg);
}

.hero-main {
  position: relative;
  z-index: 2;
  flex: 1;
  min-width: 0;
}
/* hero 文案错落入场：问候语→标题→副语→按钮→统计逐个浮出 */
.hero-main > * {
  animation: rise 0.5s var(--ease-spring) backwards;
}
.hero-main > *:nth-child(1) { animation-delay: 0.08s; }
.hero-main > *:nth-child(2) { animation-delay: 0.16s; }
.hero-main > *:nth-child(3) { animation-delay: 0.24s; }
.hero-main > *:nth-child(4) { animation-delay: 0.32s; }
.hero-main > *:nth-child(5) { animation-delay: 0.4s; }
.hero-tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px 6px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(26, 144, 160, 0.16);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
  color: var(--pond-deep);
  backdrop-filter: blur(6px);
}
.hero-tag .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--coral);
  box-shadow: 0 0 0 4px rgba(255, 154, 90, 0.18);
}
.hero-title {
  margin: 16px 0 8px;
  font-size: 36px;
  line-height: 1.25;
  font-weight: 800;
  letter-spacing: 1px;
  color: var(--ink);
}
.hero-sub {
  font-size: 14px;
  color: var(--ink-soft);
  letter-spacing: 0.5px;
}
.hero-sub .sep {
  margin: 0 8px;
  color: rgba(26, 144, 160, 0.5);
}

.hero-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
  flex-wrap: wrap;
}
.btn {
  height: 46px;
  padding: 0 24px;
  border-radius: 14px;
  font-size: 14.5px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.25s ease;
}
.btn.primary {
  position: relative;
  overflow: hidden;
  color: #fff;
  background: linear-gradient(135deg, #0e5568, #1a90a0 70%, #23a7a5);
  box-shadow: 0 14px 26px -12px rgba(16, 102, 122, 0.8);
}
/* 悬停时一道高光扫过按钮 */
.btn.primary::after {
  content: '';
  position: absolute;
  top: -20%;
  bottom: -20%;
  left: -70%;
  width: 45%;
  background: linear-gradient(105deg, transparent, rgba(255, 255, 255, 0.35), transparent);
  transform: skewX(-16deg);
  transition: left 0.55s var(--ease-smooth);
  pointer-events: none;
}
.btn.primary:hover::after {
  left: 135%;
}
.btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 32px -12px rgba(16, 102, 122, 0.9);
}
.btn.ghost {
  color: var(--pond-deep);
  background: rgba(255, 255, 255, 0.8);
  border-color: rgba(26, 144, 160, 0.24);
}
.btn.ghost:hover {
  background: #fff;
  border-color: var(--pond);
  transform: translateY(-2px);
}
.btn .arrow {
  transition: transform 0.25s;
}
.btn:hover .arrow {
  transform: translateX(4px);
}

.hero-stats {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 28px;
}
.hero-stats .hs {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.hero-stats b {
  font-size: 24px;
  font-weight: 800;
  color: var(--ink);
  line-height: 1.1;
}
.hero-stats span {
  font-size: 11.5px;
  color: var(--ink-soft);
  letter-spacing: 0.5px;
}
.hero-stats i {
  width: 1px;
  height: 26px;
  background: rgba(11, 47, 63, 0.1);
}

/* 右侧：吉祥物 + 天气 */
.hero-side {
  position: relative;
  z-index: 2;
  width: 250px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  animation: rise 0.55s var(--ease-spring) 0.35s backwards;
}
.mascot {
  margin-right: 6px;
  animation: mascot-float 6s ease-in-out infinite;
  filter: drop-shadow(0 18px 26px rgba(11, 47, 63, 0.18));
}
@keyframes mascot-float {
  0%, 100% { transform: translateY(0) rotate(-4deg); }
  50% { transform: translateY(-10px) rotate(4deg); }
}
.weather-card {
  width: 100%;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 14px 30px -18px rgba(11, 47, 63, 0.45);
  backdrop-filter: blur(10px);
}
.wc-top {
  display: flex;
  align-items: center;
  gap: 10px;
}
.wc-icon {
  font-size: 26px;
  line-height: 1;
}
.wc-temp {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}
.wc-temp b {
  font-size: 22px;
  color: var(--ink);
}
.wc-temp span {
  font-size: 11px;
  color: var(--ink-soft);
}
.wc-city {
  margin-left: auto;
  font-size: 11px;
  color: var(--pond-deep);
  background: rgba(26, 144, 160, 0.1);
  padding: 3px 9px;
  border-radius: 999px;
  white-space: nowrap;
}
.wc-sun {
  display: flex;
  gap: 12px;
  margin-top: 10px;
  padding-top: 9px;
  border-top: 1px dashed rgba(11, 47, 63, 0.1);
  font-size: 10.5px;
  color: var(--ink-soft);
  white-space: nowrap;
}
.weather-card.skeleton .wc-temp b {
  color: #b9ccd2;
}

/* ================= 通用区块 ================= */
.block {
  margin-bottom: 30px;
}
.block-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.block-head h2 {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-main);
  letter-spacing: 1px;
}
.block-head p {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-sub);
}
.head-link {
  border: 0;
  background: transparent;
  font-family: inherit;
  font-size: 12.5px;
  color: var(--pond-deep);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 0;
}
.head-link span {
  transition: transform 0.22s;
}
.head-link:hover span {
  transform: translateX(3px);
}

/* 类目 */
.cat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: 12px;
}
.cat-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 14px 16px;
  border-radius: 18px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: transform 0.28s var(--ease-spring), border-color 0.24s, box-shadow 0.28s;
  animation: rise 0.5s var(--ease-spring) backwards;
}
.cat-card:nth-child(1) { animation-delay: 0.05s; }
.cat-card:nth-child(2) { animation-delay: 0.09s; }
.cat-card:nth-child(3) { animation-delay: 0.13s; }
.cat-card:nth-child(4) { animation-delay: 0.17s; }
.cat-card:nth-child(5) { animation-delay: 0.21s; }
.cat-card:nth-child(6) { animation-delay: 0.25s; }
.cat-card:nth-child(n + 7) { animation-delay: 0.29s; }
.cat-card:hover {
  transform: translateY(-5px) scale(1.02);
  border-color: rgba(26, 144, 160, 0.35);
  box-shadow: 0 16px 30px -18px rgba(16, 102, 122, 0.5);
}
.cat-emoji {
  font-size: 24px;
  line-height: 1.3;
  transition: transform 0.3s var(--ease-spring);
}
.cat-card:hover .cat-emoji {
  transform: scale(1.2) rotate(-6deg);
}
.cat-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
}
.cat-desc {
  font-size: 10.5px;
  color: var(--text-sub);
  opacity: 0.8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* 热销 */
.hot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
.hot-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 18px;
  overflow: hidden;
  cursor: pointer;
  box-shadow: var(--card-shadow);
  transition: transform 0.3s var(--ease-spring), box-shadow 0.3s;
  animation: rise 0.5s var(--ease-spring) backwards;
}
.hot-card:nth-child(1) { animation-delay: 0.06s; }
.hot-card:nth-child(2) { animation-delay: 0.11s; }
.hot-card:nth-child(3) { animation-delay: 0.16s; }
.hot-card:nth-child(4) { animation-delay: 0.21s; }
.hot-card:nth-child(n + 5) { animation-delay: 0.26s; }
.hot-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 18px 34px -20px rgba(16, 102, 122, 0.55);
}
.hot-cover {
  position: relative;
  aspect-ratio: 4 / 3;
  background: linear-gradient(135deg, #e6f4f2, #d9edf3);
  background-size: cover;
  background-position: center;
  transition: transform 0.45s var(--ease-smooth);
}
.hot-card:hover .hot-cover {
  transform: scale(1.06);
}
.hot-rank {
  position: absolute;
  left: 10px;
  top: 10px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 10.5px;
  color: #fff;
  background: rgba(11, 47, 63, 0.55);
  backdrop-filter: blur(4px);
}
.hot-info {
  padding: 12px 14px 14px;
}
.hot-info h3 {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--text-main);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 40px;
}
.hot-author {
  margin-top: 4px;
  font-size: 11.5px;
  color: var(--text-sub);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hot-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}
.hot-price {
  font-size: 17px;
  font-weight: 800;
  color: #e5484d;
}
.hot-price em {
  font-style: normal;
  font-size: 10.5px;
  font-weight: 500;
  color: #9db2ba;
  margin-left: 2px;
}
.hot-price.empty {
  font-size: 11.5px;
  font-weight: 500;
  color: #9db2ba;
}
.hot-views {
  font-size: 11px;
  color: #9db2ba;
}

/* CTA */
.cta {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 26px 32px;
  border-radius: 24px;
  color: #f4fbfa;
  background:
    radial-gradient(70% 120% at 100% 0%, rgba(255, 154, 90, 0.35), transparent 60%),
    linear-gradient(120deg, #0b2f3f 0%, #0e4f61 60%, #126f7e 100%);
  box-shadow: 0 22px 44px -30px rgba(11, 47, 63, 0.9);
  animation: rise 0.5s var(--ease-smooth) 0.35s backwards;
}
.cta-fish {
  flex-shrink: 0;
  opacity: 0.95;
  animation: mascot-float 7s ease-in-out infinite;
}
.cta-text {
  flex: 1;
  min-width: 0;
}
.cta-text h3 {
  font-size: 19px;
  font-weight: 800;
  letter-spacing: 1px;
}
.cta-text p {
  margin-top: 5px;
  font-size: 12.5px;
  color: rgba(244, 251, 250, 0.62);
}
.btn.light {
  flex-shrink: 0;
  color: #0b2f3f;
  background: #fff;
  box-shadow: 0 10px 24px -12px rgba(0, 0, 0, 0.5);
}
.btn.light:hover {
  transform: translateY(-2px);
  background: #fff7ee;
}

/* ================= 响应式 ================= */
@media (max-width: 1024px) {
  .hero {
    padding: 32px;
  }
  .hero-side {
    width: 210px;
  }
  .hero-title {
    font-size: 30px;
  }
}

@media (max-width: 768px) {
  .hero {
    flex-direction: column;
    padding: 24px 20px;
    border-radius: 22px;
    margin-bottom: 22px;
    gap: 18px;
  }
  .hero-deco .deco-fish {
    display: none;
  }
  .hero-tag {
    font-size: 11px;
  }
  .hero-title {
    font-size: 23px;
    margin: 12px 0 6px;
  }
  .hero-sub {
    font-size: 12.5px;
    line-height: 1.7;
  }
  .hero-actions {
    margin-top: 18px;
    gap: 10px;
  }
  .btn {
    height: 42px;
    padding: 0 18px;
    font-size: 13.5px;
    flex: 1;
    justify-content: center;
  }
  .hero-stats {
    margin-top: 20px;
    gap: 16px;
  }
  .hero-stats b {
    font-size: 20px;
  }
  .hero-side {
    width: 100%;
    flex-direction: row-reverse;
    align-items: center;
    gap: 12px;
  }
  .mascot {
    width: 86px;
    height: 86px;
    margin: 0;
    flex-shrink: 0;
  }
  .mascot :deep(svg) {
    width: 86px !important;
    height: 86px !important;
  }
  .weather-card {
    flex: 1;
  }
  .block {
    margin-bottom: 22px;
  }
  .block-head {
    margin-bottom: 12px;
  }
  .block-head h2 {
    font-size: 17px;
  }
  .cat-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .cat-card {
    padding: 10px 10px 11px;
    border-radius: 14px;
    gap: 2px;
  }
  .cat-emoji {
    font-size: 20px;
  }
  .cat-name {
    font-size: 12.5px;
  }
  .cat-desc {
    display: none;
  }
  .hot-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  .hot-info {
    padding: 10px 12px 12px;
  }
  .hot-info h3 {
    font-size: 13px;
    min-height: 36px;
  }
  .hot-price {
    font-size: 15px;
  }
  .cta {
    flex-direction: column;
    align-items: flex-start;
    padding: 22px;
    gap: 12px;
    border-radius: 20px;
  }
  .cta-fish {
    order: 2;
    align-self: flex-end;
    margin-top: -34px;
    opacity: 0.9;
  }
  .btn.light {
    width: 100%;
    justify-content: center;
  }
}
</style>
