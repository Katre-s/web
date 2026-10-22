<template>
  <div class="publish-page">
    <h2 class="page-title">{{ $t('publish.title') }}</h2>

    <div class="isbn-section" v-if="isBook">
      <div class="isbn-row">
        <el-input v-model="isbn" :placeholder="$t('publish.isbnPlaceholder')" style="width: 300px" @keyup.enter="handleIsbnLookup" />
        <el-button type="primary" :loading="looking" @click="handleIsbnLookup">{{ $t('publish.autoDetect') }}</el-button>
        <el-button type="success" :loading="scanning" @click="openScan">{{ $t('publish.scanPhoto') }}</el-button>
        <input ref="scanInput" type="file" accept="image/*" style="display: none" @change="onScanFile" />
      </div>
      <p class="isbn-tip" v-if="!bookInfo">{{ $t('publish.isbnTip') }}</p>
    </div>
    <div class="isbn-section" v-else>
      <p class="goods-tip">{{ $t('publish.goodsTip') }}</p>
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

    <!-- 核对书籍信息(正面+背面合并, 识别照片作封面可更换) -->
    <el-dialog v-model="confirmVisible" :title="$t('common.confirmTitle')" width="470px" :close-on-click-modal="false">
      <div class="confirm-preview">
        <div class="cover-box">
          <img v-if="scanBook?.cover" :src="resolveImg(scanBook.cover)" class="scan-cover" @error="scanBook.cover = ''" />
          <div v-else class="cover-empty"><el-icon><Notebook /></el-icon></div>
          <el-button size="small" class="change-cover-btn" @click="coverInput?.click()">{{ $t('common.changeCover') }}</el-button>
          <input ref="coverInput" type="file" accept="image/*" style="display: none" @change="onCoverFile" />
        </div>
        <div class="scan-edit">
          <p><span class="lbl">{{ $t('common.bookName') }}</span><el-input v-model="scanBook.title" size="small" /></p>
          <p><span class="lbl">{{ $t('common.authorPrefix') }}</span><el-input v-model="scanBook.author" size="small" /></p>
          <p><span class="lbl">{{ $t('common.publisher') }}</span><el-input v-model="scanBook.publisher" size="small" /></p>
          <p><span class="lbl">{{ $t('common.edition') }}</span><el-input v-model="scanBook.edition" size="small" /></p>
          <p><span class="lbl">ISBN</span><el-input v-model="scanBook.isbn" size="small" /></p>
        </div>
      </div>
      <div class="market-match" v-if="marketMatches.sellingCount > 0">
        <p>📦 {{ $t('common.marketHas') }} <b>{{ marketMatches.sellingCount }}</b>{{ $t('trade.sellers') }}</p>
      </div>
      <p class="confirm-tip">{{ $t('common.confirmTip') }}</p>
      <template #footer>
        <el-button @click="cancelScan">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="confirmScan">{{ $t('common.confirm') }}</el-button>
      </template>
    </el-dialog>

    <!-- 识别后设置价格弹窗 -->
    <el-dialog v-model="priceDialogVisible" :title="$t('publish.priceDialogTitle')" width="440px" :close-on-click-modal="false">
      <div class="scan-book-preview" v-if="scanBook">
        <img v-if="scanBook.cover" :src="resolveImg(scanBook.cover)" class="scan-cover" @error="scanBook.cover = ''" />
        <div class="scan-book-text">
          <h3>{{ scanBook.title }}</h3>
          <p v-if="scanBook.author">{{ $t('publish.authorPrefix') }}{{ scanBook.author }}</p>
          <p v-if="scanBook.publisher">{{ $t('publish.publisherPrefix') }}{{ scanBook.publisher }}</p>
          <p v-if="scanBook.isbn">ISBN {{ scanBook.isbn }}</p>
        </div>
      </div>
      <el-form :model="form" label-position="top">
        <el-form-item :label="$t('publish.salePrice')">
          <el-input-number v-model="form.price" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item :label="$t('publish.condition')">
          <el-select v-model="form.condition" style="width: 100%">
            <el-option :label="$t('publish.condNew')" value="全新" />
            <el-option :label="$t('publish.cond90')" value="九成新" />
            <el-option :label="$t('publish.cond80')" value="八成新" />
            <el-option :label="$t('publish.cond70')" value="七成新" />
            <el-option :label="$t('publish.condNormal')" value="一般" />
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('publish.deliverableLabel')">
          <el-radio-group v-model="form.delivery">
            <el-radio :value="true">{{ $t('common.deliverable') }}</el-radio>
            <el-radio :value="false">{{ $t('common.pickupOnly') }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="$t('publish.description')">
          <el-input v-model="form.description" type="textarea" :rows="2" :placeholder="$t('publish.descriptionPlaceholder')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="priceDialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmitFromDialog">{{ $t('publish.submit') }}</el-button>
      </template>
    </el-dialog>

    <el-form :model="form" label-position="top" class="publish-form">
      <div class="book-preview" v-if="bookInfo && isBook">
        <img :src="resolveImg(bookInfo.cover)" v-if="bookInfo.cover" class="book-cover" @error="bookInfo.cover = ''" />
        <div class="book-info-text">
          <h3>{{ form.bookTitle }}</h3>
          <p>{{ $t('publish.authorPrefix') }}{{ form.bookAuthor }}</p>
          <p>{{ $t('publish.publisherPrefix') }}{{ form.bookPublisher }}</p>
          <p>{{ $t('publish.pricePrefix') }}¥{{ form.originalPrice }}</p>
        </div>
      </div>

      <el-form-item :label="$t('home.category')">
        <el-radio-group v-model="form.category" class="cat-picker">
          <el-radio-button v-for="c in categories" :key="c.value" :value="c.value">
            {{ c.icon }} {{ $t('tradeCat.' + c.key) }}
          </el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item :label="isBook ? $t('publish.bookTitle') : $t('publish.goodsTitle')" required>
        <el-input
          v-if="isBook"
          v-model="form.bookTitle"
          :placeholder="$t('publish.placeholderTitle')"
        />
        <el-input
          v-else
          v-model="form.title"
          maxlength="60"
          show-word-limit
          :placeholder="$t('publish.goodsTitlePlaceholder')"
        />
      </el-form-item>
      <template v-if="isBook">
        <el-form-item :label="$t('publish.author')">
          <el-input v-model="form.bookAuthor" :placeholder="$t('publish.placeholderAuthor')" />
        </el-form-item>
        <el-form-item :label="$t('publish.publisher')">
          <el-input v-model="form.bookPublisher" :placeholder="$t('publish.placeholderPublisher')" />
        </el-form-item>
      </template>
      <el-form-item :label="$t('publish.salePrice')" required>
        <el-input-number v-model="form.price" :min="0" :precision="2" />
      </el-form-item>
      <el-form-item :label="$t('publish.edition')" v-if="isBook">
        <el-input v-model="form.edition" :placeholder="$t('publish.editionPlaceholder')" style="width: 240px" />
      </el-form-item>
      <el-form-item :label="$t('publish.condition')" v-if="form.category !== '租房'">
        <el-select v-model="form.condition" style="width: 200px">
          <el-option :label="$t('publish.condNew')" value="全新" />
          <el-option :label="$t('publish.cond90')" value="九成新" />
          <el-option :label="$t('publish.cond80')" value="八成新" />
          <el-option :label="$t('publish.cond70')" value="七成新" />
          <el-option :label="$t('publish.condNormal')" value="一般" />
        </el-select>
      </el-form-item>
      <el-form-item :label="$t('publish.deliverableLabel')">
        <el-radio-group v-model="form.delivery">
          <el-radio :value="true">{{ $t('common.deliverable') }}</el-radio>
          <el-radio :value="false">{{ $t('common.pickupOnly') }}</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item :label="$t('publish.description')">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          :placeholder="isBook ? $t('publish.descriptionPlaceholder') : $t('publish.goodsDescPlaceholder')"
        />
      </el-form-item>
      <el-form-item :label="$t('publish.photos')">
        <el-upload list-type="picture-card" accept="image/*" :auto-upload="false" :on-change="onImagesChange" :file-list="fileList">
          <el-icon><Plus /></el-icon>
        </el-upload>
      </el-form-item>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ $t('publish.submit') }}</el-button>
    </el-form>
  </div>
</template>

<script setup>import { useI18n } from 'vue-i18n'
const { t } = useI18n()

import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus/es/components/message/index'
import { Plus, Notebook } from '@element-plus/icons-vue'
import { bookApi, productApi } from '@/api'
import { resolveImg } from '@/utils/image'
import { DRAFT_KEYS, takeDraft } from '@/utils/agentAction'
import { TRADE_CATEGORIES, DEFAULT_CATEGORY, isValidCategory } from '@/constants/categories'

const router = useRouter()
const route = useRoute()
const categories = TRADE_CATEGORIES
const isbn = ref('')
const looking = ref(false)
const scanning = ref(false)
const scanInput = ref(null)
const coverInput = ref(null)
const scanBook = ref(null)
const priceDialogVisible = ref(false)
const bookInfo = ref(null)
const submitting = ref(false)
const fileList = ref([])
const images = ref([])

// 两步识别状态
const scanPhase = ref('')
const scanGuideVisible = ref(false)
const confirmVisible = ref(false)
const frontInfo = ref(null)
const coverFile = ref(null)
const marketMatches = ref({ sellingCount: 0 })

const form = reactive({
  title: '',
  bookTitle: '',
  bookAuthor: '',
  bookPublisher: '',
  price: null,
  edition: '',
  condition: '九成新',
  category: DEFAULT_CATEGORY,
  delivery: true,
  description: '',
  originalPrice: 0
})

const isBook = computed(() => form.category === '图书')

async function handleIsbnLookup() {
  if (!isbn.value) {
    ElMessage.warning({ message: t('publish.enterIsbn'), duration: 1200 })
    return
  }
  looking.value = true
  try {
    const res = await bookApi.isbnLookup(isbn.value)
    const data = res.data || res
    bookInfo.value = data
    form.category = '图书'
    form.bookTitle = data.title || ''
    form.bookAuthor = data.author || ''
    form.bookPublisher = data.publisher || ''
    form.originalPrice = data.originalPrice || 0
    form.edition = data.edition || ''
    ElMessage.success({ message: t('publish.recognized'), duration: 1200 })
  } catch (err) {
    ElMessage.warning({ message: t('publish.notFound'), duration: 2000 })
  } finally {
    looking.value = false
  }
}

function onImagesChange(file, fileList) {
  images.value = fileList.map((f) => f.raw)
}

function openScan() {
  // 两步识别: 从第一步(封面正面)开始
  scanPhase.value = 'front'
  frontInfo.value = null
  scanBook.value = null
  coverFile.value = null
  marketMatches.value = { sellingCount: 0 }
  scanGuideVisible.value = true
}

function cancelScan() {
  scanPhase.value = ''
  scanGuideVisible.value = false
  confirmVisible.value = false
  priceDialogVisible.value = false
  frontInfo.value = null
  scanBook.value = null
  coverFile.value = null
}

// 更换封面: 用户另选一张图作为封面
function onCoverFile(e) {
  const f = e.target.files?.[0]
  e.target.value = ''
  if (!f || !scanBook.value) return
  coverFile.value = f
  scanBook.value.cover = URL.createObjectURL(f)
  // 置为商品图片列表第一张 → 提交后作为封面
  images.value = [f, ...images.value.filter((i) => i !== f)]
  ElMessage.success({ message: t('common.coverChanged'), duration: 1500 })
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
      // 第二步(背面ISBN)完成 → 合并两次识别 → 核对弹窗
      const merged = {
        title: frontInfo.value?.title || book.title || '',
        author: frontInfo.value?.author || book.author || '',
        publisher: frontInfo.value?.publisher || book.publisher || '',
        edition: frontInfo.value?.edition || book.edition || '',
        isbn: book.isbn || frontInfo.value?.isbn || '',
        cover: frontInfo.value?.cover || book.cover || '',
        originalPrice: frontInfo.value?.originalPrice || book.originalPrice || 0
      }
      scanBook.value = merged
      // 市场匹配取两步中较大值(正面按书名/背面按ISBN)
      const fmm = frontInfo.value?.matches || { sellingCount: 0 }
      marketMatches.value = {
        sellingCount: Math.max(fmm.sellingCount || 0, mm.sellingCount || 0)
      }
      // 识别照片自动作为封面(需求: 可更换)
      if (!coverFile.value) {
        const coverFileObj = new File([file], 'cover-' + file.name, { type: file.type })
        coverFile.value = coverFileObj
        images.value = [coverFileObj, ...images.value]
      }
      scanGuideVisible.value = false
      scanPhase.value = ''
      confirmVisible.value = true
    } else {
      // 第一步(封面)完成 → 进入第二步
      frontInfo.value = { ...book, matches: mm }
      scanPhase.value = 'back'
      ElMessage.success({ message: t('common.scanFrontOk'), duration: 2500 })
    }
  } catch (err) {
    const msg = err?.response?.data?.message || t('publish.scanFail')
    ElMessage.warning({ message: msg, duration: 3000 })
  } finally {
    scanning.value = false
  }
}

function confirmScan() {
  // 核对通过 → 填充表单并进入价格设置
  const book = scanBook.value || {}
  bookInfo.value = book
  isbn.value = book.isbn || ''
  form.category = '图书'
  form.bookTitle = book.title || ''
  form.bookAuthor = book.author || ''
  form.bookPublisher = book.publisher || ''
  form.originalPrice = book.originalPrice || 0
  form.edition = book.edition || ''
  form.price = null
  form.description = ''
  confirmVisible.value = false
  priceDialogVisible.value = true
}

async function handleSubmitFromDialog() {
  priceDialogVisible.value = false
  await handleSubmit()
}

async function handleSubmit() {
  const title = isBook.value ? form.bookTitle.trim() : form.title.trim()
  if (!title) {
    ElMessage.warning(isBook.value ? t('publish.needTitle') : t('publish.needGoodsTitle'))
    return
  }
  if (!form.price) {
    ElMessage.warning(t('publish.needPrice'))
    return
  }
  submitting.value = true
  try {
    const fd = new FormData()
    fd.append('title', title)
    fd.append('category', form.category)
    fd.append('price', form.price)
    fd.append('condition', form.category === '租房' ? '' : form.condition)
    fd.append('delivery', form.delivery)
    fd.append('description', form.description)

    if (isBook.value) {
      fd.append('isbn', isbn.value)
      fd.append('bookTitle', title)
      fd.append('bookAuthor', form.bookAuthor)
      fd.append('bookPublisher', form.bookPublisher)
      fd.append('bookCover', bookInfo.value?.cover || '')
      fd.append('originalPrice', form.originalPrice || '')
      fd.append('edition', form.edition)
    }
    images.value.forEach((img) => fd.append('images', img))

    await productApi.create(fd)
    ElMessage.success(t('publish.success'))
    router.push({ path: '/trade', query: { category: form.category } })
  } finally {
    submitting.value = false
  }
}

// AI 对话里说"卖《XXX》"，会带着草稿跳到这里：把书籍信息填好，用户只需确认/填写售价
function applyPublishDraft(draft) {
  if (!draft) return
  isbn.value = draft.isbn || ''
  form.bookTitle = draft.bookTitle || ''
  form.bookAuthor = draft.bookAuthor || ''
  form.bookPublisher = draft.bookPublisher || ''
  form.edition = draft.edition || ''
  if (draft.price) form.price = Number(draft.price)
  if (draft.condition) form.condition = draft.condition
  form.category = isValidCategory(draft.category) ? draft.category : '图书'
  bookInfo.value = {
    cover: draft.bookCover || '',
    bookTitle: draft.bookTitle || '',
    bookAuthor: draft.bookAuthor || '',
    bookPublisher: draft.bookPublisher || ''
  }
  ElMessage.success({ message: t('ai.draftFilled'), duration: 2500 })
}

function onAiAction(e) {
  if (e.detail?.type === 'open_publish') applyPublishDraft(takeDraft(DRAFT_KEYS.publish) || e.detail.draft)
}

onMounted(() => {
  window.addEventListener('ai-action', onAiAction)
  // 从交易页带类目进来：发布表单直接锁定该类目
  const qCategory = route.query.category
  if (qCategory && isValidCategory(String(qCategory))) form.category = String(qCategory)
  if (route.query.from !== 'ai') return
  applyPublishDraft(takeDraft(DRAFT_KEYS.publish))
})

onUnmounted(() => {
  window.removeEventListener('ai-action', onAiAction)
})
</script>

<style scoped>
.isbn-section {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}
.isbn-row {
  display: flex;
  gap: 12px;
}
.isbn-tip {
  color: #999;
  font-size: 13px;
  margin-top: 8px;
}
.goods-tip {
  color: #607d8b;
  font-size: 13px;
  line-height: 1.7;
  margin: 0;
}
.cat-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.cat-picker :deep(.el-radio-button__inner) {
  border-radius: 10px;
  border-left: 1px solid var(--el-border-color);
}
.scan-book-preview {
  display: flex;
  gap: 14px;
  padding: 14px;
  background: #f9f9f9;
  border-radius: 8px;
  margin-bottom: 6px;
}
.scan-cover {
  width: 70px;
  height: 96px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}
.scan-book-text h3 {
  font-size: 16px;
  margin: 0 0 6px;
}
.scan-book-text p {
  color: #666;
  font-size: 13px;
  margin: 2px 0;
}
.publish-form {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  max-width: 600px;
}
.book-preview {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px;
  background: #f9f9f9;
  border-radius: 8px;
}
.book-cover {
  width: 80px;
  height: 110px;
  object-fit: cover;
  border-radius: 4px;
}
.book-info-text h3 {
  font-size: 18px;
  margin-bottom: 8px;
}
.book-info-text p {
  color: #666;
  font-size: 14px;
  margin-bottom: 4px;
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
.confirm-preview {
  display: flex;
  gap: 14px;
}
.cover-box {
  width: 110px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.cover-box .scan-cover {
  width: 100%;
  height: 146px;
}
.cover-empty {
  width: 110px;
  height: 146px;
  border-radius: 8px;
  background: #f0f4f8;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34px;
  color: #b0bec5;
}
.change-cover-btn {
  width: 100%;
}
.scan-edit {
  flex: 1;
  min-width: 0;
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
}
.confirm-tip {
  color: #f5a623;
  font-size: 12px;
  margin-top: 10px;
  text-align: center;
}

@media (max-width: 768px) {
  .publish-page {
    padding-bottom: 16px;
  }
  .isbn-row {
    flex-direction: column;
  }
  .book-preview {
    flex-direction: column;
    text-align: center;
    gap: 12px;
  }
  .book-preview .book-cover {
    margin: 0 auto;
  }
}
</style>