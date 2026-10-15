<template>
  <div class="profile-page">
    <h2 class="page-title">个人中心</h2>
    <div class="profile-card">
      <img :src="userStore.userInfo?.avatar || defaultAvatar" class="avatar" />
      <div class="profile-info">
        <h3>{{ userStore.userInfo?.nickname }}</h3>
        <p>邮箱：{{ userStore.userInfo?.email }}</p>
      </div>
    </div>

    <el-tabs v-model="activeTab" @tab-change="loadTabData">
      <el-tab-pane label="我的发布" name="products" />
      <el-tab-pane label="我的收藏" name="favorites" />
      <el-tab-pane label="求购清单" name="wishlist" />
    </el-tabs>

    <div v-loading="loading">
      <div v-if="activeTab === 'products'" class="product-grid">
        <ProductCard v-for="p in tabData" :key="p.id" :product="p" />
      </div>
      <div v-else-if="activeTab === 'favorites'" class="product-grid">
        <ProductCard v-for="p in tabData" :key="p.id" :product="p.product || p" />
      </div>
      <div v-else-if="activeTab === 'wishlist'" class="wishlist-list">
        <div v-for="w in tabData" :key="w.id" class="wishlist-item">
          <span>{{ w.title || w.isbn }}</span>
          <span class="wishlist-author" v-if="w.author">{{ w.author }}</span>
        </div>
      </div>
      <el-empty v-if="!tabData.length" :description="'暂无数据'" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import ProductCard from '@/components/ProductCard.vue'
import { productApi, favoriteApi, wishlistApi } from '@/api'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const activeTab = ref('products')
const tabData = ref([])
const loading = ref(false)
const defaultAvatar = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="40" fill="%23e0e0e0"/><text x="50%" y="50%" fill="%23fff" text-anchor="middle" dy=".3em" font-size="32">U</text></svg>'

async function loadTabData() {
  loading.value = true
  try {
    if (activeTab.value === 'products') {
      const res = await productApi.myProducts()
      tabData.value = res.data || res || []
    } else if (activeTab.value === 'favorites') {
      const res = await favoriteApi.list()
      tabData.value = res.data || res || []
    } else if (activeTab.value === 'wishlist') {
      const res = await wishlistApi.list()
      tabData.value = res.data || res || []
    }
  } finally {
    loading.value = false
  }
}

onMounted(loadTabData)
</script>

<style scoped>
.profile-card {
  display: flex;
  align-items: center;
  gap: 20px;
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 20px;
}
.avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
}
.profile-info h3 {
  font-size: 20px;
  margin-bottom: 4px;
}
.profile-info p {
  color: #999;
}
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}
.wishlist-list {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
}
.wishlist-item {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}
.wishlist-author {
  color: #999;
}
</style>