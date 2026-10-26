<template>
  <header class="navbar">
    <div class="nav-inner">
      <router-link to="/" class="brand">
        <BrandLogo :size="30" />
        <span class="brand-name">小咸鱼</span>
      </router-link>
      <div class="nav-left" v-if="userStore.isLoggedIn">
        <div class="avatar-box">
          <img :src="thumb(userStore.userInfo?.avatar, 96) || defaultAvatar" class="avatar" />
        </div>
        <span class="username">{{ userStore.userInfo?.nickname || '同学' }}</span>
      </div>

      <nav class="nav-links">
        <router-link to="/" class="nav-item" :title="$t('nav.home')">
          <el-icon><HomeFilled /></el-icon>
          <span>{{ $t('nav.home') }}</span>
        </router-link>
        <router-link to="/trade" class="nav-item" :title="$t('nav.trade')">
          <el-icon><ShoppingBag /></el-icon>
          <span>{{ $t('nav.trade') }}</span>
        </router-link>
        <router-link to="/plaza" class="nav-item" :title="$t('nav.plaza')">
          <el-icon><ChatLineSquare /></el-icon>
          <span>{{ $t('nav.plaza') }}</span>
        </router-link>
        <router-link to="/chat" class="nav-item" :title="$t('nav.chat')">
          <el-icon><ChatDotRound /></el-icon>
          <span>{{ $t('nav.chat') }}</span>
        </router-link>
        <router-link to="/ai-chat" class="nav-item" :title="$t('nav.ai')" @click="restoreFloat">
          <el-icon><MagicStick /></el-icon>
          <span>{{ $t('nav.ai') }}</span>
        </router-link>
        <router-link to="/orders" class="nav-item" :title="$t('nav.orders')">
          <el-icon><Tickets /></el-icon>
          <span>{{ $t('nav.orders') }}</span>
        </router-link>
        <router-link to="/profile" class="nav-item" :title="$t('nav.profile')">
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

        <router-link to="/orders" class="icon-btn mobile-only" :title="$t('nav.orders')">
          <el-icon :size="20"><Tickets /></el-icon>
        </router-link>

        <router-link v-if="isAdmin" to="/admin" class="icon-btn mobile-only" title="管理台">
          <el-icon :size="20"><Setting /></el-icon>
        </router-link>

        <el-popover v-if="userStore.isLoggedIn" placement="bottom-end" :width="320" trigger="click" @show="loadNotifications">
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

        <!-- 同一个位置两种身份：已登录是「退出登录」，未登录是「登录」 -->
        <el-button v-if="userStore.isLoggedIn" text class="logout-btn" @click="handleLogout">{{ $t('nav.logoutFull') }}</el-button>
        <el-button v-else type="primary" round size="small" class="login-btn" @click="openLogin">{{ $t('nav.login') }}</el-button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { useRouter } from 'vue-router'
import { HomeFilled, ShoppingBag, ChatLineSquare, ChatDotRound, User, Bell, Setting, Tickets, MagicStick, CaretBottom } from '@element-plus/icons-vue'
import { notificationApi } from '@/api'
import { openAuthDialog } from '@/stores/authDialog'
import { setLang, currentLang } from '@/i18n'
import { resolveImg, thumb } from '@/utils/image'
import BrandLogo from '@/components/BrandLogo.vue'

const userStore = useUserStore()
const router = useRouter()
const defaultAvatar = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="20" fill="%2310667a"/><text x="50%" y="50%" fill="%23fff" text-anchor="middle" dy=".35em" font-size="15">鱼</text></svg>'

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
  // 退出后回到首页（首页是唯一公开页），不再跳已不存在的 /login
  router.push('/')
}

function openLogin() {
  openAuthDialog('login')
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

onMounted(() => {
  if (userStore.isLoggedIn) loadNotifications()
})
</script>

<style scoped>
.navbar {
  background: var(--nav-bg);
  backdrop-filter: blur(18px) saturate(180%);
  -webkit-backdrop-filter: blur(18px) saturate(180%);
  box-shadow: 0 2px 20px rgba(13, 40, 71, 0.08);
  position: sticky;
  top: 0;
  z-index: 100;
  transition: background 0.4s ease;
}
/* 底部渐变发丝线：科技感的"光边" */
.navbar::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent-soft) 30%, var(--accent) 50%, var(--accent-soft) 70%, transparent);
  opacity: 0.55;
  pointer-events: none;
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
  color: var(--nav-text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 110px;
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
  white-space: nowrap;
  border-radius: 12px;
  color: var(--nav-text);
  font-size: 15px;
  font-weight: 500;
  transition: color 0.3s ease, background 0.3s ease, transform 0.25s var(--ease-spring), box-shadow 0.3s ease;
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
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
  box-shadow: 0 0 8px var(--accent);
  transition: all 0.3s var(--ease-spring);
  transform: translateX(-50%);
}
.nav-item:hover {
  color: var(--accent);
  background: var(--accent-soft-2);
  transform: translateY(-1px);
}
.nav-item:hover::after {
  width: 60%;
}
.nav-item.router-link-active {
  color: var(--accent);
  background: var(--accent-soft);
  box-shadow: 0 4px 14px var(--accent-soft-2);
}
.nav-item.router-link-active::after {
  width: 60%;
}
/* active 图标轻轻弹一下，切换页面时有"活着"的反馈 */
.nav-item.router-link-active .el-icon {
  animation: nav-pop 0.4s var(--ease-spring);
}
@keyframes nav-pop {
  0% { transform: scale(1); }
  45% { transform: scale(1.28); }
  100% { transform: scale(1); }
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
  color: var(--nav-text);
}
.bell-box:hover {
  background: var(--accent-soft-2);
  color: var(--accent);
}
.bell-box:hover .bell-icon {
  animation: bell-ring 0.8s var(--ease-smooth);
}
@keyframes bell-ring {
  0%, 100% { transform: rotate(0deg); }
  20% { transform: rotate(14deg); }
  40% { transform: rotate(-11deg); }
  60% { transform: rotate(7deg); }
  80% { transform: rotate(-4deg); }
}
.bell-icon {
  color: var(--nav-text);
}
.logout-btn {
  color: var(--text-sub);
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
  color: var(--nav-text);
  padding: 5px 10px;
  border-radius: 10px;
  border: 1px solid var(--accent-soft);
  transition: all 0.2s;
}
.lang-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-soft-2);
}
.logout-btn:hover {
  color: #ef5350;
}
/* 未登录时右上角的入口按钮 */
.login-btn {
  height: 34px;
  padding: 0 18px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 1px;
  box-shadow: 0 6px 16px var(--accent-soft);
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
  color: var(--text-main);
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
.brand {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-right: 16px;
  flex-shrink: 0;
}
.brand > :first-child {
  transition: transform 0.4s var(--ease-spring);
}
.brand:hover > :first-child {
  animation: brand-wiggle 0.7s var(--ease-spring);
}
@keyframes brand-wiggle {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-8deg); }
  60% { transform: rotate(6deg); }
}
.brand-name {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 1px;
  color: var(--nav-text-strong);
  white-space: nowrap;
}

/* 中等宽度：先收窄导航，避免文字被挤成竖排 */
@media (max-width: 1180px) {
  .nav-inner {
    padding: 0 16px;
  }
  .brand {
    margin-right: 10px;
  }
  .brand-name {
    display: none;
  }
  .nav-links {
    gap: 2px;
  }
  .nav-item {
    padding: 8px 12px;
    font-size: 14px;
  }
  .nav-right {
    gap: 8px;
  }
  .username {
    max-width: 80px;
  }
}

/* 更窄（仍在桌面布局内）：只留图标，文字进 title 提示 */
@media (max-width: 1040px) {
  .nav-links {
    gap: 0;
  }
  .nav-links .nav-item span {
    display: none;
  }
  .nav-item {
    padding: 9px 12px;
  }
  .nav-right {
    gap: 6px;
  }
  .lang-btn {
    padding: 5px 8px;
  }
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
  .brand {
    margin-right: 8px;
    gap: 5px;
  }
  .brand-name {
    font-size: 15px;
  }
  .notif-panel {
    max-height: 60vh;
  }
  .notif-list {
    max-height: 46vh;
  }
}

</style>