<template>
  <div class="cart-page">
    <h2 class="page-title">购物车</h2>
    <div v-loading="loading">
      <div v-if="cartItems.length" class="cart-list">
        <div v-for="item in cartItems" :key="item.id" class="cart-item">
          <el-checkbox v-model="item.selected" />
          <img :src="item.product.cover || item.product.images?.[0]" class="cart-img" />
          <div class="cart-info">
            <h4>{{ item.product.title || item.product.bookTitle }}</h4>
            <p class="cart-author" v-if="item.product.bookAuthor">{{ item.product.bookAuthor }}</p>
          </div>
          <span class="cart-price">¥{{ item.product.price }}</span>
          <el-button text type="danger" @click="removeItem(item.product.id)">移除</el-button>
        </div>
        <div class="cart-footer">
          <el-checkbox v-model="selectAll" @change="toggleSelectAll">全选</el-checkbox>
          <span class="total-price">合计：¥{{ totalPrice }}</span>
          <el-button type="primary" :disabled="!selectedItems.length" @click="checkout">下单</el-button>
        </div>
      </div>
      <el-empty v-else description="购物车是空的" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { cartApi, orderApi } from '@/api'

const router = useRouter()
const cartItems = ref([])
const loading = ref(false)

const selectedItems = computed(() => cartItems.value.filter((i) => i.selected))
const totalPrice = computed(() => selectedItems.value.reduce((sum, i) => sum + Number(i.product.price), 0).toFixed(2))
const selectAll = ref(false)

async function loadCart() {
  loading.value = true
  try {
    const res = await cartApi.list()
    cartItems.value = (res.data || res || []).map((i) => ({ ...i, selected: false }))
  } finally {
    loading.value = false
  }
}

function toggleSelectAll(val) {
  cartItems.value.forEach((i) => (i.selected = val))
}

async function removeItem(productId) {
  await cartApi.remove(productId)
  ElMessage.success('已移除')
  loadCart()
}

async function checkout() {
  const ids = selectedItems.value.map((i) => i.id)
  await orderApi.create(ids)
  ElMessage.success('下单成功')
  router.push('/orders')
}

onMounted(loadCart)
</script>

<style scoped>
.cart-list {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
}
.cart-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}
.cart-img {
  width: 60px;
  height: 80px;
  object-fit: cover;
  border-radius: 4px;
}
.cart-info {
  flex: 1;
}
.cart-info h4 {
  font-size: 15px;
  margin-bottom: 4px;
}
.cart-author {
  color: #999;
  font-size: 13px;
}
.cart-price {
  color: #e53935;
  font-weight: 600;
  font-size: 18px;
}
.cart-footer {
  display: flex;
  align-items: center;
  gap: 20px;
  padding-top: 16px;
}
.total-price {
  flex: 1;
  text-align: right;
  font-size: 18px;
  font-weight: 600;
  color: #e53935;
}
</style>