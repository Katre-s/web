<template>
  <div class="home-page">
    <div class="hero-banner" :class="timePeriod">
      <div class="sun-moon" :class="timePeriod"></div>
      <div class="hero-overlay">
        <div class="greeting">
          <h1 class="greeting-text">{{ greeting }}，{{ userStore.userInfo?.nickname || '同学' }}</h1>
          <p class="greeting-sub">{{ greetingSub }}</p>
        </div>
      </div>
      <div class="hero-bottom-gradient"></div>
    </div>

    <div class="content-section">
      <h2 class="section-title">学院分类</h2>
      <div class="college-grid">
        <div
          v-for="college in colleges"
          :key="college.name"
          class="college-card"
          @click="goTrade(college.name)"
        >
          <div class="college-icon" :style="{ background: college.color }">
            <span>{{ college.icon }}</span>
          </div>
          <span class="college-name">{{ college.name }}</span>
        </div>
      </div>
    </div>

    <div class="content-section">
      <div class="section-header">
        <h2 class="section-title">校园热点</h2>
        <el-button type="primary" round size="small" @click="showPostDialog = true">投稿</el-button>
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
        <el-empty v-if="!hotspots.length" description="暂无热点，快来投稿吧" />
      </div>
    </div>

    <el-dialog v-model="showPostDialog" title="投稿校园热点" width="500px">
      <el-form label-position="top">
        <el-form-item label="标题">
          <el-input v-model="postForm.title" placeholder="请输入标题" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="postForm.tag" placeholder="选择分类" style="width: 100%">
            <el-option label="活动" value="活动" />
            <el-option label="通知" value="通知" />
            <el-option label="讨论" value="讨论" />
            <el-option label="分享" value="分享" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="postForm.description" type="textarea" :rows="4" placeholder="请输入内容" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPostDialog = false">取消</el-button>
        <el-button type="primary" @click="submitPost">发布</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { hotspotApi } from '@/api'

const userStore = useUserStore()
const router = useRouter()

const now = new Date()
const hour = now.getHours()

const timePeriod = computed(() => {
  if (hour >= 5 && hour < 9) return 'morning'
  if (hour >= 9 && hour < 17) return 'day'
  if (hour >= 17 && hour < 20) return 'evening'
  return 'night'
})

const greeting = computed(() => {
  if (hour >= 5 && hour < 9) return '早上好'
  if (hour >= 9 && hour < 12) return '上午好'
  if (hour >= 12 && hour < 14) return '中午好'
  if (hour >= 14 && hour < 18) return '下午好'
  if (hour >= 18 && hour < 22) return '晚上好'
  return '夜深了'
})

const greetingSub = computed(() => {
  const subs = {
    morning: '新的一天，从文衡开始',
    day: '阳光正好，适合淘书',
    evening: '夕阳西下，书韵悠长',
    night: '夜深了，注意休息'
  }
  return subs[timePeriod.value]
})

const colleges = [
  { name: '机电工程学院', icon: '⚙', color: 'linear-gradient(135deg, #42a5f5, #1e88e5)' },
  { name: '电气与控制工程学院', icon: '⚡', color: 'linear-gradient(135deg, #7c4dff, #536dfe)' },
  { name: '信息工程学院', icon: '💻', color: 'linear-gradient(135deg, #66bb6a, #43a047)' },
  { name: '土木工程学院', icon: '🏗', color: 'linear-gradient(135deg, #ffa726, #fb8c00)' },
  { name: '化学与环境工程学院', icon: '⚗', color: 'linear-gradient(135deg, #ab47bc, #8e24aa)' },
  { name: '矿业与安全工程学院', icon: '⛏', color: 'linear-gradient(135deg, #78909c, #546e7a)' },
  { name: '管理工程学院', icon: '📊', color: 'linear-gradient(135deg, #ec407a, #d81b60)' },
  { name: '经济学院', icon: '💰', color: 'linear-gradient(135deg, #26a69a, #00897b)' },
  { name: '外国语学院', icon: '🌐', color: 'linear-gradient(135deg, #5c6bc0, #3949ab)' },
  { name: '设计艺术学院', icon: '🎨', color: 'linear-gradient(135deg, #ff7043, #f4511e)' },
  { name: '马克思主义学院', icon: '📖', color: 'linear-gradient(135deg, #8d6e63, #6d4c41)' },
  { name: '人文学院', icon: '📚', color: 'linear-gradient(135deg, #ba68c8, #ab47bc)' },
  { name: '数学与统计学院', icon: '🔢', color: 'linear-gradient(135deg, #4db6ac, #26a69a)' },
  { name: '体育学院', icon: '🏃', color: 'linear-gradient(135deg, #ef5350, #e53935)' },
  { name: '食品与生物工程学院', icon: '🧪', color: 'linear-gradient(135deg, #9ccc65, #7cb342)' },
  { name: '环境工程学院', icon: '🌿', color: 'linear-gradient(135deg, #4fc3f7, #29b6f6)' }
]

const hotspots = ref([])

const showPostDialog = ref(false)
const postForm = ref({ title: '', tag: '', description: '' })

async function loadHotspots() {
  try {
    const res = await hotspotApi.list()
    hotspots.value = res.data || []
  } catch {}
}

function formatTime(t) {
  if (!t) return ''
  const d = new Date(t)
  const now = Date.now()
  const diff = Math.floor((now - d.getTime()) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function goTrade(collegeName) {
  router.push({ path: '/trade', query: { college: collegeName } })
}

async function submitPost() {
  if (!postForm.value.title || !postForm.value.tag || !postForm.value.description) {
    ElMessage.warning('请填写完整信息')
    return
  }
  try {
    await hotspotApi.create(postForm.value)
    ElMessage.success('投稿成功')
    postForm.value = { title: '', tag: '', description: '' }
    showPostDialog.value = false
    loadHotspots()
  } catch {}
}

onMounted(loadHotspots)
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

.sun-moon {
  position: absolute;
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
  top: 0; left: 0;
  width: 100%; height: 100%;
  display: flex;
  align-items: flex-start;
  padding: 32px;
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

.college-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
}
.college-card {
  background: #fff;
  border-radius: 14px;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 12px rgba(13, 40, 71, 0.06);
}
.college-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(66, 165, 245, 0.15);
}
.college-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #fff;
  transition: transform 0.3s;
}
.college-card:hover .college-icon {
  transform: scale(1.1) rotate(5deg);
}
.college-name {
  font-size: 14px;
  font-weight: 500;
  color: #37474f;
  text-align: center;
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
</style>