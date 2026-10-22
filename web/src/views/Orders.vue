<template>
  <div class="orders-page">
    <h2 class="page-title">{{ $t('orders.title') }}</h2>
    <el-tabs v-model="activeTab" @tab-change="onTabChange">
      <el-tab-pane :label="$t('orders.tabCart')" name="cart" />
      <el-tab-pane :label="$t('orders.tabPending')" name="pending" />
      <el-tab-pane :label="$t('orders.tabCompleted')" name="completed" />
    </el-tabs>

    <div v-loading="loading">
      <!-- 购物车 -->
      <template v-if="activeTab === 'cart'">
        <div v-if="cartItems.length" class="order-list cart-list">
          <div v-for="item in cartItems" :key="item.id" class="cart-item">
            <el-checkbox v-model="item.selected" />
            <img :src="getCover(item)" class="order-img" @error="imgFallback" />
            <div class="cart-info">
              <h4>{{ item.product.title || item.product.bookTitle }}</h4>
              <p class="cart-seller" v-if="item.product.seller">
                {{ $t('common.seller') }}：{{ item.product.seller.nickname || item.product.seller.userNo }}
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
      </template>

      <!-- 已下单 / 已完成 -->
      <template v-else>
        <div v-if="orders.length" class="order-list">
          <div v-for="order in orders" :key="order.id" class="order-card">
            <div class="order-header">
              <span class="order-id">{{ $t('orders.idPrefix') }}{{ order.id }}</span>
              <span class="order-status" :class="order.status">
                {{ order.status === 'completed' ? $t('orders.statusCompleted') : $t('orders.statusPending') }}
                <em
                  v-if="order.aftersaleStatus && order.aftersaleStatus !== 'none'"
                  class="aftersale-badge"
                  :class="order.aftersaleStatus"
                >{{ aftersaleLabel(order.aftersaleStatus) }}</em>
              </span>
            </div>
            <div class="order-items">
              <div v-for="item in order.items" :key="item.id" class="order-item" v-show="item.product">
                <img :src="getItemCover(item)" class="order-img" @error="imgFallback" />
                <div class="order-item-info">
                  <span>{{ item.product?.title || item.product?.bookTitle }}</span>
                  <span class="order-item-price">¥{{ item.price }}</span>
                </div>
                <el-button
                  v-if="item.product && item.sellerId !== userStore.userInfo?.id"
                  text type="primary" size="small"
                  @click="contactItemSeller(item)"
                >{{ $t('common.contactSeller') }}</el-button>
              </div>
            </div>
            <div class="aftersale-box" v-if="order.aftersale && (order.aftersale.reason || order.aftersale.adminNote)">
              <p v-if="order.aftersale.reason"><b>{{ $t('orders.aftersaleReason') }}：</b>{{ order.aftersale.reason }}</p>
              <p v-if="order.aftersale.adminNote" class="admin-note"><b>{{ $t('orders.aftersaleNote') }}：</b>{{ order.aftersale.adminNote }}</p>
            </div>
            <div class="order-footer">
              <span class="order-total">{{ $t('common.total') }}¥{{ order.totalPrice }}</span>
              <div class="order-actions" v-if="activeTab === 'pending'">
                <el-button size="small" @click="cancelOrder(order)">{{ $t('orders.cancelOrder') }}</el-button>
                <el-button type="primary" size="small" round @click="confirmOrder(order)">{{ $t('orders.confirmReceive') }}</el-button>
              </div>
              <div class="order-actions" v-else>
                <el-button
                  v-if="!order.aftersaleStatus || order.aftersaleStatus === 'none' || order.aftersaleStatus === 'rejected'"
                  size="small" round @click="applyAftersale(order)"
                >{{ order.aftersaleStatus === 'rejected' ? $t('orders.reapplyAftersale') : $t('orders.applyAftersale') }}</el-button>
                <el-button size="small" round type="warning" @click="contactAdmin(order)">{{ $t('orders.contactAdmin') }}</el-button>
              </div>
            </div>
          </div>
        </div>
        <el-empty v-else :description="$t('orders.empty')" />
      </template>
    </div>
  </div>
</template>

<script setup>import { useI18n } from 'vue-i18n'
const { t } = useI18n()

import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus/es/components/message/index'
import { ElMessageBox } from 'element-plus/es/components/message-box/index'
import { cartApi, orderApi, conversationApi } from '@/api'
import { useUserStore } from '@/stores/user'
import { resolveImg, imgFallback } from '@/utils/image'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const activeTab = ref(['cart', 'pending', 'completed'].includes(route.query.tab) ? route.query.tab : 'cart')
const loading = ref(false)
const contactingAll = ref(false)
const orders = ref([])
const cartItems = ref([])

// 过滤掉商品已下架/被删除的脏数据，避免模板里 item.product.xxx 直接报错
const selectedItems = computed(() => cartItems.value.filter((i) => i.selected && i.product))
const totalPrice = computed(() => selectedItems.value.reduce((sum, i) => sum + Number(i.product?.price || 0), 0).toFixed(2))
const selectAll = ref(false)

function getCover(item) {
  const p = item?.product
  if (!p) return ''
  return resolveImg(p.cover || p.bookCover || p.images?.[0]?.imagePath)
}

function getItemCover(item) {
  const p = item?.product
  if (!p) return ''
  return resolveImg(p.cover || p.bookCover || p.images?.[0]?.imagePath)
}

async function loadCart() {
  loading.value = true
  try {
    const res = await cartApi.list()
    const list = res.data ?? res ?? []
    // 后端已过滤孤儿条目，这里再兜一层，保证渲染永远不会拿到 product=null
    cartItems.value = (Array.isArray(list) ? list : [])
      .filter((i) => i && i.product)
      .map((i) => ({ ...i, selected: false }))
  } catch (err) {
    cartItems.value = []
    ElMessage.error(err?.response?.data?.message || t('cart.fetchFail'))
  } finally {
    loading.value = false
  }
}

async function loadOrders() {
  loading.value = true
  try {
    const res = await orderApi.list('buyer', activeTab.value)
    orders.value = res.data || res || []
  } finally {
    loading.value = false
  }
}

function onTabChange() {
  if (activeTab.value === 'cart') loadCart()
  else loadOrders()
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
  activeTab.value = 'pending'
  loadOrders()
}

function goChat(conversationId) {
  router.push(conversationId ? { name: 'Chat', query: { conv: String(conversationId) } } : '/chat')
}

async function contactSeller(item) {
  if (!item.product.seller) return
  try {
    const res = await conversationApi.start(item.product.seller.id, item.product.id)
    ElMessage.success(t('common.convCreated'))
    goChat(res?.data?.conversationId)
  } catch {}
}

async function contactItemSeller(item) {
  try {
    const res = await conversationApi.start(item.sellerId, item.productId)
    ElMessage.success(t('common.convCreated'))
    goChat(res?.data?.conversationId)
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
  let firstConvId = null
  for (const [, info] of sellerMap) {
    try {
      const res = await conversationApi.start(info.sellerId, info.productId)
      if (!firstConvId) firstConvId = res?.data?.conversationId
      success++
    } catch {}
  }
  contactingAll.value = false
  if (success) {
    ElMessage.success(t('cart.contacted', { n: success }))
    goChat(firstConvId)
  } else {
    ElMessage.warning(t('cart.contactFail'))
  }
}

async function confirmOrder(order) {
  try {
    await ElMessageBox.confirm(
      t('orders.confirmMsg', { amount: Number(order.totalPrice).toFixed(2) }),
      t('orders.confirmReceive'),
      { type: 'warning', confirmButtonText: t('orders.confirmReceive'), cancelButtonText: t('common.cancel') }
    )
  } catch { return }
  try {
    await orderApi.confirm(order.id)
    ElMessage.success(t('orders.confirmSuccess'))
    userStore.fetchProfile()
    loadOrders()
  } catch {}
}

async function cancelOrder(order) {
  try {
    await ElMessageBox.confirm(t('orders.cancelConfirm'), t('common.hint'), { type: 'warning' })
  } catch { return }
  try {
    await orderApi.updateStatus(order.id, 'cancelled')
    ElMessage.success(t('orders.cancelSuccess'))
    loadOrders()
  } catch {}
}

function aftersaleLabel(status) {
  const map = {
    pending: 'orders.aftersalePending',
    processing: 'orders.aftersaleProcessing',
    resolved: 'orders.aftersaleResolved',
    rejected: 'orders.aftersaleRejected'
  }
  return map[status] ? t(map[status]) : status
}

async function applyAftersale(order) {
  let reason = ''
  try {
    const { value } = await ElMessageBox.prompt(t('orders.aftersaleReasonTip'), t('orders.applyAftersale'), {
      confirmButtonText: t('orders.submitAftersale'),
      cancelButtonText: t('common.cancel'),
      inputType: 'textarea',
      inputPlaceholder: t('orders.aftersaleReasonPlaceholder')
    })
    reason = String(value || '').trim()
  } catch { return }
  try {
    await orderApi.applyAftersale(order.id, reason)
    ElMessage.success(t('orders.aftersaleApplied'))
    loadOrders()
  } catch {}
}

async function contactAdmin(order) {
  try {
    const res = await orderApi.contactAdmin(order.id)
    ElMessage.success(res?.message || t('orders.adminAssigned'))
    const convId = res?.data?.conversationId
    goChat(convId)
  } catch {}
}

watch(() => route.query.tab, (val) => {
  if (['cart', 'pending', 'completed'].includes(val) && val !== activeTab.value) {
    activeTab.value = val
    onTabChange()
  }
})

onMounted(onTabChange)
</script>

<style scoped>
.cart-list {
  background: var(--card-bg, #fff);
  border-radius: 8px;
  padding: 20px;
}
.cart-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-light, #f0f0f0);
}
.cart-info {
  flex: 1;
  min-width: 0;
}
.cart-info h4 {
  font-size: 15px;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cart-seller {
  color: var(--text-sub, #999);
  font-size: 13px;
}
.cart-price {
  color: var(--accent-danger, #e53935);
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
  color: var(--accent-danger, #e53935);
}
.order-card {
  background: var(--card-bg, #fff);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}
.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.order-id {
  color: var(--text-sub, #999);
  font-size: 13px;
}
.order-status {
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}
.order-status.pending { color: #ff9800; }
.order-status.completed { color: #4caf50; }
.order-status.cancelled { color: #999; }
.aftersale-badge {
  font-style: normal;
  font-size: 11px;
  font-weight: 600;
  color: #ff9800;
  background: rgba(255, 152, 0, 0.12);
  padding: 2px 8px;
  border-radius: 10px;
}
.aftersale-badge.processing {
  color: #1e88e5;
  background: rgba(30, 136, 229, 0.12);
}
.aftersale-badge.resolved {
  color: #43a047;
  background: rgba(67, 160, 71, 0.12);
}
.aftersale-badge.rejected {
  color: #e53935;
  background: rgba(229, 57, 53, 0.12);
}
.aftersale-box {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(26, 144, 160, 0.06);
  border: 1px dashed rgba(26, 144, 160, 0.25);
  font-size: 12.5px;
  color: #5d7b87;
  line-height: 1.6;
}
.aftersale-box p {
  margin: 0;
}
.aftersale-box .admin-note {
  margin-top: 4px;
  color: #10667a;
}
.order-items {
  display: flex;
  flex-direction: column;
}
.order-item {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  align-items: center;
}
.order-img {
  width: 50px;
  height: 66px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}
.order-item-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}
.order-item-info > span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.order-item-price {
  color: var(--accent-danger, #e53935);
  font-size: 14px;
}
.order-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-light, #f0f0f0);
}
.order-total {
  font-weight: 600;
  color: var(--accent-danger, #e53935);
}
.order-actions {
  display: flex;
  gap: 8px;
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
  .order-card {
    padding: 14px;
    border-radius: 12px;
  }
  .order-header {
    flex-wrap: wrap;
    gap: 6px;
    font-size: 13px;
  }
  .order-item {
    gap: 10px;
    flex-wrap: wrap;
  }
  .order-img {
    width: 44px;
    height: 60px;
  }
  .order-footer {
    flex-wrap: wrap;
    gap: 10px;
  }
  .order-total {
    font-size: 15px;
  }
}
</style>
