<template>
  <header class="navbar">
    <div class="nav-inner">
      <router-link to="/" class="logo">文衡</router-link>
      <span class="slogan">文聚学府，百事通达</span>
      <nav class="nav-links">
        <router-link to="/">首页</router-link>
        <router-link to="/publish" v-if="userStore.isLoggedIn">发布</router-link>
        <router-link to="/cart" v-if="userStore.isLoggedIn">购物车</router-link>
        <router-link to="/orders" v-if="userStore.isLoggedIn">订单</router-link>
      </nav>
      <div class="nav-right">
        <template v-if="userStore.isLoggedIn">
          <router-link to="/profile" class="user-name">{{ userStore.userInfo?.nickname }}</router-link>
          <el-button text @click="handleLogout">退出</el-button>
        </template>
        <template v-else>
          <router-link to="/login">
            <el-button type="primary" round>登录</el-button>
          </router-link>
        </template>
      </div>
    </div>
  </header>
</template>

<script setup>
import { useUserStore } from '@/stores/user'
import { useRouter } from 'vue-router'

const userStore = useUserStore()
const router = useRouter()

function handleLogout() {
  userStore.logout()
  router.push('/')
}
</script>

<style scoped>
.navbar {
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}
.nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 20px;
}
.logo {
  font-size: 20px;
  font-weight: 700;
  color: #4caf50;
}
.slogan {
  font-size: 12px;
  color: #999;
  margin-left: 8px;
  letter-spacing: 1px;
}
.nav-links {
  display: flex;
  gap: 24px;
  margin-left: 40px;
}
.nav-links a {
  color: #555;
  font-size: 15px;
  transition: color 0.2s;
}
.nav-links a:hover,
.nav-links a.router-link-active {
  color: #4caf50;
}
.nav-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}
.user-name {
  color: #333;
  font-size: 15px;
}
</style>