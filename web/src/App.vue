<template>
  <div id="layout">
    <NavBar v-if="!isLoginPage" />
    <main class="main-content" :class="{ 'no-nav': isLoginPage }">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from '@/components/NavBar.vue'

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
</style>