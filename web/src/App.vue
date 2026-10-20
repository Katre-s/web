<template>
  <div id="layout">
    <NavBar v-if="!isAuthPage" />
    <main class="main-content" :class="{ 'no-nav': isAuthPage }">
      <router-view />
    </main>
    <TabBar v-if="!isAuthPage" />
    <AiFloat v-if="!isAuthPage" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import TabBar from '@/components/TabBar.vue'
import AiFloat from '@/components/AiFloat.vue'

const route = useRoute()
const isAuthPage = computed(() => route.path === '/login' || route.path === '/forgot-password')
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