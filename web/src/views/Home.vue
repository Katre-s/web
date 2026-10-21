<template>
  <div class="home-page">
    <div class="hero-banner" :class="[period, weatherClass]">
      <div class="sky-effects" :class="weatherClass">
        <div class="clouds"><i></i><i></i><i></i></div>
        <div class="rain-layer"></div>
        <div class="snow-layer"></div>
        <div class="fog-layer"></div>
        <div class="flash-layer"></div>
      </div>
      <div class="sun-moon" :class="period"></div>
      <div class="hero-overlay">
        <div class="greeting">
          <h1 class="greeting-text">{{ greeting }}，{{ userStore.userInfo?.nickname || t('home.student') }}</h1>
          <p class="greeting-sub">{{ greetingSub }}</p>
          <p class="sun-times" v-if="weather && weather.sunrise">
            <span>🌅 {{ t('home.sunrise') }} {{ timeOfDay(weather.sunrise) }}</span>
            <span>🌇 {{ t('home.sunset') }} {{ timeOfDay(weather.sunset) }}</span>
          </p>
        </div>
      </div>
      <div class="weather-chip" v-if="weather" :title="weatherSource">
        <span class="wc-icon">{{ weatherIcon }}</span>
        <span class="wc-temp">{{ Math.round(weather.temperature) }}°</span>
        <span class="wc-text">{{ t(`home.weatherScene.${weather.scene}`) }}</span>
        <span class="wc-city" v-if="weather.city">{{ weather.city }}</span>
      </div>
      <div class="hero-bottom-gradient"></div>
    </div>

    <div class="content-section">
      <div class="section-header">
        <h2 class="section-title">{{ $t('home.hotspots') }}</h2>
        <el-button type="primary" round size="small" @click="showPostDialog = true">{{ $t('home.submit') }}</el-button>
      </div>
      <div class="hotspot-list">
        <div v-for="item in hotspots" :key="item.id" class="hotspot-card">
          <div class="hotspot-tag">{{ item.tag }}</div>
          <h3 class="hotspot-title">{{ item.title }}</h3>
          <p class="hotspot-desc">{{ item.description }}</p>
          <div class="hotspot-meta">
            <span>{{ item.author }}</span>
            <span>{{ formatTime(item.time) }}</span>
          </div>
        </div>
        <el-empty v-if="!hotspots.length" :description="$t('home.noHotspots')" />
      </div>
    </div>

    <div class="content-section" v-if="stats">
      <h2 class="section-title">{{ $t('home.latest') }}</h2>
      <div class="today-stats">
        <div class="stat-card stat-boards">
          <div class="stat-icon">📚</div>
          <div class="stat-info">
            <div class="stat-num">{{ stats.todayBoards }}</div>
            <div class="stat-label">{{ $t('home.newBoards') }}</div>
          </div>
        </div>
        <div class="stat-card stat-books">
          <div class="stat-icon">📖</div>
          <div class="stat-info">
            <div class="stat-num">{{ stats.todayBooks }}</div>
            <div class="stat-label">{{ $t('home.newBooks') }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="content-section" v-if="stats && stats.chartData && stats.chartData.length">
      <h2 class="section-title">{{ $t('home.trend7d') }}</h2>
      <div class="chart-container">
        <div class="bar-chart">
          <div v-for="d in stats.chartData" :key="d.date" class="bar-item">
            <div class="bar-wrapper">
              <div class="bar-fill" :style="{ height: barHeight(d.count) + '%' }">
                <span class="bar-count" v-if="d.count > 0">{{ d.count }}</span>
              </div>
            </div>
            <span class="bar-label">{{ d.date }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="content-section" v-if="stats && stats.hotBoards && stats.hotBoards.length">
      <h2 class="section-title">{{ $t('home.hotToday') }}</h2>
      <div class="hot-board-grid">
        <div
          v-for="b in stats.hotBoards.slice(0, 10)"
          :key="b.id"
          class="hot-board-card"
          @click="goDetail(b)"
        >
          <div class="hb-cover" :style="coverStyle(b.bookCover)"></div>
          <div class="hb-info">
            <h3 class="hb-title">{{ b.bookTitle }}</h3>
            <p class="hb-author" v-if="b.bookAuthor">{{ b.bookAuthor }}</p>
            <div class="hb-meta">
              <span class="hb-sellers">🧑 {{ b.sellerCount }}{{ $t('common.seller') }}</span>
              <span class="hb-views">👁 {{ b.viewCount }}{{ $t('home.views') }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="showPostDialog" :title="$t('home.postTitle')" width="500px">
      <el-form label-position="top">
        <el-form-item :label="$t('home.title')">
          <el-input v-model="postForm.title" :placeholder="$t('home.placeholderTitle')" />
        </el-form-item>
        <el-form-item :label="$t('home.category')">
          <el-select v-model="postForm.tag" :placeholder="$t('home.selectCategory')" style="width: 100%">
            <el-option :label="$t('home.catActivity')" value="活动" />
            <el-option :label="$t('home.catNotice')" value="通知" />
            <el-option :label="$t('home.catDiscuss')" value="讨论" />
            <el-option :label="$t('home.catShare')" value="分享" />
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('home.content')">
          <el-input v-model="postForm.description" type="textarea" :rows="4" :placeholder="$t('home.placeholderContent')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPostDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="submitPost">{{ $t('home.publish') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>import { useI18n } from 'vue-i18n'
const { t } = useI18n()

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus/es/components/message/index'
import { useUserStore } from '@/stores/user'
import { hotspotApi, booksApi, weatherApi } from '@/api'
import { resolveImg } from '@/utils/image'

const userStore = useUserStore()
const router = useRouter()

/* ------------------------------ 实时天气 ------------------------------ */
const weather = ref(null)
const weatherClass = computed(() => (weather.value ? `w-${weather.value.scene}` : ''))
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
    // 天气失败不影响首页，保持原有时间背景
  }
}

const hotspots = ref([])
const stats = ref(null)

const showPostDialog = ref(false)
const postForm = ref({ title: '', tag: '', description: '' })

async function loadHotspots() {
  try {
    const res = await hotspotApi.list()
    hotspots.value = res.data || []
  } catch {}
}

async function loadStats() {
  try {
    const res = await booksApi.homeStats()
    stats.value = res.data
  } catch {}
}

function formatTime(time) {
  if (!time) return ''
  const d = new Date(time)
  const now = Date.now()
  const diff = Math.floor((now - d.getTime()) / 1000)
  if (diff < 60) return t('common.justNow')
  if (diff < 3600) return `${Math.floor(diff / 60)}${t('common.minutesAgo')}`
  if (diff < 86400) return `${Math.floor(diff / 3600)}${t('common.hoursAgo')}`
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function barHeight(count) {
  if (!stats.value || !stats.value.chartData) return 0
  const max = Math.max(...stats.value.chartData.map(d => d.count), 1)
  return Math.max((count / max) * 100, 4)
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

async function submitPost() {
  if (!postForm.value.title || !postForm.value.tag || !postForm.value.description) {
    ElMessage.warning(t('home.fillAll'))
    return
  }
  try {
    await hotspotApi.create(postForm.value)
    ElMessage.success(t('home.postSuccess'))
    postForm.value = { title: '', tag: '', description: '' }
    showPostDialog.value = false
    loadHotspots()
  } catch {}
}

onMounted(() => {
  loadHotspots()
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
.home-page {
  padding-bottom: 40px;
}

.hero-banner {
  position: relative;
  height: 320px;
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 32px;
  transition: background 1s ease;
}
.hero-banner.morning {
  background: linear-gradient(180deg, #ff8a65 0%, #ffb74d 30%, #fff3e0 60%, #e3f2fd 100%);
}
.hero-banner.day {
  background: linear-gradient(180deg, #64b5f6 0%, #90caf9 40%, #e3f2fd 70%, #f5f9ff 100%);
}
.hero-banner.evening {
  background: linear-gradient(180deg, #5c6bc0 0%, #7e57c2 25%, #ff8a65 55%, #ffb74d 80%, #fff8e1 100%);
}
.hero-banner.night {
  background: linear-gradient(180deg, #0a1929 0%, #102a43 40%, #1a3a5c 70%, #283593 100%);
}

/* ---------------- 实时天气视觉层 ---------------- */
.sky-effects {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}
/* 天气色调：叠在原有时间段渐变之上，只改"阴晴"，不破坏早晚配色 */
.sky-effects::before {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.9s ease;
}
.sky-effects.w-partly::before {
  background: linear-gradient(180deg, #7d93a8, #c9d6e2);
  opacity: 0.32;
}
.sky-effects.w-cloudy::before {
  background: linear-gradient(180deg, #5b6b7c, #8fa0b0);
  opacity: 0.52;
}
.sky-effects.w-fog::before {
  background: linear-gradient(180deg, #7c8a96, #cfd8e0);
  opacity: 0.5;
}
.sky-effects.w-drizzle::before {
  background: linear-gradient(180deg, #4a5a6b, #7a8a9a);
  opacity: 0.46;
}
.sky-effects.w-rain::before {
  background: linear-gradient(180deg, #3f4f60, #6a7a8a);
  opacity: 0.56;
}
.sky-effects.w-snow::before {
  background: linear-gradient(180deg, #9fb3c4, #e6eef5);
  opacity: 0.45;
}
.sky-effects.w-thunder::before {
  background: linear-gradient(180deg, #2b3644, #4a5768);
  opacity: 0.66;
}

/* 云 */
.clouds {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.9s ease;
}
.w-partly .clouds,
.w-cloudy .clouds,
.w-drizzle .clouds,
.w-rain .clouds,
.w-snow .clouds,
.w-thunder .clouds {
  opacity: 1;
}
.clouds i {
  position: absolute;
  display: block;
  background: rgba(255, 255, 255, 0.72);
  border-radius: 50%;
  filter: blur(16px);
}
.clouds i:nth-child(1) {
  width: 260px;
  height: 78px;
  top: 12%;
  left: -18%;
  animation: cloud-drift 44s linear infinite;
}
.clouds i:nth-child(2) {
  width: 190px;
  height: 58px;
  top: 34%;
  left: -30%;
  opacity: 0.8;
  animation: cloud-drift 58s linear infinite 8s;
}
.clouds i:nth-child(3) {
  width: 320px;
  height: 88px;
  top: 2%;
  left: -40%;
  opacity: 0.6;
  animation: cloud-drift 72s linear infinite 20s;
}
@keyframes cloud-drift {
  from { transform: translateX(0); }
  to { transform: translateX(180vw); }
}

/* 雨 */
.rain-layer {
  position: absolute;
  inset: -20% 0;
  opacity: 0;
  background-image: repeating-linear-gradient(100deg, rgba(255, 255, 255, 0.55) 0 1px, transparent 1px 9px);
  background-size: 100% 160px;
  animation: rain-fall 0.6s linear infinite;
  transition: opacity 0.6s ease;
}
.w-rain .rain-layer,
.w-thunder .rain-layer {
  opacity: 0.5;
}
.w-drizzle .rain-layer {
  opacity: 0.26;
  animation-duration: 1.1s;
}
@keyframes rain-fall {
  from { background-position: 0 0; }
  to { background-position: -40px 160px; }
}

/* 雪 */
.snow-layer {
  position: absolute;
  inset: -10%;
  opacity: 0;
  background-image:
    radial-gradient(2.2px 2.2px at 20px 30px, rgba(255, 255, 255, 0.95), transparent),
    radial-gradient(1.8px 1.8px at 92px 82px, rgba(255, 255, 255, 0.85), transparent),
    radial-gradient(2.4px 2.4px at 150px 42px, rgba(255, 255, 255, 0.9), transparent),
    radial-gradient(1.6px 1.6px at 62px 132px, rgba(255, 255, 255, 0.8), transparent);
  background-size: 180px 180px;
  animation: snow-fall 14s linear infinite;
  transition: opacity 0.8s ease;
}
.w-snow .snow-layer {
  opacity: 0.85;
}
@keyframes snow-fall {
  from { background-position: 0 0; }
  to { background-position: 40px 360px; }
}

/* 雾 */
.fog-layer {
  position: absolute;
  inset: 0;
  opacity: 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.72));
  transition: opacity 1s ease;
}
.w-fog .fog-layer {
  opacity: 0.9;
  animation: fog-breathe 11s ease-in-out infinite alternate;
}
@keyframes fog-breathe {
  from { opacity: 0.75; }
  to { opacity: 0.95; }
}

/* 闪电 */
.flash-layer {
  position: absolute;
  inset: 0;
  opacity: 0;
  background: #fff;
}
.w-thunder .flash-layer {
  animation: lightning 8s ease-in-out infinite;
}
@keyframes lightning {
  0%, 90%, 100% { opacity: 0; }
  91% { opacity: 0.5; }
  92% { opacity: 0; }
  93.5% { opacity: 0.32; }
  94.5% { opacity: 0; }
}

/* 阴雨天把太阳/月亮压暗，避免"暴雨配烈日" */
.hero-banner.w-cloudy .sun-moon,
.hero-banner.w-drizzle .sun-moon,
.hero-banner.w-rain .sun-moon,
.hero-banner.w-thunder .sun-moon {
  opacity: 0.3;
  filter: blur(2px);
}
.hero-banner.w-fog .sun-moon {
  opacity: 0.38;
  filter: blur(4px);
}
.hero-banner.w-snow .sun-moon {
  opacity: 0.55;
}

.sun-times {
  margin-top: 10px;
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.74);
  letter-spacing: 0.5px;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.28);
}

.weather-chip {
  position: absolute;
  right: 20px;
  bottom: 18px;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 999px;
  background: rgba(13, 40, 71, 0.32);
  border: 1px solid rgba(255, 255, 255, 0.26);
  backdrop-filter: blur(10px);
  color: #fff;
  font-size: 13px;
  line-height: 1;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}
.wc-icon {
  font-size: 15px;
}
.wc-temp {
  font-size: 16px;
  font-weight: 700;
}
.wc-city {
  opacity: 0.82;
  margin-left: 2px;
  padding-left: 8px;
  border-left: 1px solid rgba(255, 255, 255, 0.3);
}

.sun-moon {
  position: absolute;
  z-index: 1;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  top: 40px;
  right: 80px;
  animation: celestial-float 6s ease-in-out infinite;
}
.sun-moon.morning {
  background: radial-gradient(circle, #fff176, #ffb74d);
  box-shadow: 0 0 40px rgba(255, 183, 77, 0.6);
}
.sun-moon.day {
  background: radial-gradient(circle, #fffde7, #fff9c4);
  box-shadow: 0 0 50px rgba(255, 249, 196, 0.8);
}
.sun-moon.evening {
  background: radial-gradient(circle, #ffab91, #ff7043);
  box-shadow: 0 0 40px rgba(255, 112, 67, 0.6);
}
.sun-moon.night {
  background: radial-gradient(circle, #e3f2fd, #90caf9);
  box-shadow: 0 0 30px rgba(144, 202, 249, 0.4);
}
@keyframes celestial-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-15px); }
}

.hero-overlay {
  position: absolute;
  z-index: 2;
  top: 0; left: 0;
  width: 100%; height: 100%;
  display: flex;
  align-items: flex-start;
  padding: 32px;
  /* 阴/雾/雪天背景偏亮，压一层暗角保证白字可读 */
  background: linear-gradient(120deg, rgba(10, 25, 41, 0.26) 0%, rgba(10, 25, 41, 0) 62%);
}
.greeting-text {
  font-size: 32px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  margin-bottom: 8px;
  letter-spacing: 2px;
}
.greeting-sub {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 1px;
}
.hero-bottom-gradient {
  position: absolute;
  z-index: 1;
  bottom: 0; left: 0; right: 0;
  height: 60px;
  background: linear-gradient(180deg, transparent, rgba(248, 251, 255, 0.5));
}

.content-section {
  margin-bottom: 36px;
}
.section-title {
  font-size: 22px;
  font-weight: 700;
  color: #0d2847;
  margin-bottom: 20px;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.section-header .section-title {
  margin-bottom: 0;
}

.hotspot-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.hotspot-card {
  background: #fff;
  border-radius: 14px;
  padding: 20px 24px;
  box-shadow: 0 2px 12px rgba(13, 40, 71, 0.06);
  transition: all 0.3s ease;
  border-left: 4px solid #42a5f5;
}
.hotspot-card:hover {
  transform: translateX(4px);
  box-shadow: 0 4px 20px rgba(66, 165, 245, 0.12);
}
.hotspot-tag {
  display: inline-block;
  padding: 3px 12px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  color: #42a5f5;
  background: rgba(66, 165, 245, 0.1);
  margin-bottom: 10px;
}
.hotspot-title {
  font-size: 17px;
  font-weight: 600;
  color: #0d2847;
  margin-bottom: 8px;
}
.hotspot-desc {
  font-size: 14px;
  color: #607d8b;
  line-height: 1.6;
  margin-bottom: 12px;
}
.hotspot-meta {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #90a4ae;
}

.today-stats {
  display: flex;
  gap: 20px;
}
.stat-card {
  flex: 1;
  background: #fff;
  border-radius: 16px;
  padding: 28px 32px;
  display: flex;
  align-items: center;
  gap: 20px;
  box-shadow: 0 2px 12px rgba(13, 40, 71, 0.06);
  transition: all 0.3s ease;
}
.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(13, 40, 71, 0.12);
}
.stat-boards {
  border-left: 4px solid #42a5f5;
}
.stat-books {
  border-left: 4px solid #66bb6a;
}
.stat-icon {
  font-size: 40px;
}
.stat-num {
  font-size: 36px;
  font-weight: 700;
  color: #0d2847;
  line-height: 1.2;
}
.stat-label {
  font-size: 14px;
  color: #78909c;
  margin-top: 4px;
}

.chart-container {
  background: #fff;
  border-radius: 16px;
  padding: 28px 24px;
  box-shadow: 0 2px 12px rgba(13, 40, 71, 0.06);
}
.bar-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: 200px;
  gap: 12px;
}
.bar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}
.bar-wrapper {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.bar-fill {
  width: 70%;
  max-width: 48px;
  background: linear-gradient(180deg, #42a5f5, #1e88e5);
  border-radius: 8px 8px 0 0;
  transition: all 0.5s ease;
  position: relative;
  min-height: 4px;
}
.bar-fill:hover {
  background: linear-gradient(180deg, #64b5f6, #42a5f5);
  transform: scaleY(1.05);
}
.bar-count {
  position: absolute;
  top: -22px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 13px;
  font-weight: 600;
  color: #1e88e5;
}
.bar-label {
  margin-top: 8px;
  font-size: 13px;
  color: #78909c;
}

.hot-board-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}
.hot-board-card {
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 12px rgba(13, 40, 71, 0.06);
}
.hot-board-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(66, 165, 245, 0.15);
}
.hb-cover {
  height: 140px;
  background: linear-gradient(135deg, #e3f2fd, #bbdefb);
  background-size: cover;
  background-position: center;
}
.hb-info {
  padding: 14px 16px;
}
.hb-title {
  font-size: 15px;
  font-weight: 600;
  color: #0d2847;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hb-author {
  font-size: 13px;
  color: #78909c;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hb-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #90a4ae;
}
.hb-sellers {
  color: #43a047;
  font-weight: 600;
}
.hb-views {
  color: #fb8c00;
}

@media (max-width: 768px) {
  .hero-banner {
    height: 190px;
    border-radius: 12px;
    margin-bottom: 20px;
  }
  .sun-moon {
    width: 42px;
    height: 42px;
    top: 18px;
    right: 20px;
  }
  .hero-overlay {
    padding: 18px;
  }
  .greeting-text {
    font-size: 21px;
    letter-spacing: 1px;
    margin-bottom: 4px;
  }
  .greeting-sub {
    font-size: 13px;
  }
  .sun-times {
    margin-top: 6px;
    gap: 10px;
    font-size: 11px;
  }
  .weather-chip {
    right: 12px;
    bottom: 12px;
    padding: 5px 10px;
    font-size: 12px;
    gap: 4px;
  }
  .wc-temp {
    font-size: 14px;
  }
  .wc-icon {
    font-size: 13px;
  }
  .content-section {
    margin-bottom: 22px;
  }
  .section-title {
    font-size: 18px;
    margin-bottom: 14px;
  }
  .hotspot-card {
    padding: 14px 16px;
    border-radius: 12px;
  }
  .hotspot-title {
    font-size: 15px;
  }
  .today-stats {
    flex-direction: column;
    gap: 12px;
  }
  .stat-card {
    padding: 16px 18px;
    border-radius: 12px;
    gap: 14px;
  }
  .stat-icon {
    font-size: 30px;
  }
  .stat-num {
    font-size: 26px;
  }
  .chart-container {
    padding: 18px 10px;
    border-radius: 12px;
  }
  .bar-chart {
    height: 150px;
    gap: 4px;
  }
  .bar-label {
    font-size: 11px;
  }
  .bar-count {
    font-size: 11px;
  }
  .hot-board-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  .hot-board-card {
    border-radius: 12px;
  }
  .hb-cover {
    height: 105px;
  }
  .hb-info {
    padding: 10px 12px;
  }
  .hb-title {
    font-size: 14px;
  }
}
</style>