<template>
  <nav class="tabbar">
    <div class="tab-item tab-menu" @click="openPanel">
      <el-icon><ArrowLeft /></el-icon>
      <span>{{ $t('tabbar.menu') }}</span>
    </div>
    <router-link to="/" class="tab-item">
      <el-icon><HomeFilled /></el-icon>
      <span>{{ $t('tabbar.home') }}</span>
    </router-link>
    <router-link to="/trade" class="tab-item">
      <el-icon><ShoppingBag /></el-icon>
      <span>{{ $t('tabbar.trade') }}</span>
    </router-link>
    <router-link to="/plaza" class="tab-item">
      <el-icon><ChatLineSquare /></el-icon>
      <span>{{ $t('tabbar.plaza') }}</span>
    </router-link>
    <div class="tab-item tab-publish" @click="goPublish">
      <div class="publish-btn">
        <el-icon><Plus /></el-icon>
      </div>
      <span>{{ $t('tabbar.publish') }}</span>
    </div>
    <router-link to="/chat" class="tab-item">
      <div class="tab-icon-wrap">
        <el-badge :value="unreadTotal" :hidden="!unreadTotal" :max="99">
          <el-icon><ChatDotRound /></el-icon>
        </el-badge>
      </div>
      <span>{{ $t('tabbar.chat') }}</span>
    </router-link>
    <router-link to="/ai-chat" class="tab-item">
      <el-icon><MagicStick /></el-icon>
      <span>{{ $t('tabbar.ai') }}</span>
    </router-link>
    <router-link to="/profile" class="tab-item">
      <el-icon><User /></el-icon>
      <span>{{ $t('tabbar.mine') }}</span>
    </router-link>
  </nav>

  <teleport to="body">
    <transition name="panel">
      <div v-if="showPanel" class="panel-overlay" @click="closePanel">
        <div class="panel-sheet" @click.stop>
          <div class="panel-handle"></div>
          <div class="panel-content">
            <div class="panel-row panel-avatar-row" @click="go('/profile')">
              <img :src="resolveImg(userStore.userInfo?.avatar) || defaultAvatar" class="panel-avatar" />
              <span class="panel-username">{{ userStore.userInfo?.nickname || '同学' }}</span>
              <el-icon class="panel-arrow"><ArrowRight /></el-icon>
            </div>

            <div class="panel-row" @click="toggleLang">
              <el-icon class="panel-row-icon"><Comment /></el-icon>
              <span class="panel-row-label">{{ currentLang() === 'en' ? 'English' : '中文' }}</span>
              <span class="panel-row-value">{{ currentLang() === 'en' ? '切换中文' : 'Switch to EN' }}</span>
            </div>

            <div class="panel-row" @click="go('/cart')">
              <el-icon class="panel-row-icon"><ShoppingCart /></el-icon>
              <span class="panel-row-label">{{ $t('nav.cart') }}</span>
              <el-icon class="panel-arrow"><ArrowRight /></el-icon>
            </div>

            <div v-if="isAdmin" class="panel-row" @click="go('/admin')">
              <el-icon class="panel-row-icon"><Setting /></el-icon>
              <span class="panel-row-label">{{ $t('nav.admin') }}</span>
              <el-icon class="panel-arrow"><ArrowRight /></el-icon>
            </div>

            <div class="panel-row" @click="toggleNotif">
              <el-icon class="panel-row-icon"><Bell /></el-icon>
              <span class="panel-row-label">{{ $t('nav.notifications') }}</span>
              <el-badge :value="unreadCount" :hidden="unreadCount === 0" :max="99" class="panel-row-badge" />
              <el-icon class="panel-arrow" :class="{ rotated: notifExpanded }"><ArrowDown /></el-icon>
            </div>
            <transition name="notif">
              <div v-if="notifExpanded" class="notif-list-inline">
                <div v-if="notifications.length">
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
                <el-empty v-else :description="$t('nav.notifications')" :image-size="50" />
              </div>
            </transition>

            <div class="panel-row panel-logout" @click="handleLogout">
              <el-icon class="panel-row-icon"><SwitchButton /></el-icon>
              <span class="panel-row-label">{{ $t('nav.logout') }}</span>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { setLang, currentLang } from '@/i18n'
import { notificationApi, conversationApi } from '@/api'
import { resolveImg } from '@/utils/image'
import {
  HomeFilled, ShoppingBag, ChatLineSquare, ChatDotRound, User, Plus, MagicStick,
  ArrowLeft, ArrowRight, ArrowDown, Bell, ShoppingCart, Setting, SwitchButton, Comment
} from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()
const unreadTotal = ref(0)
let pollTimer = null

const showPanel = ref(false)
const notifExpanded = ref(false)
const notifications = ref([])
const unreadCount = computed(() => notifications.value.filter((n) => !n.isRead).length)
const isAdmin = computed(() => userStore.userInfo?.role === 'admin')

const defaultAvatar = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="20" fill="%2342a5f5"/><text x="50%" y="50%" fill="%23fff" text-anchor="middle" dy=".35em" font-size="16">文</text></svg>'

async function loadUnread() {
  try {
    const res = await conversationApi.list()
    const list = res.data || res || []
    unreadTotal.value = list.reduce((sum, c) => sum + (Number(c.unreadCount) || 0), 0)
  } catch {}
}

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

function goPublish() { router.push('/publish') }

function openPanel() {
  showPanel.value = true
  loadNotifications()
}
function closePanel() { showPanel.value = false }
function go(path) {
  showPanel.value = false
  router.push(path)
}
function toggleLang() {
  setLang(currentLang() === 'en' ? 'zh' : 'en')
}
function toggleNotif() {
  notifExpanded.value = !notifExpanded.value
  if (notifExpanded.value) loadNotifications()
}
function handleLogout() {
  showPanel.value = false
  userStore.logout()
  router.push('/login')
}

onMounted(() => {
  loadUnread()
  // 后台标签页不轮询，回到前台立即补一次，省电省流量也避免无谓渲染
  pollTimer = setInterval(() => {
    if (!document.hidden) loadUnread()
  }, 30000)
  document.addEventListener('visibilitychange', onVisible)
})
onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  document.removeEventListener('visibilitychange', onVisible)
})

function onVisible() {
  if (!document.hidden) loadUnread()
}
</script>

<style scoped>
.tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  height: calc(56px + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--nav-bg);
  backdrop-filter: blur(18px) saturate(180%);
  -webkit-backdrop-filter: blur(18px) saturate(180%);
  box-shadow: 0 -2px 24px rgba(13, 40, 71, 0.12);
  z-index: 200;
  display: none;
}
/* 顶部渐变发丝线，与 NavBar 呼应 */
.tabbar::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent-soft) 30%, var(--accent) 50%, var(--accent-soft) 70%, transparent);
  opacity: 0.55;
  pointer-events: none;
}
.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  color: var(--nav-text);
  font-size: 11px;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  transition: color 0.25s var(--ease-smooth);
}
.tab-item .el-icon {
  font-size: 22px;
  transition: transform 0.3s var(--ease-spring);
}
.tab-item:active .el-icon {
  transform: scale(0.85);
}
.tab-item.router-link-active {
  color: var(--accent);
  font-weight: 600;
}
/* 切到某个 Tab 时图标弹性放大，页面"活"的反馈 */
.tab-item.router-link-active .el-icon {
  animation: tab-pop 0.45s var(--ease-spring);
}
@keyframes tab-pop {
  0% { transform: scale(0.7); }
  55% { transform: scale(1.25); }
  100% { transform: scale(1); }
}
.tab-icon-wrap :deep(.el-badge__content) {
  transform: scale(0.85);
}
.tab-menu {
  color: var(--nav-text);
  cursor: pointer;
}
.tab-menu:active {
  color: var(--accent);
}
.tab-publish .publish-btn {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-2), var(--accent-strong));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px var(--accent-soft);
  margin-top: -22px;
  border: 3px solid rgba(255, 255, 255, 0.95);
  transition: transform 0.25s var(--ease-spring);
  /* 呼吸光圈：静止时也有生命感 */
  animation: publish-breathe 3.2s ease-in-out infinite;
}
@keyframes publish-breathe {
  0%, 100% { box-shadow: 0 4px 16px var(--accent-soft); }
  50% { box-shadow: 0 6px 24px var(--accent-soft), 0 0 0 6px var(--accent-soft-2); }
}
.tab-publish .publish-btn .el-icon {
  font-size: 24px;
  color: #fff;
}
.tab-publish:active .publish-btn {
  transform: scale(0.92);
  animation-play-state: paused;
}
@media (max-width: 768px) {
  .tabbar {
    display: flex;
  }
}
</style>

<style>
.panel-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 9999;
  display: flex;
  align-items: flex-end;
  -webkit-tap-highlight-color: transparent;
}
.panel-sheet {
  width: 100%;
  max-height: 52vh;
  background: var(--card-bg);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-radius: 18px 18px 0 0;
  overflow-y: auto;
  box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.15);
  animation: panel-slide-up 0.28s var(--ease-spring);
}
@keyframes panel-slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.panel-handle {
  width: 38px;
  height: 4px;
  border-radius: 2px;
  background: #e0e0e0;
  margin: 8px auto 4px;
}
.panel-content {
  padding-bottom: env(safe-area-inset-bottom);
}
.panel-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(127, 140, 150, 0.14);
  cursor: pointer;
  transition: background 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.panel-row:active {
  background: var(--accent-soft-2);
}
.panel-row-icon {
  font-size: 20px;
  color: var(--text-sub);
}
.panel-row-label {
  font-size: 15px;
  color: var(--text-main);
  font-weight: 500;
}
.panel-row-value {
  margin-left: auto;
  font-size: 13px;
  color: var(--text-sub);
  opacity: 0.75;
}
.panel-arrow {
  margin-left: auto;
  color: #cfd8dc;
  font-size: 16px;
  transition: transform 0.2s;
}
.panel-arrow.rotated {
  transform: rotate(180deg);
}
.panel-avatar-row {
  padding: 16px 20px;
}
.panel-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #e3f2fd;
}
.panel-username {
  font-size: 16px;
  font-weight: 600;
  color: var(--nav-text-strong);
}
.panel-row-badge {
  margin-left: auto;
}
.panel-row-badge :deep(.el-badge__content) {
  transform: scale(0.9);
}
.panel-logout .panel-row-icon,
.panel-logout .panel-row-label {
  color: #ef5350;
}
.notif-list-inline {
  background: var(--accent-soft-2);
  border-bottom: 1px solid rgba(127, 140, 150, 0.14);
  max-height: 30vh;
  overflow-y: auto;
}
.notif-item {
  padding: 10px 20px;
  border-bottom: 1px solid rgba(127, 140, 150, 0.1);
  position: relative;
}
.notif-item.unread {
  background: var(--accent-soft-2);
}
.notif-dot {
  position: absolute;
  left: 10px;
  top: 16px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 6px var(--accent);
}
.notif-content {
  font-size: 13px;
  color: var(--text-main);
  line-height: 1.5;
  padding-left: 12px;
  margin: 0;
}
.notif-time {
  display: block;
  font-size: 11px;
  color: var(--text-sub);
  opacity: 0.75;
  margin-top: 3px;
  padding-left: 12px;
}
.panel-enter-active,
.panel-leave-active {
  transition: opacity 0.25s;
}
.panel-enter-from,
.panel-leave-to {
  opacity: 0;
}
.notif-enter-active,
.notif-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.notif-enter-from,
.notif-leave-to {
  opacity: 0;
  max-height: 0;
}
</style>