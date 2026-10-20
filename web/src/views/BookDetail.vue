<template>
  <div class="book-detail-page" v-loading="loading">
    <template v-if="book">
      <div class="book-hero">
        <img v-if="coverUrl" :src="coverUrl" class="hero-bg" @error="book.bookCover = ''" />
        <div class="hero-overlay"></div>
        <div class="hero-content">
          <img v-if="coverUrl" :src="coverUrl" class="hero-cover" @error="book.bookCover = ''" />
          <div v-else class="hero-cover placeholder">
            <el-icon><Notebook /></el-icon>
          </div>
          <div class="hero-info">
            <h1 class="hero-title">{{ book.bookTitle }}</h1>
            <div class="hero-meta">
              <span v-if="book.bookAuthor">{{ $t('bookdetail.authorPrefix') }}{{ book.bookAuthor }}</span>
              <span v-if="book.edition">{{ $t('bookdetail.editionPrefix') }}{{ book.edition }}</span>
              <span v-if="book.bookPublisher">{{ $t('bookdetail.publisherPrefix') }}{{ book.bookPublisher }}</span>
              <span v-if="book.isbn">ISBN：{{ book.isbn }}</span>
            </div>
            <div class="hero-original" v-if="book.originalPrice">
              {{ $t('bookdetail.pricePrefix') }}{{ book.originalPrice }}
            </div>
            <div class="hero-actions">
              <el-button :type="favorited ? 'warning' : 'default'" round size="small" @click="toggleFavorite">
                {{ favorited ? '★ ' + $t('common.favorited') : '☆ ' + $t('common.favBoard') }}
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <div class="sellers-section">
        <div class="sellers-header">
          <h2 class="sellers-title">{{ $t('bookdetail.sellersPrefix') }}{{ sellers.length }}{{ $t('bookdetail.sellersSuffix') }}</h2>
          <div class="sort-tabs">
            <button class="sort-tab" :class="{ active: sortType === 'price' }" @click="toggleSort('price')">
              {{ $t('bookdetail.sortPrice') }} {{ sortType === 'price' ? (sortAsc ? '↑' : '↓') : '' }}
            </button>
            <button class="sort-tab" :class="{ active: sortType === 'time' }" @click="toggleSort('time')">
              {{ $t('bookdetail.sortTime') }} {{ sortType === 'time' ? (sortAsc ? '↑' : '↓') : '' }}
            </button>
            <button class="sort-tab" :class="{ active: sortType === 'delivery' }" @click="sortByDelivery">{{ $t('common.deliverable') }}</button>
          </div>
        </div>

        <div class="seller-list" v-if="sortedSellers.length">
          <div v-for="seller in sortedSellers" :key="seller.id" class="seller-row clickable" @click="goProduct(seller.id)">
            <div class="seller-main">
              <div class="seller-price">¥{{ seller.price }}</div>
              <div class="seller-tags">
                <span class="tag condition">{{ seller.condition }}</span>
                <span class="tag" :class="seller.delivery ? 'delivery-yes' : 'delivery-no'">
                  {{ seller.delivery ? t('common.deliverable') : t('common.pickupOnly') }}
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
              <el-button type="success" size="small" round @click.stop="addToCart(seller)">{{ $t('common.addCart') }}</el-button>
              <el-button v-if="seller.sellerId !== userStore.userInfo?.id" type="primary" size="small" round @click.stop="contactSeller(seller)">{{ $t('common.contactSeller') }}</el-button>
            </div>
          </div>
        </div>
        <el-empty v-else :description="$t('common.noSellers')" />
      </div>
    </template>
  </div>
</template>

<script setup>import { useI18n } from 'vue-i18n'
const { t } = useI18n()

import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus/es/components/message/index'
import { Notebook, Location } from '@element-plus/icons-vue'
import { booksApi, conversationApi, cartApi, bookFavoriteApi } from '@/api'
import { useUserStore } from '@/stores/user'
import { resolveImg } from '@/utils/image'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const book = ref(null)
const sellers = ref([])
const loading = ref(false)
const sortType = ref('time')
const sortAsc = ref(false)
const favorited = ref(false)

// 封面统一走 resolveImg：手机壳内需要绝对地址，Web 端走同源相对路径
const coverUrl = computed(() => resolveImg(book.value?.bookCover))

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
    ElMessage.success(t('common.addedCart'))
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
  if (diff < 3600000) return `${Math.floor(diff / 60000)}${t('common.minutesAgo')}`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}${t('common.hoursAgo')}`
  return t('common.monthDay', { m: d.getMonth() + 1, d: d.getDate() })
}

async function contactSeller(seller) {
  if (!userStore.isLoggedIn) {
    router.push({ name: 'Login', query: { redirect: route.fullPath } })
    return
  }
  if (!seller?.sellerId) {
    ElMessage.warning(t('common.convCreateFail'))
    return
  }
  try {
    const res = await conversationApi.start(seller.sellerId, seller.id)
    const convId = res?.data?.conversationId
    ElMessage.success(t('common.convCreated'))
    router.push(convId ? { name: 'Chat', query: { conv: String(convId) } } : '/chat')
  } catch {
    ElMessage.error(t('common.convCreateFail'))
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
  /* 移动端 GPU 较弱，blur(24px) 大图背景会明显掉帧，直接隐藏只保留渐变 */
  .hero-bg {
    display: none;
  }
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