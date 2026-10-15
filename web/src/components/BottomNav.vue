<template>
  <nav class="bottom-nav">
    <router-link to="/" class="nav-tab" :class="{ active: isActive('/') }">
      <el-icon><HomeFilled /></el-icon>
      <span>首页</span>
    </router-link>
    <router-link to="/trade" class="nav-tab" :class="{ active: isActive('/trade') }">
      <el-icon><ShoppingBag /></el-icon>
      <span>交易</span>
    </router-link>
    <router-link to="/chat" class="nav-tab" :class="{ active: isActive('/chat') }">
      <el-icon><ChatDotRound /></el-icon>
      <span>对话</span>
    </router-link>
    <router-link to="/profile" class="nav-tab" :class="{ active: isActive('/profile') }">
      <el-icon><User /></el-icon>
      <span>我的</span>
    </router-link>
  </nav>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { HomeFilled, ShoppingBag, ChatDotRound, User } from '@element-plus/icons-vue'

const route = useRoute()

function isActive(path) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}
</script>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  box-shadow: 0 -2px 20px rgba(13, 40, 71, 0.08);
  display: flex;
  justify-content: space-around;
  align-items: center;
  z-index: 100;
  padding-bottom: env(safe-area-inset-bottom);
}
.nav-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: #90a4ae;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.3s ease;
  padding: 6px 16px;
  border-radius: 12px;
}
.nav-tab .el-icon {
  font-size: 22px;
  transition: transform 0.3s ease;
}
.nav-tab:hover {
  color: #42a5f5;
}
.nav-tab:hover .el-icon {
  transform: translateY(-2px);
}
.nav-tab.active {
  color: #42a5f5;
}
.nav-tab.active .el-icon {
  transform: scale(1.1);
}
</style>