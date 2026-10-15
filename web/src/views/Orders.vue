<template>
  <div class="orders-page">
    <h2 class="page-title">我的订单</h2>
    <el-tabs v-model="role" @tab-change="loadOrders">
      <el-tab-pane label="我买的" name="buyer" />
      <el-tab-pane label="我卖的" name="seller" />
    </el-tabs>
    <div v-loading="loading">
      <div v-if="orders.length" class="order-list">
        <div v-for="order in orders" :key="order.id" class="order-card">
          <div class="order-header">
            <span class="order-id">订单号：{{ order.id }}</span>
            <span class="order-status" :class="order.status">{{ statusMap[order.status] }}</span>
          </div>
          <div class="order-items">
            <div v-for="item in order.items" :key="item.id" class="order-item">
              <img :src="item.product.cover || item.product.images?.[0]" class="order-img" />
              <div class="order-item-info">
                <span>{{ item.product.title || item.product.bookTitle }}</span>
                <span class="order-item-price">¥{{ item.price }}</span>
              </div>
            </div>
          </div>
          <div class="order-footer">
            <span class="order-total">合计：¥{{ order.totalPrice }}</span>
            <div class="order-actions" v-if="role === 'seller' && order.status === 'pending'">
              <el-button type="primary" size="small" @click="updateStatus(order.id, 'confirmed')">确认</el-button>
              <el-button size="small" @click="updateStatus(order.id, 'cancelled')">取消</el-button>
            </div>
            <div class="order-actions" v-if="role === 'buyer' && order.status === 'confirmed'">
              <el-button type="primary" size="small" @click="updateStatus(order.id, 'completed')">确认收货</el-button>
            </div>
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无订单" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { orderApi } from '@/api'

const role = ref('buyer')
const orders = ref([])
const loading = ref(false)
const statusMap = { pending: '待确认', confirmed: '已确认', completed: '已完成', cancelled: '已取消' }

async function loadOrders() {
  loading.value = true
  try {
    const res = await orderApi.list(role.value)
    orders.value = res.data || res || []
  } finally {
    loading.value = false
  }
}

async function updateStatus(id, status) {
  await orderApi.updateStatus(id, status)
  ElMessage.success('操作成功')
  loadOrders()
}

onMounted(loadOrders)
</script>

<style scoped>
.order-card {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}
.order-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}
.order-id {
  color: #999;
  font-size: 13px;
}
.order-status {
  font-size: 14px;
  font-weight: 600;
}
.order-status.pending { color: #ff9800; }
.order-status.confirmed { color: #2196f3; }
.order-status.completed { color: #4caf50; }
.order-status.cancelled { color: #999; }
.order-item {
  display: flex;
  gap: 12px;
  padding: 8px 0;
}
.order-img {
  width: 50px;
  height: 66px;
  object-fit: cover;
  border-radius: 4px;
}
.order-item-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}
.order-item-price {
  color: #e53935;
  font-size: 14px;
}
.order-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}
.order-total {
  font-weight: 600;
  color: #e53935;
}
.order-actions {
  display: flex;
  gap: 8px;
}
</style>