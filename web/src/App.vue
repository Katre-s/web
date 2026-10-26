<template>
  <div id="layout">
    <NavBar v-if="!isAuthPage" />
    <main class="main-content" :class="{ 'no-nav': isAuthPage }">
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <TabBar v-if="!isAuthPage && !isAdminPage" />
    <AiFloat v-if="!isAuthPage && !isAdminPage" />
    <!-- 登录/注册已改为全局弹窗，任何页面都能唤起 -->
    <AuthDialog />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import NavBar from '@/components/NavBar.vue'
import TabBar from '@/components/TabBar.vue'
import AiFloat from '@/components/AiFloat.vue'
import AuthDialog from '@/components/AuthDialog.vue'

const route = useRoute()
const userStore = useUserStore()
// 登录已是弹窗，只剩「忘记密码」还是整页流程
const isAuthPage = computed(() => route.path === '/forgot-password')
// 后台管理是整屏工作区：手机上底部导航条 + 悬浮 AI 按钮会压住表格最后一行和操作按钮
const isAdminPage = computed(() => route.path.startsWith('/admin'))

// 接口返回 401 时（token 过期），把 pinia 里的登录态一起清掉，
// 否则导航栏还显示着已登录的用户名，但请求已经在报错了
function onAuthExpired() {
  userStore.clearAuth()
}
onMounted(() => window.addEventListener('auth-expired', onAuthExpired))
onUnmounted(() => window.removeEventListener('auth-expired', onAuthExpired))
</script>

<style scoped>
#layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.main-content {
  flex: 1;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 20px;
  /* 盖住 #app::after 的极光层，内容始终在光效之上 */
  position: relative;
  z-index: 1;
}
.main-content.no-nav {
  max-width: 100%;
  padding: 0;
}
@media (max-width: 768px) {
  .main-content {
    padding: 12px 12px calc(72px + env(safe-area-inset-bottom));
  }
  .main-content.no-nav {
    padding: 0;
  }
}
/* 桌面/宽屏：放开内容宽度，电脑客户端 1440 宽下不显得两侧空荡 */
@media (min-width: 1440px) {
  .main-content {
    max-width: 1380px;
    padding: 24px 32px 40px;
  }
}
</style>