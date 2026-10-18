<template>
  <div id="layout">
    <NavBar v-if="!isLoginPage" />
    <main class="main-content" :class="{ 'no-nav': isLoginPage }">
      <router-view />
    </main>
    <TabBar v-if="!isLoginPage" />
    <AiFloat v-if="!isLoginPage" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import TabBar from '@/components/TabBar.vue'
import AiFloat from '@/components/AiFloat.vue'

const route = useRoute()
const isLoginPage = computed(() => route.path === '/login')
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
</style>