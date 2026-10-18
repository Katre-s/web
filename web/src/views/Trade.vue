<template>
  <div class="trade-page">
    <div class="trade-tabs">
      <div class="trade-tab" :class="{ active: tab === 'sell' }" @click="switchTab('sell')">
        <el-icon><UploadFilled /></el-icon>
        <span>{{ $t('trade.tabSell') }}</span>
      </div>
      <div class="trade-tab" :class="{ active: tab === 'buy' }" @click="switchTab('buy')">
        <el-icon><ShoppingCart /></el-icon>
        <span>{{ $t('trade.tabBuy') }}</span>
      </div>
    </div>
    <div class="search-row">
      <el-input
        v-model="keyword"
        :placeholder="tab === 'sell' ? $t('trade.searchPlaceholder') : $t('trade.searchWishPlaceholder')"
        clearable
        size="large"
        class="search-input"
        @keyup.enter="tab === 'sell' ? loadBooks() : loadWishlist()"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-popover placement="bottom-end" :width="160" trigger="click">
        <template #reference>
          <button class="add-btn" :title="$t('trade.uploadBook')">
            <el-icon><Plus /></el-icon>
          </button>
        </template>
        <div class="add-menu" @click="goPublish">
          <el-icon><UploadFilled /></el-icon>
          <span>{{ $t('trade.uploadBook') }}</span>
        </div>
        <div class="add-menu" @click="goBookList">
          <el-icon><Document /></el-icon>
          <span>{{ $t('booklist.title') }}</span>
        </div>
      </el-popover>
      <button class="scan-btn" :title="$t('trade.scanBook')" :disabled="scanning" @click="openScan">
        <el-icon v-if="!scanning"><Camera /></el-icon>
        <el-icon v-else class="scan-spin"><Loading /></el-icon>
      </button>
      <input ref="scanInput" type="file" accept="image/*" style="display: none" @change="onScanFile" />
    </div>

    <!-- ISBN 筛选: 拍照识别后罗列市场同书 -->
    <div class="filter-bar" v-if="isbnFilter">
      <span class="filter-chip">
        <el-icon style="margin-right: 4px"><Filter /></el-icon>
        {{ $t('trade.filterIsbn') }} <b>{{ isbnFilter }}</b>
        <el-icon class="chip-clear" @click="clearIsbnFilter"><Close /></el-icon>
      </span>
      <span class="filter-hint">{{ $t('trade.filterHint') }}</span>
    </div>

    <!-- 两步识别: 第一步/第二步拍摄引导 -->
    <el-dialog v-model="scanGuideVisible" :title="$t('common.scanGuideTitle')" width="400px" :close-on-click-modal="false">
      <div class="scan-guide">
        <div class="guide-step">{{ scanPhase === 'front' ? $t('common.scanStepFront') : $t('common.scanStepBack') }}</div>
        <div v-if="frontInfo?.cover" class="guide-front">
          <img :src="frontInfo.cover" class="guide-cover" @error="frontInfo.cover = ''" />
          <p class="guide-ok">{{ $t('common.scanFrontOk') }}</p>
        </div>
        <p class="guide-tip" v-if="scanPhase === 'back'">{{ $t('common.scanBackTip') }}</p>
      </div>
      <template #footer>
        <el-button @click="cancelScan">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="scanning" @click="scanInput?.click()">
          {{ scanPhase === 'front' ? $t('common.scanChooseFront') : $t('common.scanChooseBack') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 核对书籍信息(正面+背面两次识别合并后) -->
    <el-dialog v-model="confirmVisible" :title="$t('common.confirmTitle')" width="460px" :close-on-click-modal="false">
      <div class="scan-preview" v-if="scanBook">
        <img v-if="scanBook.cover" :src="scanBook.cover" class="scan-cover" @error="scanBook.cover = ''" />
        <div class="scan-text scan-edit">
          <p><span class="lbl">{{ $t('common.bookName') }}</span><el-input v-model="scanBook.title" size="small" /></p>
          <p><span class="lbl">{{ $t('common.authorPrefix') }}</span><el-input v-model="scanBook.author" size="small" /></p>
          <p><span class="lbl">{{ $t('common.publisher') }}</span><el-input v-model="scanBook.publisher" size="small" /></p>
          <p><span class="lbl">{{ $t('common.edition') }}</span><el-input v-model="scanBook.edition" size="small" /></p>
          <p><span class="lbl">ISBN</span><el-input v-model="scanBook.isbn" size="small" /></p>
        </div>
      </div>
      <div class="market-match" v-if="marketMatches.sellingCount > 0 || marketMatches.wishCount > 0">
        <p v-if="marketMatches.sellingCount > 0">📦 {{ $t('common.marketHas') }} <b>{{ marketMatches.sellingCount }}</b>{{ $t('trade.sellers') }}
          <el-button size="small" link type="primary" @click="goMarketFilter">{{ $t('common.seeMarket') }} →</el-button>
        </p>
        <p v-if="marketMatches.wishCount > 0">🔍 {{ $t('common.marketWish') }} <b>{{ marketMatches.wishCount }}</b>{{ $t('trade.wishes') }}</p>
      </div>
      <p class="confirm-tip">{{ $t('common.confirmTip') }}</p>
      <template #footer>
        <el-button @click="cancelScan">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="confirmScan">{{ $t('common.confirm') }}</el-button>
      </template>
    </el-dialog>

    <!-- 扫码识别结果：询问是否加入求购 -->
    <el-dialog v-model="scanDialogVisible" :title="$t('trade.scanResultTitle')" width="420px" :close-on-click-modal="false">
      <div class="scan-preview" v-if="scanBook">
        <img v-if="scanBook.cover" :src="scanBook.cover" class="scan-cover" @error="scanBook.cover = ''" />
        <div class="scan-text">
          <h3>{{ scanBook.title }}</h3>
          <p v-if="scanBook.author">{{ $t('common.authorPrefix') }}{{ scanBook.author }}</p>
          <p v-if="scanBook.isbn">ISBN {{ scanBook.isbn }}</p>
        </div>
      </div>
      <p class="scan-ask">{{ $t('trade.scanAsk') }}</p>
      <template #footer>
        <el-button @click="scanDialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="wishlistAdding" @click="agreeWishlist">{{ $t('trade.scanAgree') }}</el-button>
      </template>
    </el-dialog>

    <div v-loading="loading">
      <!-- 在售(卖)：卖家想卖的东西 -->
      <div class="book-grid" v-if="tab === 'sell' && books.length">
        <div
          v-for="book in books"
          :key="book.id || book.isbn || book.bookTitle"
          class="book-card"
          @click="goDetail(book)"
        >
          <div class="book-cover-wrap">
            <img v-if="book.bookCover" :src="book.bookCover" class="book-cover" @error="book.bookCover = ''" />
            <div v-else class="book-cover-placeholder">
              <el-icon><Notebook /></el-icon>
            </div>
          </div>
          <div class="book-info">
            <h3 class="book-title">{{ book.bookTitle }}</h3>
            <p class="book-edition" v-if="book.edition">{{ book.edition }}</p>
            <p class="book-author">{{ book.bookAuthor || t('common.unknownAuthor') }}</p>
            <div class="book-bottom">
              <span class="book-price">¥{{ book.minPrice }}</span>
              <span class="book-count">{{ book.sellerCount }}{{ $t('trade.sellers') }}</span>
            </div>
          </div>
        </div>
      </div>
      <el-empty v-else-if="tab === 'sell' && !loading" :description="$t('trade.empty')" />

      <!-- 求购(买)：买家想求购的东西 -->
      <div class="wish-grid" v-if="tab === 'buy' && wishes.length">
        <div v-for="w in wishes" :key="w.id" class="wish-card" @click="goWish(w)">
          <div class="wish-cover-wrap">
            <img v-if="w.book?.bookCover" :src="w.book.bookCover" class="wish-cover" @error="w.book.bookCover = ''" />
            <div v-else class="wish-cover-placeholder">
              <el-icon><Notebook /></el-icon>
            </div>
          </div>
          <div class="wish-info">
            <h3 class="wish-title">{{ w.book?.bookTitle || w.title || t('common.unknownBook') }}</h3>
            <p class="wish-meta" v-if="w.book?.bookAuthor || w.author">{{ $t('common.authorPrefix') }}{{ w.book?.bookAuthor || w.author }}</p>
            <p class="wish-meta" v-if="w.isbn">ISBN {{ w.isbn }}</p>
            <div class="wish-bottom">
              <span class="wish-user">{{ $t('trade.wishBy') }} {{ w.user?.nickname || '—' }}<span v-if="w.user?.userNo">（{{ w.user.userNo }}）</span></span>
              <span class="wish-time">{{ formatTime(w.createdAt) }}</span>
            </div>
            <div class="wish-actions">
              <span v-if="w.sellerCount" class="wish-sellers">{{ w.sellerCount }}{{ $t('trade.sellers') }}</span>
              <el-button size="small" type="primary" round @click.stop="contactWisher(w)">
                <el-icon style="margin-right: 3px"><ChatDotRound /></el-icon>
                {{ $t('trade.contactWisher') }}
              </el-button>
            </div>
          </div>
        </div>
      </div>
      <el-empty v-else-if="tab === 'buy' && !loading" :description="$t('trade.emptyWish')" />
    </div>
  </div>
</template>

<script setup>import { useI18n } from 'vue-i18n'
const { t } = useI18n()

import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, Plus, UploadFilled, Notebook, Document, Camera, Loading, ShoppingCart, ChatDotRound, Filter, Close } from '@element-plus/icons-vue'
import { booksApi, bookApi, wishlistApi, conversationApi } from '@/api'

const router = useRouter()
const route = useRoute()
const tab = ref('sell')
const keyword = ref('')
const books = ref([])
const wishes = ref([])
const loading = ref(false)
const scanning = ref(false)
const scanInput = ref(null)
const scanBook = ref(null)
const scanDialogVisible = ref(false)
const wishlistAdding = ref(false)

// 两步识别状态: '' → front(封面) → back(ISBN) → confirm(核对)
const scanPhase = ref('')
const scanGuideVisible = ref(false)
const confirmVisible = ref(false)
const frontInfo = ref(null)
const marketMatches = ref({ sellingCount: 0, wishCount: 0 })
// ISBN 筛选(市场同书罗列)
const isbnFilter = ref('')

function switchTab(t) {
  tab.value = t
  if (t === 'buy' && !wishes.value.length) loadWishlist()
  if (t === 'sell' && !books.value.length) loadBooks()
}

async function loadBooks() {
  loading.value = true
  try {
    const params = { keyword: keyword.value }
    if (isbnFilter.value) params.isbn = isbnFilter.value
    const res = await booksApi.list(params)
    books.value = res.data || res || []
  } finally {
    loading.value = false
  }
}

async function loadWishlist() {
  loading.value = true
  try {
    const res = await wishlistApi.publicList({ keyword: keyword.value })
    wishes.value = res.data || res || []
  } finally {
    loading.value = false
  }
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function goWish(w) {
  if (w.book?.id) {
    router.push({ name: 'BookDetail', params: { key: w.book.id } })
  }
}

async function contactWisher(w) {
  try {
    await conversationApi.start(w.user.id, w.book?.id || null)
    ElMessage.success({ message: t('trade.contactStarted'), duration: 2000 })
    router.push('/chat')
  } catch (err) {
    ElMessage.warning(err?.response?.data?.message || t('trade.contactFail'))
  }
}

function goPublish() {
  router.push('/publish')
}

function goBookList() {
  router.push('/booklist')
}

function goDetail(book) {
  const key = book.id || book.isbn || book.bookTitle
  router.push({ name: 'BookDetail', params: { key } })
}

function openScan() {
  // 两步识别: 从第一步(封面正面)开始
  scanPhase.value = 'front'
  frontInfo.value = null
  scanBook.value = null
  marketMatches.value = { sellingCount: 0, wishCount: 0 }
  scanGuideVisible.value = true
}

function cancelScan() {
  scanPhase.value = ''
  scanGuideVisible.value = false
  confirmVisible.value = false
  scanDialogVisible.value = false
  frontInfo.value = null
  scanBook.value = null
}

async function onScanFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  scanning.value = true
  try {
    const fd = new FormData()
    fd.append('image', file)
    fd.append('mode', scanPhase.value === 'back' ? 'back' : 'front')
    const res = await bookApi.scanBook(fd)
    const data = res.data || res
    const book = data.book || {}
    const mm = data.marketMatches || { sellingCount: 0, wishCount: 0 }

    if (scanPhase.value === 'back') {
      // 第二步(背面ISBN)完成 → 合并两次识别结果 → 弹核对框
      const merged = {
        title: frontInfo.value?.title || book.title || '',
        author: frontInfo.value?.author || book.author || '',
        publisher: frontInfo.value?.publisher || book.publisher || '',
        edition: frontInfo.value?.edition || book.edition || '',
        isbn: book.isbn || frontInfo.value?.isbn || '',
        cover: frontInfo.value?.cover || book.cover || ''
      }
      scanBook.value = merged
      // 市场匹配取两步中较大值(正面按书名/背面按ISBN)
      const fmm = frontInfo.value?.matches || { sellingCount: 0, wishCount: 0 }
      marketMatches.value = {
        sellingCount: Math.max(fmm.sellingCount || 0, mm.sellingCount || 0),
        wishCount: Math.max(fmm.wishCount || 0, mm.wishCount || 0)
      }
      scanGuideVisible.value = false
      scanPhase.value = ''
      confirmVisible.value = true
    } else {
      // 第一步(封面)完成 → 提示进入第二步
      frontInfo.value = { ...book, matches: mm }
      scanPhase.value = 'back'
      ElMessage.success({ message: t('common.scanFrontOk'), duration: 2500 })
    }
  } catch (err) {
    const msg = err?.response?.data?.message || t('trade.scanFail')
    ElMessage.warning({ message: msg, duration: 3000 })
    // 第二步失败: 停留在当前引导步, 让用户重拍
  } finally {
    scanning.value = false
  }
}

function confirmScan() {
  confirmVisible.value = false
  // 进入求购询问
  scanDialogVisible.value = true
}

function goMarketFilter() {
  // 跳转交易页并带上 ISBN 筛选 → 罗列市场同书
  const isbn = (scanBook.value?.isbn || '').replace(/[-\s]/g, '')
  confirmVisible.value = false
  scanDialogVisible.value = false
  scanPhase.value = ''
  if (isbn) {
    router.push({ path: '/trade', query: { isbn } })
  }
}

function clearIsbnFilter() {
  isbnFilter.value = ''
  keyword.value = ''
  loadBooks()
}

async function agreeWishlist() {
  wishlistAdding.value = true
  try {
    const book = scanBook.value || {}
    await wishlistApi.add({
      title: book.title || '',
      author: book.author || '',
      isbn: book.isbn || ''
    })
    ElMessage.success({ message: t('trade.wishlistAdded'), duration: 2000 })
    scanDialogVisible.value = false
  } catch (err) {
    const msg = err?.response?.data?.message || t('trade.scanFail')
    ElMessage.warning({ message: msg, duration: 2500 })
  } finally {
    wishlistAdding.value = false
  }
}

onMounted(() => {
  // 支持 /trade?isbn=xxx 跳转筛选(拍照识别罗列市场同书)
  const qIsbn = route.query.isbn
  if (qIsbn) {
    isbnFilter.value = String(qIsbn).replace(/[-\s]/g, '')
    loadBooks()
  } else {
    loadBooks()
  }
})
</script>

<style scoped>
.trade-page {
  padding-bottom: 40px;
}
.trade-tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 18px;
  background: #f1f5f9;
  border-radius: 14px;
  padding: 5px;
  border: 1px solid #e3eaf2;
}
.trade-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 0;
  border-radius: 11px;
  font-size: 15px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: all 0.3s ease;
  user-select: none;
}
.trade-tab:hover {
  color: #0d2847;
}
.trade-tab.active {
  background: linear-gradient(135deg, #42a5f5, #1e88e5);
  color: #fff;
  box-shadow: 0 4px 14px rgba(66, 165, 245, 0.35);
}
.wish-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
.wish-card {
  display: flex;
  gap: 14px;
  background: #fff;
  border-radius: 14px;
  padding: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 12px rgba(13, 40, 71, 0.06);
  border: 1px solid #ecf2f8;
}
.wish-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 28px rgba(66, 165, 245, 0.16);
}
.wish-cover-wrap {
  width: 76px;
  height: 104px;
  border-radius: 8px;
  overflow: hidden;
  background: #f0f4f8;
  flex-shrink: 0;
}
.wish-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.wish-cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  color: #b0bec5;
}
.wish-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.wish-title {
  font-size: 15px;
  font-weight: 600;
  color: #0d2847;
  line-height: 1.4;
  margin: 0 0 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.wish-meta {
  font-size: 13px;
  color: #607d8b;
  margin: 1px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wish-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  padding-top: 6px;
}
.wish-user {
  font-size: 12px;
  color: #78909c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wish-time {
  font-size: 11px;
  color: #b0bec5;
  flex-shrink: 0;
  margin-left: 6px;
}
.wish-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}
.wish-sellers {
  font-size: 12px;
  color: #42a5f5;
  font-weight: 600;
}
.wish-actions :deep(.el-button) {
  border: none;
  background: linear-gradient(135deg, #66bb6a, #43a047);
  font-size: 12px;
}
.wish-actions :deep(.el-button:hover) {
  opacity: 0.9;
}
.search-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 24px;
}
.search-input {
  flex: 1;
}
.add-btn {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #42a5f5, #1e88e5);
  color: #fff;
  font-size: 22px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  box-shadow: 0 4px 14px rgba(66, 165, 245, 0.35);
}
.add-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(66, 165, 245, 0.5);
}
.scan-btn {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #66bb6a, #43a047);
  color: #fff;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  box-shadow: 0 4px 14px rgba(67, 160, 71, 0.35);
  flex-shrink: 0;
}
.scan-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(67, 160, 71, 0.5);
}
.scan-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.scan-spin {
  animation: scan-rotate 1s linear infinite;
}
@keyframes scan-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.scan-preview {
  display: flex;
  gap: 14px;
  padding: 14px;
  background: #f9f9f9;
  border-radius: 8px;
  margin-bottom: 12px;
}
.scan-cover {
  width: 72px;
  height: 100px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}
.scan-text h3 {
  font-size: 16px;
  margin: 0 0 6px;
}
.scan-text p {
  color: #666;
  font-size: 13px;
  margin: 2px 0;
}
.scan-ask {
  color: #555;
  font-size: 15px;
  text-align: center;
  margin: 6px 0 0;
  line-height: 1.6;
}
.add-menu {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  border-radius: 8px;
  font-size: 14px;
  color: #37474f;
  transition: background 0.2s;
}
.add-menu:hover {
  background: rgba(66, 165, 245, 0.08);
  color: #42a5f5;
}
.book-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 20px;
}
.book-card {
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 12px rgba(13, 40, 71, 0.06);
}
.book-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 10px 28px rgba(66, 165, 245, 0.18);
}
.book-cover-wrap {
  aspect-ratio: 3 / 4;
  background: #f0f4f8;
  overflow: hidden;
}
.book-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.book-cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  color: #b0bec5;
}
.book-info {
  padding: 12px 14px 14px;
}
.book-title {
  font-size: 15px;
  font-weight: 600;
  color: #0d2847;
  line-height: 1.4;
  margin-bottom: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.book-edition {
  font-size: 12px;
  color: #90a4ae;
  margin-bottom: 4px;
}
.book-author {
  font-size: 13px;
  color: #607d8b;
  margin-bottom: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.book-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.book-price {
  font-size: 17px;
  font-weight: 700;
  color: #e53935;
}
.book-count {
  font-size: 12px;
  color: #90a4ae;
}

@media (max-width: 768px) {
  .trade-page {
    padding-bottom: 16px;
  }
  .search-row {
    margin-bottom: 14px;
    gap: 8px;
  }
  .search-input :deep(.el-input__wrapper) {
    padding: 4px 10px;
  }
  .add-btn {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
  }
  .book-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  .book-card {
    border-radius: 10px;
  }
  .book-info {
    padding: 8px 10px 10px;
  }
  .book-title {
    font-size: 13px;
  }
  .book-author {
    font-size: 12px;
    margin-bottom: 6px;
  }
  .book-price {
    font-size: 15px;
  }
  .book-count {
    font-size: 11px;
  }
  .trade-tabs {
    margin-bottom: 12px;
    gap: 8px;
  }
  .trade-tab {
    font-size: 13px;
    padding: 8px 0;
  }
  .wish-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .wish-card {
    padding: 10px;
    gap: 10px;
  }
  .wish-cover-wrap {
    width: 64px;
    height: 88px;
  }
  .wish-title {
    font-size: 14px;
  }
  .wish-meta {
    font-size: 12px;
  }
}
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, #42a5f5, #1e88e5);
  color: #fff;
  border-radius: 20px;
  padding: 6px 14px;
  font-size: 13px;
  box-shadow: 0 4px 12px rgba(66, 165, 245, 0.3);
}
.filter-chip b {
  font-weight: 700;
}
.chip-clear {
  cursor: pointer;
  margin-left: 4px;
  opacity: 0.85;
}
.chip-clear:hover {
  opacity: 1;
}
.filter-hint {
  color: #94a3b8;
  font-size: 12px;
}
.scan-guide {
  text-align: center;
}
.guide-step {
  font-size: 15px;
  font-weight: 600;
  color: #0d2847;
  margin-bottom: 12px;
  line-height: 1.6;
}
.guide-front {
  margin-bottom: 8px;
}
.guide-cover {
  width: 96px;
  height: 128px;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(13, 40, 71, 0.18);
}
.guide-ok {
  color: #22a55e;
  font-size: 12px;
  margin-top: 6px;
}
.guide-tip {
  color: #f5a623;
  font-size: 12px;
  margin-top: 4px;
}
.scan-edit p {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 6px 0;
}
.scan-edit .lbl {
  width: 62px;
  flex-shrink: 0;
  text-align: right;
  color: #64748b;
  font-size: 13px;
}
.market-match {
  background: #f0f7ff;
  border: 1px dashed #90caf9;
  border-radius: 10px;
  padding: 10px 14px;
  margin-top: 10px;
  font-size: 13px;
  color: #0d47a1;
}
.market-match p {
  margin: 2px 0;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.confirm-tip {
  color: #f5a623;
  font-size: 12px;
  margin-top: 10px;
  text-align: center;
}
</style>