<template>
  <div class="publish-page">
    <h2 class="page-title">{{ $t('publish.title') }}</h2>

    <div class="isbn-section">
      <div class="isbn-row">
        <el-input v-model="isbn" :placeholder="$t('publish.isbnPlaceholder')" style="width: 300px" @keyup.enter="handleIsbnLookup" />
        <el-button type="primary" :loading="looking" @click="handleIsbnLookup">{{ $t('publish.autoDetect') }}</el-button>
        <el-button type="success" :loading="scanning" @click="openScan">{{ $t('publish.scanPhoto') }}</el-button>
        <input ref="scanInput" type="file" accept="image/*" style="display: none" @change="onScanFile" />
      </div>
      <p class="isbn-tip" v-if="!bookInfo">{{ $t('publish.isbnTip') }}</p>
    </div>

    <!-- 识别后设置价格弹窗 -->
    <el-dialog v-model="priceDialogVisible" :title="$t('publish.priceDialogTitle')" width="440px" :close-on-click-modal="false">
      <div class="scan-book-preview" v-if="scanBook">
        <img v-if="scanBook.cover" :src="scanBook.cover" class="scan-cover" @error="scanBook.cover = ''" />
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
      <div class="book-preview" v-if="bookInfo">
        <img :src="bookInfo.cover" v-if="bookInfo.cover" class="book-cover" @error="bookInfo.cover = ''" />
        <div class="book-info-text">
          <h3>{{ form.bookTitle }}</h3>
          <p>{{ $t('publish.authorPrefix') }}{{ form.bookAuthor }}</p>
          <p>{{ $t('publish.publisherPrefix') }}{{ form.bookPublisher }}</p>
          <p>{{ $t('publish.pricePrefix') }}¥{{ form.originalPrice }}</p>
        </div>
      </div>

      <el-form-item :label="$t('publish.bookTitle')">
        <el-input v-model="form.bookTitle" :placeholder="$t('publish.placeholderTitle')" />
      </el-form-item>
      <el-form-item :label="$t('publish.author')">
        <el-input v-model="form.bookAuthor" :placeholder="$t('publish.placeholderAuthor')" />
      </el-form-item>
      <el-form-item :label="$t('publish.publisher')">
        <el-input v-model="form.bookPublisher" :placeholder="$t('publish.placeholderPublisher')" />
      </el-form-item>
      <el-form-item :label="$t('publish.salePrice')">
        <el-input-number v-model="form.price" :min="0" :precision="2" />
      </el-form-item>
      <el-form-item :label="$t('publish.edition')">
        <el-input v-model="form.edition" :placeholder="$t('publish.editionPlaceholder')" style="width: 240px" />
      </el-form-item>
      <el-form-item :label="$t('publish.condition')">
        <el-select v-model="form.condition" style="width: 200px">
          <el-option :label="$t('publish.condNew')" value="全新" />
          <el-option :label="$t('publish.cond90')" value="九成新" />
          <el-option :label="$t('publish.cond80')" value="八成新" />
          <el-option :label="$t('publish.cond70')" value="七成新" />
          <el-option :label="$t('publish.condNormal')" value="一般" />
        </el-select>
      </el-form-item>
      <el-form-item :label="$t('home.category')">
        <el-select v-model="form.category" style="width: 200px">
          <el-option :label="$t('publish.catTextbook')" value="教材" />
          <el-option :label="$t('publish.catNovel')" value="小说" />
          <el-option :label="$t('publish.catKaoyan')" value="考研" />
          <el-option :label="$t('publish.catOther')" value="其他" />
        </el-select>
      </el-form-item>
      <el-form-item :label="$t('publish.deliverableLabel')">
        <el-radio-group v-model="form.delivery">
          <el-radio :value="true">{{ $t('common.deliverable') }}</el-radio>
          <el-radio :value="false">{{ $t('common.pickupOnly') }}</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item :label="$t('publish.description')">
        <el-input v-model="form.description" type="textarea" :rows="3" :placeholder="$t('publish.descriptionPlaceholder')" />
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

import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { bookApi, productApi } from '@/api'

const router = useRouter()
const isbn = ref('')
const looking = ref(false)
const scanning = ref(false)
const scanInput = ref(null)
const scanBook = ref(null)
const priceDialogVisible = ref(false)
const bookInfo = ref(null)
const submitting = ref(false)
const fileList = ref([])
const images = ref([])

const form = reactive({
  bookTitle: '',
  bookAuthor: '',
  bookPublisher: '',
  price: null,
  edition: '',
  condition: '九成新',
  category: '教材',
  delivery: true,
  description: '',
  originalPrice: 0
})

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
    bookInfo.value = book
    isbn.value = book.isbn || ''
    form.bookTitle = book.title || ''
    form.bookAuthor = book.author || ''
    form.bookPublisher = book.publisher || ''
    form.originalPrice = book.originalPrice || 0
    form.edition = book.edition || ''
    form.price = null
    form.description = ''
    priceDialogVisible.value = true
  } catch (err) {
    const msg = err?.response?.data?.message || t('publish.scanFail')
    ElMessage.warning({ message: msg, duration: 2500 })
  } finally {
    scanning.value = false
  }
}

async function handleSubmitFromDialog() {
  priceDialogVisible.value = false
  await handleSubmit()
}

async function handleSubmit() {
  if (!form.bookTitle) {
    ElMessage.warning(t('publish.needTitle'))
    return
  }
  if (!form.price) {
    ElMessage.warning(t('publish.needPrice'))
    return
  }
  submitting.value = true
  try {
    const fd = new FormData()
    fd.append('isbn', isbn.value)
    fd.append('bookTitle', form.bookTitle)
    fd.append('bookAuthor', form.bookAuthor)
    fd.append('bookPublisher', form.bookPublisher)
    fd.append('bookCover', bookInfo.value?.cover || '')
    fd.append('originalPrice', form.originalPrice || '')
    fd.append('price', form.price)
    fd.append('edition', form.edition)
    fd.append('delivery', form.delivery)
    fd.append('condition', form.condition)
    fd.append('category', form.category)
    fd.append('description', form.description)
    images.value.forEach((img) => fd.append('images', img))

    await productApi.create(fd)
    ElMessage.success(t('publish.success'))
    router.push('/trade')
  } finally {
    submitting.value = false
  }
}
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