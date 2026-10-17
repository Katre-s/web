<template>
  <div class="book-detail-page" v-loading="loading">
    <template v-if="book">
      <div class="book-hero">
        <img v-if="book.bookCover" :src="book.bookCover" class="hero-bg" @error="book.bookCover = ''" />
        <div class="hero-overlay"></div>
        <div class="hero-content">
          <img v-if="book.bookCover" :src="book.bookCover" class="hero-cover" @error="book.bookCover = ''" />
          <div v-else class="hero-cover placeholder">
            <el-icon><Notebook /></el-icon>
          </div>
          <div class="hero-info">
            <h1 class="hero-title">{{ book.bookTitle }}</h1>
            <div class="hero-meta">
              <span v-if="book.bookAuthor">作者：{{ book.bookAuthor }}</span>
              <span v-if="book.edition">版本：{{ book.edition }}</span>
              <span v-if="book.bookPublisher">出版社：{{ book.bookPublisher }}</span>
              <span v-if="book.isbn">ISBN：{{ book.isbn }}</span>
            </div>
            <div class="hero-original" v-if="book.originalPrice">
              定价 ¥{{ book.originalPrice }}
            </div>
            <div class="hero-actions">
              <el-button :type="favorited ? 'warning' : 'default'" round size="small" @click="toggleFavorite">
                {{ favorited ? '★ 已收藏' : '☆ 收藏板块' }}
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <div class="sellers-section">
        <div class="sellers-header">
          <h2 class="sellers-title">在售 ({{ sellers.length }} 个卖家)</h2>
          <div class="sort-tabs">
            <button class="sort-tab" :class="{ active: sortType === 'price' }" @click="toggleSort('price')">
              价格 {{ sortType === 'price' ? (sortAsc ? '↑' : '↓') : '' }}
            </button>
            <button class="sort-tab" :class="{ active: sortType === 'time' }" @click="toggleSort('time')">
              上架时间 {{ sortType === 'time' ? (sortAsc ? '↑' : '↓') : '' }}
            </button>
            <button class="sort-tab" :class="{ active: sortType === 'delivery' }" @click="sortByDelivery">
              可配送
            </button>
          </div>
        </div>

        <div class="seller-list" v-if="sortedSellers.length">
          <div v-for="seller in sortedSellers" :key="seller.id" class="seller-row clickable" @click="goProduct(seller.id)">
            <div class="seller-main">
              <div class="seller-price">¥{{ seller.price }}</div>
              <div class="seller-tags">
                <span class="tag condition">{{ seller.condition }}</span>
                <span class="tag" :class="seller.delivery ? 'delivery-yes' : 'delivery-no'">
                  {{ seller.delivery ? '可配送' : '仅自提' }}
                </span>
              </div>
            </div>
            <div class="seller-sub">
              <div class="seller-campus" v-if="seller.campus">
                <el-icon><Location /></el-icon>
                <span>{{ seller.campus }}</span>
              </div>
              <div class="seller-time">{{ formatTime(seller.createdAt) }}</div>
            </div>
            <div class="seller-actions">
              <el-button type="success" size="small" round @click.stop="addToCart(seller)">加入购物车</el-button>
              <el-button v-if="seller.sellerId !== userStore.userInfo?.id" type="primary" size="small" round @click.stop="contactSeller(seller)">联系卖家</el-button>
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无卖家" />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Notebook, Location } from '@element-plus/icons-vue'
import { booksApi, conversationApi, cartApi, bookFavoriteApi } from '@/api'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const book = ref(null)
const sellers = ref([])
const loading = ref(false)
const sortType = ref('time')
const sortAsc = ref(false)
const favorited = ref(false)

const sortedSellers = computed(() => {
  const list = [...sellers.value]
  if (sortType.value === 'price') {
    list.sort((a, b) => sortAsc.value ? a.price - b.price : b.price - a.price)
  } else if (sortType.value === 'time') {
    list.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime()
      const tb = new Date(b.createdAt).getTime()
      return sortAsc.value ? ta - tb : tb - ta
    })
  } else if (sortType.value === 'delivery') {
    list.sort((a, b) => Number(b.delivery) - Number(a.delivery))
  }
  return list
})

async function loadDetail() {
  loading.value = true
  try {
    const res = await booksApi.detail(route.params.key)
    const data = res.data || res
    book.value = data.book
    sellers.value = data.sellers || []
    if (book.value?.id) {
      try {
        const favRes = await bookFavoriteApi.check(book.value.id)
        favorited.value = favRes.data.favorited
      } catch {}
    }
  } finally {
    loading.value = false
  }
}

async function toggleFavorite() {
  if (!book.value?.id) return
  try {
    const res = await bookFavoriteApi.toggle(book.value.id)
    favorited.value = res.data.favorited
    ElMessage.success(res.message)
  } catch {}
}

async function addToCart(seller) {
  try {
    await cartApi.add(seller.id)
    ElMessage.success('已加入购物车')
  } catch {}
}

function toggleSort(type) {
  if (sortType.value === type) {
    sortAsc.value = !sortAsc.value
  } else {
    sortType.value = type
    sortAsc.value = type === 'time' ? false : true
  }
}

function sortByDelivery() {
  sortType.value = 'delivery'
}

function goProduct(id) {
  router.push(`/product/${id}`)
}

function formatTime(time) {
  if (!time) return ''
  const d = new Date(time)
  const now = new Date()
  const diff = now - d
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

async function contactSeller(seller) {
  if (!userStore.isLoggedIn) {
    router.push({ name: 'Login', query: { redirect: route.fullPath } })
    return
  }
  try {
    const res = await conversationApi.start(seller.sellerId, seller.id)
    ElMessage.success('已创建对话，请前往「对话」查看')
    router.push('/chat')
  } catch {
    ElMessage.error('创建对话失败')
  }
}


onMounted(loadDetail)
</script>

<style scoped>
.book-hero {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 28px;
  min-height: 260px;
  background: linear-gradient(135deg, #0d2847, #1e88e5);
}
.hero-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(24px);
  transform: scale(1.2);
  opacity: 0.5;
}
.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(10, 25, 47, 0.85) 0%, rgba(10, 25, 47, 0.4) 100%);
}
.hero-content {
  position: relative;
  display: flex;
  gap: 28px;
  padding: 32px;
  align-items: center;
}
.hero-cover {
  width: 150px;
  height: 200px;
  border-radius: 10px;
  object-fit: cover;
  flex-shrink: 0;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
}
.hero-cover.placeholder {
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 56px;
  color: rgba(255, 255, 255, 0.5);
}
.hero-info { color: #fff; }
.hero-title {
  font-size: 30px;
  font-weight: 700;
  margin-bottom: 16px;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
}
.hero-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
}
.hero-original {
  margin-top: 16px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  text-decoration: line-through;
}
.hero-actions {
  margin-top: 18px;
}
.sellers-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
  flex-wrap: wrap;
  gap: 12px;
}
.sellers-title { font-size: 20px; font-weight: 700; color: #0d2847; }
.sort-tabs { display: flex; gap: 8px; }
.sort-tab {
  padding: 6px 14px;
  border-radius: 16px;
  border: 1px solid #e0e6ed;
  background: #fff;
  color: #607d8b;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.sort-tab:hover { border-color: #42a5f5; color: #42a5f5; }
.sort-tab.active { background: #42a5f5; border-color: #42a5f5; color: #fff; }
.seller-list { display: flex; flex-direction: column; gap: 12px; }
.seller-row {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 12px;
  padding: 16px 20px;
  gap: 20px;
  box-shadow: 0 2px 10px rgba(13, 40, 71, 0.05);
  transition: all 0.25s;
}
.seller-row:hover { box-shadow: 0 6px 20px rgba(66, 165, 245, 0.12); transform: translateY(-2px); }
.seller-row.clickable { cursor: pointer; }
.seller-main { min-width: 140px; }
.seller-price { font-size: 22px; font-weight: 700; color: #e53935; margin-bottom: 6px; }
.seller-tags { display: flex; gap: 6px; }
.tag { font-size: 12px; padding: 2px 10px; border-radius: 10px; }
.tag.condition { background: #f0f4f8; color: #607d8b; }
.tag.delivery-yes { background: rgba(76, 175, 80, 0.12); color: #43a047; }
.tag.delivery-no { background: rgba(158, 158, 158, 0.15); color: #9e9e9e; }
.seller-sub { flex: 1; }
.seller-campus { display: flex; align-items: center; gap: 4px; font-size: 14px; color: #37474f; margin-bottom: 4px; }
.seller-time { font-size: 12px; color: #90a4ae; }
.seller-actions { flex-shrink: 0; display: flex; gap: 8px; }

@media (max-width: 768px) {
  .book-hero {
    border-radius: 12px;
    margin-bottom: 18px;
    min-height: 0;
  }
  .hero-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    padding: 18px;
  }
  .hero-cover {
    width: 110px;
    height: 150px;
    border-radius: 8px;
  }
  .hero-title {
    font-size: 20px;
    margin-bottom: 10px;
  }
  .hero-meta {
    font-size: 13px;
    gap: 6px;
  }
  .hero-overlay {
    background: linear-gradient(180deg, rgba(10, 25, 47, 0.85) 0%, rgba(10, 25, 47, 0.55) 100%);
  }
  .sellers-header {
    margin-bottom: 12px;
  }
  .sellers-title {
    font-size: 17px;
  }
  .sort-tab {
    padding: 5px 10px;
    font-size: 12px;
  }
  .seller-row {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 14px 16px;
  }
  .seller-main {
    min-width: 0;
  }
  .seller-price {
    font-size: 20px;
    margin-bottom: 4px;
  }
  .seller-actions {
    justify-content: flex-end;
  }
  .seller-actions .el-button + .el-button {
    margin-left: 0;
  }
}
</style>