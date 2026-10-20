<template>
  <header class="navbar">
    <div class="nav-inner">
      <span class="brand-mobile">文衡</span>
      <div class="nav-left">
        <div class="avatar-box">
          <img :src="resolveImg(userStore.userInfo?.avatar) || defaultAvatar" class="avatar" />
        </div>
        <span class="username">{{ userStore.userInfo?.nickname || '同学' }}</span>
      </div>

      <nav class="nav-links">
        <router-link to="/" class="nav-item">
          <el-icon><HomeFilled /></el-icon>
          <span>{{ $t('nav.home') }}</span>
        </router-link>
        <router-link to="/trade" class="nav-item">
          <el-icon><ShoppingBag /></el-icon>
          <span>{{ $t('nav.trade') }}</span>
        </router-link>
        <router-link to="/chat" class="nav-item">
          <el-icon><ChatDotRound /></el-icon>
          <span>{{ $t('nav.chat') }}</span>
        </router-link>
        <router-link to="/ai-chat" class="nav-item" @click="restoreFloat">
          <el-icon><MagicStick /></el-icon>
          <span>{{ $t('nav.ai') }}</span>
        </router-link>
        <router-link to="/cart" class="nav-item">
          <el-icon><ShoppingCart /></el-icon>
          <span>{{ $t('nav.cart') }}</span>
        </router-link>
        <router-link to="/profile" class="nav-item">
          <el-icon><User /></el-icon>
          <span>{{ $t('nav.profile') }}</span>
        </router-link>
      </nav>

      <div class="nav-right">
        <el-dropdown trigger="click" @command="handleLang" class="lang-drop">
          <span class="lang-btn">
            <el-icon :size="16"><CaretBottom /></el-icon>
            {{ currentLang() === 'en' ? 'English' : '中文' }}
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="zh" :disabled="currentLang() === 'zh'">中文</el-dropdown-item>
              <el-dropdown-item command="en" :disabled="currentLang() === 'en'">English</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <router-link v-if="isAdmin" to="/admin" class="nav-item mini">
          <el-icon><Setting /></el-icon>
          <span>{{ $t('nav.admin') }}</span>
        </router-link>

        <router-link to="/cart" class="icon-btn mobile-only" title="购物车">
          <el-icon :size="20"><ShoppingCart /></el-icon>
        </router-link>

        <router-link v-if="isAdmin" to="/admin" class="icon-btn mobile-only" title="管理台">
          <el-icon :size="20"><Setting /></el-icon>
        </router-link>

        <el-popover placement="bottom-end" :width="320" trigger="click" @show="loadNotifications">
          <template #reference>
            <div class="bell-box">
              <el-badge :value="unreadCount" :hidden="unreadCount === 0" :max="99">
                <el-icon :size="20" class="bell-icon"><Bell /></el-icon>
              </el-badge>
            </div>
          </template>

          <div class="notif-panel">
            <div class="notif-header">
              <b>通知</b>
              <el-button text size="small" @click="readAllNotifications">全部已读</el-button>
            </div>
            <div class="notif-list" v-if="notifications.length">
              <div
                v-for="n in notifications"
                :key="n.id"
                class="notif-item"
                :class="{ unread: !n.isRead }"
                @click="markRead(n)"
              >
                <div class="notif-dot" v-if="!n.isRead"></div>
                <p class="notif-content">{{ n.content }}</p>
                <span class="notif-time">{{ formatTime(n.time) }}</span>
              </div>
            </div>
            <el-empty v-else description="暂无通知" :image-size="60" />
          </div>
        </el-popover>

        <el-button text @click="handleLogout" class="logout-btn">{{ $t('nav.logout') }}</el-button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { useRouter } from 'vue-router'
import { HomeFilled, ShoppingBag, ChatDotRound, User, Bell, Setting, ShoppingCart, MagicStick, CaretBottom } from '@element-plus/icons-vue'
import { notificationApi } from '@/api'
import { setLang, currentLang } from '@/i18n'
import { resolveImg } from '@/utils/image'

const userStore = useUserStore()
const router = useRouter()
const defaultAvatar = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="20" fill="%2342a5f5"/><text x="50%" y="50%" fill="%23fff" text-anchor="middle" dy=".35em" font-size="16">文</text></svg>'

const isAdmin = computed(() => userStore.userInfo?.role === 'admin')

const notifications = ref([])
const unreadCount = computed(() => notifications.value.filter((n) => !n.isRead).length)

async function loadNotifications() {
  try {
    const res = await notificationApi.myList()
    notifications.value = res.data?.list || []
  } catch {}
}

async function markRead(n) {
  if (n.isRead) return
  n.isRead = true
  try { await notificationApi.read(n.id) } catch {}
}

async function readAllNotifications() {
  notifications.value.forEach((n) => (n.isRead = true))
  try { await notificationApi.readAll() } catch {}
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

function handleLogout() {
  userStore.logout()
  router.push('/login')
}

// 语言切换
function handleLang(lang) {
  setLang(lang)
}

// 点击「AI助手」时恢复被隐藏的悬浮窗
function restoreFloat() {
  localStorage.removeItem('ai_float_hidden')
  window.dispatchEvent(new Event('ai-float-restore'))
}

onMounted(loadNotifications)
</script>

<style scoped>
.navbar {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 20px rgba(13, 40, 71, 0.08);
  position: sticky;
  top: 0;
  z-index: 100;
}
.nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  height: 64px;
  display: flex;
  align-items: center;
  padding: 0 24px;
}
.nav-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.avatar-box {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid #e3f2fd;
  box-shadow: 0 2px 8px rgba(66, 165, 245, 0.2);
  transition: all 0.3s;
}
.avatar-box:hover {
  border-color: #42a5f5;
  transform: scale(1.05);
}
.avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.username {
  font-size: 15px;
  font-weight: 600;
  color: #0d2847;
}

.nav-links {
  display: flex;
  gap: 8px;
  margin: 0 auto;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 12px;
  color: #546e7a;
  font-size: 15px;
  font-weight: 500;
  transition: all 0.3s ease;
  position: relative;
}
.nav-item::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 50%;
  width: 0;
  height: 3px;
  border-radius: 2px;
  background: linear-gradient(90deg, #42a5f5, #64b5f6);
  transition: all 0.3s ease;
  transform: translateX(-50%);
}
.nav-item:hover {
  color: #42a5f5;
  background: rgba(66, 165, 245, 0.06);
}
.nav-item:hover::after {
  width: 60%;
}
.nav-item.router-link-active {
  color: #42a5f5;
  background: rgba(66, 165, 245, 0.1);
}
.nav-item.router-link-active::after {
  width: 60%;
}
.nav-item.mini {
  padding: 6px 12px;
  font-size: 13px;
  color: #a58a4b;
}

.nav-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}
.bell-box {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
  color: #546e7a;
}
.bell-box:hover {
  background: rgba(66, 165, 245, 0.08);
  color: #42a5f5;
}
.bell-icon {
  color: #546e7a;
}
.logout-btn {
  color: #90a4ae;
  font-size: 14px;
}
.lang-drop {
  cursor: pointer;
  outline: none;
}
.lang-btn {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 13px;
  color: #546e7a;
  padding: 5px 10px;
  border-radius: 10px;
  border: 1px solid #e3f2fd;
  transition: all 0.2s;
}
.lang-btn:hover {
  color: #1e88e5;
  border-color: #42a5f5;
  background: rgba(66, 165, 245, 0.06);
}
.logout-btn:hover {
  color: #ef5350;
}

.notif-panel {
  max-height: 420px;
  display: flex;
  flex-direction: column;
}
.notif-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 6px 10px;
  border-bottom: 1px solid #f0ece2;
}
.notif-header b {
  color: #3b3020;
  letter-spacing: 2px;
}
.notif-list {
  overflow-y: auto;
  max-height: 340px;
}
.notif-item {
  padding: 12px 6px;
  border-bottom: 1px solid #f5f1e8;
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
}
.notif-item:hover {
  background: rgba(165, 138, 75, 0.06);
}
.notif-item.unread {
  background: rgba(66, 165, 245, 0.04);
}
.notif-dot {
  position: absolute;
  left: 0;
  top: 16px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #42a5f5;
  box-shadow: 0 0 6px rgba(66, 165, 245, 0.6);
}
.notif-content {
  font-size: 14px;
  color: #4a4438;
  line-height: 1.5;
  padding-left: 14px;
}
.notif-time {
  display: block;
  font-size: 12px;
  color: #b0a488;
  margin-top: 4px;
  padding-left: 14px;
}

.icon-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #546e7a;
  transition: all 0.3s;
}
.icon-btn.router-link-active {
  color: #42a5f5;
  background: rgba(66, 165, 245, 0.1);
}
.mobile-only {
  display: none;
}
.brand-mobile {
  display: none;
}

/* 宽屏/桌面客户端：导航与内容同宽 */
@media (min-width: 1440px) {
  .nav-inner {
    max-width: 1380px;
    padding: 0 32px;
  }
}

@media (max-width: 768px) {
  .nav-inner {
    height: 54px;
    padding: 0 12px;
    justify-content: center;
  }
  .nav-left {
    display: none;
  }
  .nav-links {
    display: none;
  }
  .nav-right {
    display: none;
  }
  .brand-mobile {
    display: block;
    font-size: 18px;
    font-weight: 700;
    color: #0d2847;
    letter-spacing: 2px;
  }
  .notif-panel {
    max-height: 60vh;
  }
  .notif-list {
    max-height: 46vh;
  }
}

</style>