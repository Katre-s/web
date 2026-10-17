<template>
  <div class="detail-page" v-loading="loading">
    <div class="detail-content" v-if="product">
      <div class="detail-left">
        <img :src="coverImg" class="cover-img" />
      </div>
      <div class="detail-right">
        <h1 class="detail-title">{{ product.title || product.bookTitle }}</h1>
        <p class="detail-author" v-if="product.bookAuthor">作者：{{ product.bookAuthor }}</p>
        <p class="detail-publisher" v-if="product.bookPublisher">出版社：{{ product.bookPublisher }}</p>
        <p class="detail-isbn" v-if="product.isbn">ISBN：{{ product.isbn }}</p>
        <div class="detail-price">¥{{ product.price }}</div>
        <div class="detail-meta">
          <span class="meta-tag">{{ product.condition }}</span>
          <span class="meta-tag" v-if="product.category">{{ product.category }}</span>
        </div>
        <div class="detail-desc" v-if="product.description">
          <h3>描述</h3>
          <p>{{ product.description }}</p>
        </div>
        <div class="detail-actions">
          <el-button type="primary" @click="addToCart" :disabled="product.status === 'sold'">
            {{ product.status === 'sold' ? '已售出' : '加入购物车' }}
          </el-button>
          <el-button @click="contactSeller">联系卖家</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { productApi, cartApi, messageApi } from '@/api'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const product = ref(null)
const loading = ref(false)

// 后端返回的封面字段是 bookCover，images 数组元素是 { imagePath } 对象，需兼容取图
const coverImg = computed(() => {
  const p = product.value
  if (!p) return ''
  const first = p.images?.[0]
  const firstPath = typeof first === 'string' ? first : first?.imagePath
  return p.cover || p.bookCover || firstPath || ''
})

async function loadProduct() {
  loading.value = true
  try {
    const res = await productApi.detail(route.params.id)
    product.value = res.data || res
  } finally {
    loading.value = false
  }
}

async function addToCart() {
  if (!userStore.isLoggedIn) {
    router.push({ name: 'Login', query: { redirect: route.fullPath } })
    return
  }
  await cartApi.add(product.value.id)
  ElMessage.success('已加入购物车')
}

async function contactSeller() {
  if (!userStore.isLoggedIn) {
    router.push({ name: 'Login', query: { redirect: route.fullPath } })
    return
  }
  await messageApi.send(product.value.id, product.value.userId, '我对这本书感兴趣，请问还在吗？')
  ElMessage.success('已发送消息给卖家')
}

onMounted(loadProduct)
</script>

<style scoped>
.detail-content {
  display: flex;
  gap: 40px;
  background: #fff;
  border-radius: 8px;
  padding: 30px;
}
.detail-left {
  flex-shrink: 0;
}
.cover-img {
  width: 240px;
  height: 320px;
  object-fit: cover;
  border-radius: 8px;
}
.detail-right {
  flex: 1;
}
.detail-title {
  font-size: 24px;
  margin-bottom: 12px;
}
.detail-author,
.detail-publisher,
.detail-isbn {
  color: #666;
  margin-bottom: 6px;
}
.detail-price {
  font-size: 32px;
  color: #e53935;
  font-weight: 700;
  margin: 16px 0;
}
.detail-meta {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}
.meta-tag {
  background: #f5f5f5;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 13px;
  color: #666;
}
.detail-desc {
  margin-bottom: 24px;
}
.detail-desc h3 {
  font-size: 16px;
  margin-bottom: 8px;
}
.detail-desc p {
  color: #555;
  line-height: 1.6;
}
.detail-actions {
  display: flex;
  gap: 12px;
}

@media (max-width: 768px) {
  .detail-content {
    flex-direction: column;
    gap: 20px;
    padding: 18px;
    border-radius: 12px;
  }
  .detail-left {
    align-self: center;
  }
  .cover-img {
    width: 170px;
    height: 227px;
  }
  .detail-title {
    font-size: 20px;
  }
  .detail-actions {
    flex-wrap: wrap;
  }
}
</style>