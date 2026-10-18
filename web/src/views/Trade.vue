<template>
  <div class="trade-page">
    <div class="search-row">
      <el-input
        v-model="keyword"
        :placeholder="$t('trade.searchPlaceholder')"
        clearable
        size="large"
        class="search-input"
        @keyup.enter="loadBooks"
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
      <div class="book-grid" v-if="books.length">
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
      <el-empty v-else-if="!loading" :description="$t('trade.empty')" />
    </div>
  </div>
</template>

<script setup>import { useI18n } from 'vue-i18n'
const { t } = useI18n()

import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, Plus, UploadFilled, Notebook, Document, Camera, Loading } from '@element-plus/icons-vue'
import { booksApi, bookApi, wishlistApi } from '@/api'

const router = useRouter()
const keyword = ref('')
const books = ref([])
const loading = ref(false)
const scanning = ref(false)
const scanInput = ref(null)
const scanBook = ref(null)
const scanDialogVisible = ref(false)
const wishlistAdding = ref(false)

async function loadBooks() {
  loading.value = true
  try {
    const res = await booksApi.list({ keyword: keyword.value })
    books.value = res.data || res || []
  } finally {
    loading.value = false
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
  scanInput.value?.click()
}

async function onScanFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  scanning.value = true
  try {
    const fd = new FormData()
    fd.append('image', file)
    const res = await bookApi.scanBook(fd)
    const data = res.data || res
    const book = data.book || {}
    scanBook.value = book
    scanDialogVisible.value = true
  } catch (err) {
    const msg = err?.response?.data?.message || t('trade.scanFail')
    ElMessage.warning({ message: msg, duration: 2500 })
  } finally {
    scanning.value = false
  }
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

onMounted(loadBooks)
</script>

<style scoped>
.trade-page {
  padding-bottom: 40px;
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
}
</style>