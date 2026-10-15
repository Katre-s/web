<template>
  <div id="layout">
    <main class="main-content">
      <router-view />
    </main>
    <BottomNav />
  </div>
</template>

<script setup>
import BottomNav from '@/components/BottomNav.vue'
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
  padding-bottom: 84px;
}
</style>