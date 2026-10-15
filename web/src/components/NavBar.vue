<template>
  <header class="navbar">
    <div class="nav-inner">
      <div class="nav-left">
        <div class="avatar-box">
          <img :src="userStore.userInfo?.avatar || defaultAvatar" class="avatar" />
        </div>
        <span class="username">{{ userStore.userInfo?.nickname || '同学' }}</span>
      </div>

      <nav class="nav-links">
        <router-link to="/" class="nav-item">
          <el-icon><HomeFilled /></el-icon>
          <span>首页</span>
        </router-link>
        <router-link to="/trade" class="nav-item">
          <el-icon><ShoppingBag /></el-icon>
          <span>交易</span>
        </router-link>
        <router-link to="/chat" class="nav-item">
          <el-icon><ChatDotRound /></el-icon>
          <span>对话</span>
        </router-link>
        <router-link to="/profile" class="nav-item">
          <el-icon><User /></el-icon>
          <span>个人中心</span>
        </router-link>
      </nav>

      <div class="nav-right">
        <el-button text @click="handleLogout" class="logout-btn">退出</el-button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { useUserStore } from '@/stores/user'
import { useRouter } from 'vue-router'
import { HomeFilled, ShoppingBag, ChatDotRound, User } from '@element-plus/icons-vue'

const userStore = useUserStore()
const router = useRouter()
const defaultAvatar = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="20" fill="%2342a5f5"/><text x="50%" y="50%" fill="%23fff" text-anchor="middle" dy=".35em" font-size="16">文</text></svg>'

function handleLogout() {
  userStore.logout()
  router.push('/login')
}
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

.nav-right {
  margin-left: auto;
}
.logout-btn {
  color: #90a4ae;
  font-size: 14px;
}
.logout-btn:hover {
  color: #ef5350;
}
</style>