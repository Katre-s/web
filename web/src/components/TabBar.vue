<template>
  <nav class="tabbar">
    <router-link to="/" class="tab-item">
      <el-icon><HomeFilled /></el-icon>
      <span>{{ $t('tabbar.home') }}</span>
    </router-link>
    <router-link to="/trade" class="tab-item">
      <el-icon><ShoppingBag /></el-icon>
      <span>{{ $t('tabbar.trade') }}</span>
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
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { HomeFilled, ShoppingBag, ChatDotRound, User, Plus, MagicStick } from '@element-plus/icons-vue'
import { conversationApi } from '@/api'

const router = useRouter()
const unreadTotal = ref(0)
let pollTimer = null

async function loadUnread() {
  try {
    const res = await conversationApi.list()
    const list = res.data || res || []
    unreadTotal.value = list.reduce((sum, c) => sum + (Number(c.unreadCount) || 0), 0)
  } catch {}
}

function goPublish() {
  router.push('/publish')
}

onMounted(() => {
  loadUnread()
  pollTimer = setInterval(loadUnread, 30000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
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
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 -2px 20px rgba(13, 40, 71, 0.1);
  z-index: 200;
  display: none;
}
.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  color: #90a4ae;
  font-size: 11px;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}
.tab-item .el-icon {
  font-size: 22px;
}
.tab-item.router-link-active {
  color: #1e88e5;
  font-weight: 600;
}
.tab-icon-wrap :deep(.el-badge__content) {
  transform: scale(0.85);
}
.tab-publish .publish-btn {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: linear-gradient(135deg, #42a5f5, #1e88e5);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(66, 165, 245, 0.45);
  margin-top: -22px;
  border: 3px solid #fff;
  transition: transform 0.2s;
}
.tab-publish .publish-btn .el-icon {
  font-size: 24px;
  color: #fff;
}
.tab-publish:active .publish-btn {
  transform: scale(0.92);
}
@media (max-width: 768px) {
  .tabbar {
    display: flex;
  }
}
</style>