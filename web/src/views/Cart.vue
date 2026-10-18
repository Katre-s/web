<template>
  <div class="cart-page">
    <h2 class="page-title">{{ $t('cart.title') }}</h2>
    <div v-loading="loading">
      <div v-if="cartItems.length" class="cart-list">
        <div v-for="item in cartItems" :key="item.id" class="cart-item">
          <el-checkbox v-model="item.selected" />
          <img :src="getCover(item)" class="cart-img" />
          <div class="cart-info">
            <h4>{{ item.product.title || item.product.bookTitle }}</h4>
            <p class="cart-author" v-if="item.product.bookAuthor">{{ item.product.bookAuthor }}</p>
            <p class="cart-seller" v-if="item.product.seller">
              {{ $t('common.seller') }}：{{ item.product.seller.nickname || item.product.seller.userNo }}
              <span class="seller-no" v-if="item.product.seller.userNo">（ID: {{ item.product.seller.userNo }}）</span>
            </p>
          </div>
          <span class="cart-price">¥{{ item.product.price }}</span>
          <div class="cart-item-actions">
            <el-button size="small" round @click="contactSeller(item)" v-if="item.product.seller && item.product.seller.id !== userStore.userInfo?.id">{{ $t('common.contactSeller') }}</el-button>
            <el-button text type="danger" @click="removeItem(item.product.id)">{{ $t('cart.remove') }}</el-button>
          </div>
        </div>
        <div class="cart-footer">
          <el-checkbox v-model="selectAll" @change="toggleSelectAll">{{ $t('cart.selectAll') }}</el-checkbox>
          <el-button type="warning" round @click="contactAllSellers" :disabled="!cartItems.length" :loading="contactingAll">{{ $t('cart.contactAll') }}</el-button>
          <span class="total-price">{{ $t('common.total') }}¥{{ totalPrice }}</span>
          <el-button type="primary" :disabled="!selectedItems.length" @click="checkout">{{ $t('cart.checkout') }}</el-button>
        </div>
      </div>
      <el-empty v-else :description="$t('cart.empty')" />
    </div>
  </div>
</template>

<script setup>import { useI18n } from 'vue-i18n'
const { t } = useI18n()

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { cartApi, orderApi, conversationApi } from '@/api'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
const cartItems = ref([])
const loading = ref(false)
const contactingAll = ref(false)

const selectedItems = computed(() => cartItems.value.filter((i) => i.selected))
const totalPrice = computed(() => selectedItems.value.reduce((sum, i) => sum + Number(i.product.price), 0).toFixed(2))
const selectAll = ref(false)

function getCover(item) {
  return item.product.cover || item.product.bookCover || item.product.images?.[0]?.imagePath || ''
}

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
  ElMessage.success(t('cart.removed'))
  loadCart()
}

async function checkout() {
  const ids = selectedItems.value.map((i) => i.id)
  await orderApi.create(ids)
  ElMessage.success(t('cart.checkedOut'))
  router.push('/orders')
}

async function contactSeller(item) {
  if (!item.product.seller) return
  try {
    await conversationApi.start(item.product.seller.id, item.product.id)
    ElMessage.success(t('common.convCreated'))
    router.push('/chat')
  } catch {}
}

async function contactAllSellers() {
  const sellerMap = new Map()
  for (const item of cartItems.value) {
    const s = item.product?.seller
    if (!s || s.id === userStore.userInfo?.id) continue
    if (!sellerMap.has(s.id)) {
      sellerMap.set(s.id, { sellerId: s.id, productId: item.product.id, nickname: s.nickname || s.userNo })
    }
  }
  if (!sellerMap.size) {
    ElMessage.warning(t('cart.noContactable'))
    return
  }
  contactingAll.value = true
  let success = 0
  for (const [, info] of sellerMap) {
    try {
      await conversationApi.start(info.sellerId, info.productId)
      success++
    } catch {}
  }
  contactingAll.value = false
  if (success) {
    ElMessage.success(t('cart.contacted', { n: success }))
    router.push('/chat')
  } else {
    ElMessage.warning(t('cart.contactFail'))
  }
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
.cart-seller {
  color: #666;
  font-size: 13px;
  margin-top: 4px;
}
.seller-no {
  color: #999;
  font-size: 12px;
}
.cart-price {
  color: #e53935;
  font-weight: 600;
  font-size: 18px;
}
.cart-item-actions {
  display: flex;
  gap: 8px;
  align-items: center;
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

@media (max-width: 768px) {
  .cart-list {
    padding: 14px;
    border-radius: 12px;
  }
  .cart-item {
    gap: 10px;
    padding: 12px 0;
  }
  .cart-img {
    width: 52px;
    height: 70px;
  }
  .cart-info h4 {
    font-size: 14px;
  }
  .cart-price {
    font-size: 16px;
  }
  .cart-item-actions {
    flex-direction: column;
    gap: 4px;
    align-items: stretch;
  }
  .cart-item-actions .el-button + .el-button {
    margin-left: 0;
  }
  .cart-footer {
    flex-wrap: wrap;
    gap: 10px;
    padding-top: 14px;
  }
  .total-price {
    flex: none;
    width: 100%;
    text-align: right;
    font-size: 17px;
  }
}
</style>