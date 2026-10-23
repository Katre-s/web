<template>
  <div class="trade-page">
    <!-- 二级类目栏 -->
    <div class="cat-bar">
      <button
        v-for="c in categories"
        :key="c.value"
        class="cat-item"
        :class="{ active: category === c.value }"
        @click="switchCategory(c.value)"
      >
        <span class="cat-icon">{{ c.icon }}</span>
        <span class="cat-name">{{ $t('tradeCat.' + c.key) }}</span>
      </button>
    </div>

    <div class="cat-meta">
      <span class="cat-hint">{{ categoryHint }}</span>
      <span class="cat-count" v-if="!loading">{{ totalCount }}{{ isBook ? $t('trade.booksOnSale') : $t('trade.itemsOnSale') }}</span>
    </div>

    <div class="search-row">
      <el-input
        v-model="keyword"
        :placeholder="isBook ? $t('trade.searchPlaceholder') : $t('trade.searchInCategory', { name: categoryLabel })"
        clearable
        size="large"
        class="search-input"
        @keyup.enter="doSearch"
        @clear="doSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-popover placement="bottom-end" :width="180" trigger="click">
        <template #reference>
          <button class="add-btn" :title="$t('trade.publishGoods')">
            <el-icon><Plus /></el-icon>
          </button>
        </template>
        <div class="add-menu" @click="goPublish">
          <el-icon><UploadFilled /></el-icon>
          <span>{{ $t('trade.publishGoods') }}</span>
        </div>
        <div v-if="isBook" class="add-menu" @click="goBookList">
          <el-icon><Document /></el-icon>
          <span>{{ $t('booklist.title') }}</span>
        </div>
      </el-popover>
      <!-- 筛选按钮 -->
      <el-popover placement="bottom-end" :width="280" trigger="click" @show="syncFilterPanel">
        <template #reference>
          <button class="filter-btn" :title="$t('trade.filterBtn')">
            <el-icon><Filter /></el-icon>
          </button>
        </template>
        <div class="filter-panel">
          <p class="filter-label">{{ $t('trade.filterContent') }}</p>
          <el-input
            v-model="filterContent"
            size="small"
            clearable
            :placeholder="isBook ? $t('trade.filterContentPlaceholder') : $t('trade.filterGoodsPlaceholder')"
            @keyup.enter="applyFilter"
          />
          <template v-if="isBook">
            <p class="filter-label">{{ $t('trade.filterField') }}</p>
            <el-radio-group v-model="filterField" size="small">
              <el-radio-button value="all">{{ $t('trade.fieldAll') }}</el-radio-button>
              <el-radio-button value="title">{{ $t('common.bookName') }}</el-radio-button>
              <el-radio-button value="author">{{ $t('common.author') }}</el-radio-button>
              <el-radio-button value="isbn">ISBN</el-radio-button>
            </el-radio-group>
          </template>
          <p class="filter-label">{{ $t('trade.filterPrice') }}</p>
          <div class="filter-price">
            <el-input v-model="filterMin" type="number" size="small" :placeholder="$t('trade.priceMin')" />
            <span class="price-sep">-</span>
            <el-input v-model="filterMax" type="number" size="small" :placeholder="$t('trade.priceMax')" />
          </div>
          <div class="filter-actions">
            <el-button size="small" @click="resetFilter">{{ $t('common.reset') }}</el-button>
            <el-button size="small" type="primary" @click="applyFilter">{{ $t('common.confirm') }}</el-button>
          </div>
        </div>
      </el-popover>
      <button v-if="isBook" class="scan-btn" :title="$t('trade.scanBook')" :disabled="scanning" @click="openScan">
        <el-icon v-if="!scanning"><Camera /></el-icon>
        <el-icon v-else class="scan-spin"><Loading /></el-icon>
      </button>
      <input ref="scanInput" type="file" accept="image/*" style="display: none" @change="onScanFile" />
    </div>

    <!-- ISBN 筛选: 拍照识别后罗列市场同书 -->
    <div class="filter-bar" v-if="isbnFilter && !scanView">
      <span class="filter-chip">
        <el-icon style="margin-right: 4px"><Filter /></el-icon>
        {{ $t('trade.filterIsbn') }} <b>{{ isbnFilter }}</b>
        <el-icon class="chip-clear" @click="clearIsbnFilter"><Close /></el-icon>
      </span>
      <span class="filter-hint">{{ $t('trade.filterHint') }}</span>
    </div>

    <!-- 识别筛选视图: 从扫码"去看看"跳入, 基于识别结果的简略筛选 -->
    <div class="scan-result-view" v-if="scanView">
      <div class="scan-result-head">
        <img v-if="scanView.cover" :src="resolveImg(scanView.cover)" class="scan-result-cover" @error="scanView.cover = ''" />
        <div v-else class="scan-result-cover-empty"><el-icon><Notebook /></el-icon></div>
        <div class="scan-result-info">
          <h3>{{ scanView.title || t('common.unknownBook') }}</h3>
          <p v-if="scanView.isbn">ISBN {{ scanView.isbn }}</p>
          <p class="scan-result-match">📦 {{ $t('trade.scanViewSell') }} {{ books.length }}</p>
        </div>
        <el-button class="scan-result-exit" size="small" @click="exitScanView">{{ $t('trade.scanViewExit') }}</el-button>
      </div>
    </div>

    <!-- 两步识别: 第一步/第二步拍摄引导 -->
    <el-dialog v-model="scanGuideVisible" :title="$t('common.scanGuideTitle')" width="400px" :close-on-click-modal="false">
      <div class="scan-guide">
        <div class="guide-step">{{ scanPhase === 'front' ? $t('common.scanStepFront') : $t('common.scanStepBack') }}</div>
        <div v-if="frontInfo?.cover" class="guide-front">
          <img :src="resolveImg(frontInfo.cover)" class="guide-cover" @error="frontInfo.cover = ''" />
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
        <img v-if="scanBook.cover" :src="resolveImg(scanBook.cover)" class="scan-cover" @error="scanBook.cover = ''" />
        <div class="scan-text scan-edit">
          <p><span class="lbl">{{ $t('common.bookName') }}</span><el-input v-model="scanBook.title" size="small" /></p>
          <p><span class="lbl">{{ $t('common.authorPrefix') }}</span><el-input v-model="scanBook.author" size="small" /></p>
          <p><span class="lbl">{{ $t('common.publisher') }}</span><el-input v-model="scanBook.publisher" size="small" /></p>
          <p><span class="lbl">{{ $t('common.edition') }}</span><el-input v-model="scanBook.edition" size="small" /></p>
          <p><span class="lbl">ISBN</span><el-input v-model="scanBook.isbn" size="small" /></p>
        </div>
      </div>
      <div class="market-match" v-if="marketMatches.sellingCount > 0">
        <p>
          📦 {{ $t('common.marketHas') }} <b>{{ marketMatches.sellingCount }}</b>{{ $t('trade.sellers') }}
          <el-button size="small" link type="primary" @click="goMarketFilter">{{ $t('common.seeMarket') }} →</el-button>
        </p>
      </div>
      <p class="confirm-tip">{{ $t('common.confirmTip') }}</p>
      <template #footer>
        <el-button @click="cancelScan">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="confirmScan">{{ $t('common.confirm') }}</el-button>
      </template>
    </el-dialog>

    <div v-loading="loading">
      <!-- 图书：按书目板块聚合 -->
      <div class="book-grid" v-if="isBook && books.length">
        <div
          v-for="book in books"
          :key="book.id || book.isbn || book.bookTitle"
          class="book-card"
          @click="goDetail(book)"
        >
          <div class="book-cover-wrap">
            <img v-if="book.bookCover" :src="thumb(book.bookCover, 480)" class="book-cover" loading="lazy" @error="coverError($event, book.bookCover)" />
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

      <!-- 其他类目：单件商品列表 -->
      <div class="goods-grid" v-else-if="!isBook && products.length">
        <div v-for="p in products" :key="p.id" class="goods-card" @click="goProduct(p)">
          <div class="goods-cover-wrap">
            <img
              v-if="goodsCover(p)"
              :src="goodsCover(p)"
              class="goods-cover"
              loading="lazy"
              @error="coverError($event, p.bookCover || p.images?.[0]?.imagePath)"
            />
            <div v-else class="goods-cover-placeholder">{{ currentCategory.icon }}</div>
            <span class="goods-badge">{{ $t('tradeCat.' + categoryKey(p.category)) }}</span>
          </div>
          <div class="goods-info">
            <h3 class="goods-title">{{ p.title || p.bookTitle }}</h3>
            <p class="goods-desc">{{ p.description || categoryHint }}</p>
            <div class="goods-bottom">
              <span class="goods-price">¥{{ p.price }}</span>
              <span class="goods-cond" v-if="p.condition && category !== '租房'">{{ p.condition }}</span>
            </div>
            <p class="goods-seller" v-if="p.seller">
              {{ p.seller.nickname }}<span v-if="p.seller.campus"> · {{ p.seller.campus }}</span>
            </p>
          </div>
        </div>
      </div>

      <el-empty v-else-if="!loading" :description="emptyText">
        <el-button v-if="!isBook && !keyword && !isbnFilter" type="primary" round @click="goPublish">
          {{ $t('trade.goPublish') }}
        </el-button>
      </el-empty>
    </div>
  </div>
</template>

<script setup>import { useI18n } from 'vue-i18n'
const { t } = useI18n()

import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus/es/components/message/index'
import { Search, Plus, UploadFilled, Notebook, Document, Camera, Loading, Filter, Close } from '@element-plus/icons-vue'
import { booksApi, bookApi, productApi, recommendApi } from '@/api'
import { resolveImg, thumb } from '@/utils/image'
import { TRADE_CATEGORIES, DEFAULT_CATEGORY, isValidCategory, getCategory, categoryKey } from '@/constants/categories'

const router = useRouter()
const route = useRoute()

const categories = TRADE_CATEGORIES
const category = ref(DEFAULT_CATEGORY)
const currentCategory = computed(() => getCategory(category.value))
const isBook = computed(() => category.value === '图书')
const categoryLabel = computed(() => t('tradeCat.' + currentCategory.value.key))
const categoryHint = computed(() => t('tradeCatHint.' + currentCategory.value.key))

const keyword = ref('')
const books = ref([])
const products = ref([])
const loading = ref(false)
const scanning = ref(false)
const scanInput = ref(null)
const scanBook = ref(null)

// 两步识别状态: '' → front(封面) → back(ISBN) → confirm(核对)
const scanPhase = ref('')
const scanGuideVisible = ref(false)
const confirmVisible = ref(false)
const frontInfo = ref(null)
const marketMatches = ref({ sellingCount: 0 })
// ISBN 筛选(市场同书罗列)
const isbnFilter = ref('')
// 识别筛选视图(从扫码"去看看"跳入, 基于识别结果的简略筛选)
const scanView = ref(null)
// 完整筛选面板: 搜索类型 + 价格区间
const filterField = ref('all')
const filterMin = ref(null)
const filterMax = ref(null)
const filterContent = ref('')

const totalCount = computed(() => (isBook.value ? books.value.length : products.value.length))
const emptyText = computed(() => (
  isBook.value
    ? (keyword.value || isbnFilter.value ? t('trade.emptySearch') : t('trade.empty'))
    : t('trade.emptyCategory', { name: categoryLabel.value })
))

function switchCategory(value) {
  if (category.value === value) return
  category.value = value
  recommendApi.track({ type: 'search', keyword: '', category: value }).catch(() => {})
  // 切类目时清掉上一个类目的筛选状态
  keyword.value = ''
  filterContent.value = ''
  filterField.value = 'all'
  filterMin.value = null
  filterMax.value = null
  isbnFilter.value = ''
  scanView.value = null
  books.value = []
  products.value = []
  const query = { ...route.query, category: value }
  delete query.from
  delete query.isbn
  delete query.title
  delete query.keyword
  router.replace({ path: '/trade', query })
  reload()
}

function trackSearch() {
  const kw = (keyword.value || isbnFilter.value || '').trim()
  recommendApi.track({ type: 'search', keyword: kw, category: category.value }).catch(() => {})
}

function doSearch() {
  trackSearch()
  reload()
}

function reload() {
  if (isBook.value) loadBooks()
  else loadProducts()
}

async function loadBooks() {
  loading.value = true
  try {
    const params = { keyword: keyword.value }
    if (isbnFilter.value) params.isbn = isbnFilter.value
    if (filterField.value && filterField.value !== 'all') params.field = filterField.value
    if (filterMin.value !== null && filterMin.value !== '') params.minPrice = filterMin.value
    if (filterMax.value !== null && filterMax.value !== '') params.maxPrice = filterMax.value
    const res = await booksApi.list(params)
    books.value = res.data || res || []
    if (scanView.value && books.value[0]?.bookCover) scanView.value.cover = books.value[0].bookCover
  } finally {
    loading.value = false
  }
}

async function loadProducts() {
  loading.value = true
  try {
    const params = { keyword: keyword.value, category: category.value, pageSize: 60 }
    if (filterMin.value !== null && filterMin.value !== '') params.minPrice = filterMin.value
    if (filterMax.value !== null && filterMax.value !== '') params.maxPrice = filterMax.value
    const res = await productApi.list(params)
    let list = res.data || res || []
    // 价格区间后端暂未支持时前端兜底过滤
    const lo = filterMin.value !== null && filterMin.value !== '' ? Number(filterMin.value) : NaN
    const hi = filterMax.value !== null && filterMax.value !== '' ? Number(filterMax.value) : NaN
    if (!isNaN(lo) || !isNaN(hi)) {
      list = list.filter((p) => {
        const price = Number(p.price) || 0
        if (!isNaN(lo) && price < lo) return false
        if (!isNaN(hi) && price > hi) return false
        return true
      })
    }
    products.value = list
  } finally {
    loading.value = false
  }
}

function goodsCover(p) {
  const first = p.images?.[0]
  const firstPath = typeof first === 'string' ? first : first?.imagePath
  return thumb(p.bookCover || firstPath, 480)
}

// 缩略图生成失败（老图/文件名特殊）时退回原图，再失败才藏起来，别留破图
function coverError(e, raw) {
  const el = e?.target
  if (!el) return
  if (el.dataset.fb !== 'raw') {
    el.dataset.fb = 'raw'
    const u = resolveImg(raw)
    if (u) { el.src = u; return }
  }
  el.style.visibility = 'hidden'
}

// 筛选面板
function syncFilterPanel() {
  filterContent.value = keyword.value || ''
}

function applyFilter() {
  keyword.value = (filterContent.value || '').trim()
  trackSearch()
  reload()
}

function resetFilter() {
  filterField.value = 'all'
  filterMin.value = null
  filterMax.value = null
  keyword.value = ''
  filterContent.value = ''
  reload()
}

// 退出识别筛选视图, 回到正常交易市场
function exitScanView() {
  scanView.value = null
  isbnFilter.value = ''
  keyword.value = ''
  filterField.value = 'all'
  filterMin.value = null
  filterMax.value = null
  router.replace('/trade')
  loadBooks()
}

function goPublish() {
  router.push({ path: '/publish', query: { category: category.value } })
}

function goBookList() {
  router.push('/booklist')
}

function goDetail(book) {
  const key = book.id || book.isbn || book.bookTitle
  router.push({ name: 'BookDetail', params: { key } })
}

function goProduct(p) {
  router.push(`/product/${p.id}`)
}

function openScan() {
  scanPhase.value = 'front'
  frontInfo.value = null
  scanBook.value = null
  marketMatches.value = { sellingCount: 0 }
  scanGuideVisible.value = true
}

function cancelScan() {
  scanPhase.value = ''
  scanGuideVisible.value = false
  confirmVisible.value = false
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
    const mm = data.marketMatches || { sellingCount: 0 }

    if (scanPhase.value === 'back') {
      // 第二步(背面ISBN)完成 → 合并两次识别结果 → 弹核对框
      scanBook.value = {
        title: frontInfo.value?.title || book.title || '',
        author: frontInfo.value?.author || book.author || '',
        publisher: frontInfo.value?.publisher || book.publisher || '',
        edition: frontInfo.value?.edition || book.edition || '',
        isbn: book.isbn || frontInfo.value?.isbn || '',
        cover: frontInfo.value?.cover || book.cover || ''
      }
      const fmm = frontInfo.value?.matches || { sellingCount: 0 }
      marketMatches.value = {
        sellingCount: Math.max(fmm.sellingCount || 0, mm.sellingCount || 0)
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
  } finally {
    scanning.value = false
  }
}

function confirmScan() {
  confirmVisible.value = false
  // 核对完成 → 直接看市场同书在售
  goMarketFilter()
}

function goMarketFilter() {
  // 当前页内直接切到"识别筛选视图", 不依赖路由重新挂载
  const book = scanBook.value || {}
  const isbn = (book.isbn || '').replace(/[-\s]/g, '')
  confirmVisible.value = false
  scanPhase.value = ''
  category.value = '图书'
  scanView.value = { isbn, title: book.title || '', cover: book.cover || '' }
  isbnFilter.value = isbn
  keyword.value = isbn ? '' : (book.title || '')
  filterField.value = isbn ? 'all' : 'title'
  filterMin.value = null
  filterMax.value = null
  router.replace({
    path: '/trade',
    query: { category: '图书', from: 'scan', ...(isbn ? { isbn } : { keyword: encodeURIComponent(book.title || ''), field: 'title' }) }
  })
  loadBooks()
}

function clearIsbnFilter() {
  isbnFilter.value = ''
  keyword.value = ''
  loadBooks()
}

onMounted(() => {
  // 地址栏可能带类目
  const qCategory = route.query.category
  if (qCategory && isValidCategory(String(qCategory))) category.value = String(qCategory)

  // 识别筛选视图: /trade?isbn=xxx&title=xxx&from=scan 或 keyword+field
  const qIsbn = route.query.isbn
  const qTitle = route.query.title ? decodeURIComponent(route.query.title) : ''
  const qKeyword = route.query.keyword ? decodeURIComponent(route.query.keyword) : ''
  const qField = route.query.field || ''
  const fromScan = route.query.from === 'scan'
  if (fromScan) {
    category.value = '图书'
    scanView.value = { isbn: qIsbn ? String(qIsbn).replace(/[-\s]/g, '') : '', title: qTitle || qKeyword || '', cover: '' }
    if (qIsbn) isbnFilter.value = scanView.value.isbn
    if (qKeyword) { keyword.value = qKeyword; if (qField) filterField.value = qField }
    loadBooks()
  } else if (qIsbn) {
    category.value = '图书'
    isbnFilter.value = String(qIsbn).replace(/[-\s]/g, '')
    loadBooks()
  } else {
    reload()
  }
})

// 页内前进/后退或从别处跳进不同类目的链接时，同步切换
watch(() => route.query.category, (v) => {
  if (!v || !isValidCategory(String(v))) return
  if (String(v) === category.value) return
  category.value = String(v)
  keyword.value = ''
  filterContent.value = ''
  filterMin.value = null
  filterMax.value = null
  isbnFilter.value = ''
  scanView.value = null
  books.value = []
  products.value = []
  reload()
})
</script>

<style scoped>
.trade-page {
  padding-bottom: 40px;
}

/* 入场动画：区块与卡片错落浮出 */
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ---------------- 类目栏 ---------------- */
.cat-bar {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 4px 2px 10px;
  margin-bottom: 4px;
  scrollbar-width: none;
  animation: rise 0.45s var(--ease-smooth) backwards;
}
.cat-bar::-webkit-scrollbar {
  display: none;
}
.cat-item {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 68px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid var(--card-border);
  background: var(--card-bg);
  color: var(--text-sub);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.25s var(--ease-spring), border-color 0.22s, box-shadow 0.28s, color 0.22s;
}
.cat-icon {
  font-size: 20px;
  line-height: 1;
  transition: transform 0.3s var(--ease-spring);
}
.cat-item:hover {
  border-color: var(--accent-soft);
  transform: translateY(-2px);
}
.cat-item:hover .cat-icon {
  transform: scale(1.15);
}
.cat-item.active {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  border-color: transparent;
  color: #fff;
  box-shadow: 0 6px 18px var(--accent-soft);
}
.cat-item.active .cat-icon {
  animation: cat-pop 0.4s var(--ease-spring);
}
@keyframes cat-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}
.cat-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 2px 2px 12px;
  font-size: 12px;
  color: var(--text-sub);
}
.cat-hint {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cat-count {
  flex-shrink: 0;
  color: var(--accent);
  font-weight: 600;
}

.search-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 24px;
  animation: rise 0.45s var(--ease-smooth) 0.08s backwards;
}
.search-input {
  flex: 1;
}
.add-btn {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff;
  font-size: 22px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.25s var(--ease-spring), box-shadow 0.3s;
  box-shadow: 0 4px 14px var(--accent-soft);
}
.add-btn:hover {
  transform: translateY(-2px) scale(1.04);
  box-shadow: 0 6px 20px var(--accent-soft);
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

/* ---------------- 图书板块 ---------------- */
.book-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 20px;
}
.book-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  box-shadow: var(--card-shadow);
  transition: transform 0.3s var(--ease-spring), box-shadow 0.3s, border-color 0.3s;
  animation: rise 0.5s var(--ease-spring) backwards;
}
.book-card:nth-child(1) { animation-delay: 0.05s; }
.book-card:nth-child(2) { animation-delay: 0.09s; }
.book-card:nth-child(3) { animation-delay: 0.13s; }
.book-card:nth-child(4) { animation-delay: 0.17s; }
.book-card:nth-child(5) { animation-delay: 0.21s; }
.book-card:nth-child(6) { animation-delay: 0.25s; }
.book-card:nth-child(n + 7) { animation-delay: 0.29s; }
.book-card:hover {
  transform: translateY(-6px);
  box-shadow: var(--card-shadow-hover);
  border-color: var(--accent-soft);
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
  transition: transform 0.45s var(--ease-smooth);
}
.book-card:hover .book-cover {
  transform: scale(1.06);
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
  color: var(--text-main);
  line-height: 1.4;
  margin-bottom: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.book-edition {
  font-size: 12px;
  color: var(--text-sub);
  margin-bottom: 4px;
}
.book-author {
  font-size: 13px;
  color: var(--text-sub);
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
  color: var(--text-sub);
}

/* ---------------- 其他类目商品 ---------------- */
.goods-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 18px;
}
.goods-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  box-shadow: var(--card-shadow);
  transition: transform 0.3s var(--ease-spring), box-shadow 0.3s, border-color 0.3s;
  display: flex;
  flex-direction: column;
  animation: rise 0.5s var(--ease-spring) backwards;
}
.goods-card:nth-child(1) { animation-delay: 0.05s; }
.goods-card:nth-child(2) { animation-delay: 0.09s; }
.goods-card:nth-child(3) { animation-delay: 0.13s; }
.goods-card:nth-child(4) { animation-delay: 0.17s; }
.goods-card:nth-child(5) { animation-delay: 0.21s; }
.goods-card:nth-child(6) { animation-delay: 0.25s; }
.goods-card:nth-child(n + 7) { animation-delay: 0.29s; }
.goods-card:hover {
  transform: translateY(-5px);
  box-shadow: var(--card-shadow-hover);
  border-color: var(--accent-soft);
}
.goods-cover-wrap {
  position: relative;
  aspect-ratio: 1 / 1;
  background: #f4f8fc;
  overflow: hidden;
}
.goods-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.45s var(--ease-smooth);
}
.goods-card:hover .goods-cover {
  transform: scale(1.06);
}
.goods-cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 46px;
}
.goods-badge {
  position: absolute;
  left: 10px;
  top: 10px;
  padding: 3px 9px;
  border-radius: 10px;
  background: rgba(13, 40, 71, 0.62);
  color: #fff;
  font-size: 11px;
  backdrop-filter: blur(4px);
}
.goods-info {
  padding: 12px 14px 14px;
  display: flex;
  flex-direction: column;
  flex: 1;
}
.goods-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-main);
  line-height: 1.4;
  margin-bottom: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.goods-desc {
  font-size: 12px;
  color: var(--text-sub);
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.goods-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
}
.goods-price {
  font-size: 17px;
  font-weight: 700;
  color: #e53935;
}
.goods-cond {
  font-size: 11px;
  color: var(--accent);
  background: var(--accent-soft-2);
  border-radius: 8px;
  padding: 2px 8px;
}
.goods-seller {
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-sub);
  opacity: 0.85;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ---------------- 筛选 / 扫码 ---------------- */
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
.filter-btn {
  width: 50px;
  height: 42px;
  border-radius: 10px;
  border: 1px solid var(--card-border);
  background: var(--card-bg);
  color: var(--text-main);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: all 0.22s var(--ease-smooth);
}
.filter-btn:hover {
  background: var(--accent-soft-2);
  border-color: var(--accent-soft);
  transform: translateY(-1px);
}
.filter-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.filter-label {
  font-size: 13px;
  font-weight: 600;
  color: #0d2847;
  margin: 0;
}
.filter-price {
  display: flex;
  align-items: center;
  gap: 8px;
}
.price-sep {
  color: #94a3b8;
}
.filter-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
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
.scan-result-view {
  background: linear-gradient(135deg, #f0f7ff, #fff);
  border: 1px solid #d6e9ff;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 18px;
}
.scan-result-head {
  display: flex;
  align-items: center;
  gap: 16px;
}
.scan-result-cover,
.scan-result-cover-empty {
  width: 72px;
  height: 96px;
  border-radius: 8px;
  flex-shrink: 0;
  object-fit: cover;
  box-shadow: 0 4px 14px rgba(13, 40, 71, 0.15);
}
.scan-result-cover-empty {
  background: #e8f1fa;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  color: #b0bec5;
}
.scan-result-info {
  flex: 1;
  min-width: 0;
}
.scan-result-info h3 {
  font-size: 18px;
  color: #0d2847;
  margin: 0 0 4px;
}
.scan-result-info p {
  color: #64748b;
  font-size: 13px;
  margin: 2px 0;
}
.scan-result-match {
  color: #0d47a1 !important;
  font-weight: 600;
}
.scan-result-exit {
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .trade-page {
    padding-bottom: 16px;
  }
  .cat-bar {
    gap: 8px;
    padding-bottom: 8px;
  }
  .cat-item {
    min-width: 60px;
    padding: 8px 10px;
    border-radius: 12px;
    font-size: 11px;
  }
  .cat-icon {
    font-size: 18px;
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
  .filter-btn {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
  }
  .scan-btn {
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
  .goods-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  .goods-info {
    padding: 10px 12px 12px;
  }
  .goods-title {
    font-size: 14px;
  }
  .goods-price {
    font-size: 15px;
  }
  .scan-result-head {
    flex-direction: column;
    text-align: center;
  }
  .scan-result-exit {
    width: 100%;
  }
}
</style>
