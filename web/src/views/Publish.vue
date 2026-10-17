<template>
  <div class="publish-page">
    <h2 class="page-title">发布书籍</h2>

    <div class="isbn-section">
      <div class="isbn-row">
        <el-input v-model="isbn" placeholder="输入 ISBN 号（选填）" style="width: 300px" @keyup.enter="handleIsbnLookup" />
        <el-button type="primary" :loading="looking" @click="handleIsbnLookup">一键识别</el-button>
      </div>
      <p class="isbn-tip" v-if="!bookInfo">输入 ISBN 后自动填充书籍信息，也可跳过直接手动填写</p>
    </div>

    <el-form :model="form" label-position="top" class="publish-form">
      <div class="book-preview" v-if="bookInfo">
        <img :src="bookInfo.cover" v-if="bookInfo.cover" class="book-cover" @error="bookInfo.cover = ''" />
        <div class="book-info-text">
          <h3>{{ form.bookTitle }}</h3>
          <p>作者：{{ form.bookAuthor }}</p>
          <p>出版社：{{ form.bookPublisher }}</p>
          <p>定价：¥{{ form.originalPrice }}</p>
        </div>
      </div>

      <el-form-item label="书名 *">
        <el-input v-model="form.bookTitle" placeholder="请输入书名" />
      </el-form-item>
      <el-form-item label="作者">
        <el-input v-model="form.bookAuthor" placeholder="请输入作者" />
      </el-form-item>
      <el-form-item label="出版社">
        <el-input v-model="form.bookPublisher" placeholder="请输入出版社" />
      </el-form-item>
      <el-form-item label="售价 *">
        <el-input-number v-model="form.price" :min="0" :precision="2" />
      </el-form-item>
      <el-form-item label="版本号">
        <el-input v-model="form.edition" placeholder="如：第3版" style="width: 240px" />
      </el-form-item>
      <el-form-item label="成色">
        <el-select v-model="form.condition" style="width: 200px">
          <el-option label="全新" value="全新" />
          <el-option label="九成新" value="九成新" />
          <el-option label="八成新" value="八成新" />
          <el-option label="七成新" value="七成新" />
          <el-option label="一般" value="一般" />
        </el-select>
      </el-form-item>
      <el-form-item label="分类">
        <el-select v-model="form.category" style="width: 200px">
          <el-option label="教材" value="教材" />
          <el-option label="小说" value="小说" />
          <el-option label="考研" value="考研" />
          <el-option label="其他" value="其他" />
        </el-select>
      </el-form-item>
      <el-form-item label="是否可配送">
        <el-radio-group v-model="form.delivery">
          <el-radio :value="true">可配送</el-radio>
          <el-radio :value="false">仅自提</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="form.description" type="textarea" :rows="3" placeholder="补充书籍描述（可选）" />
      </el-form-item>
      <el-form-item label="实物图片">
        <el-upload list-type="picture-card" accept="image/*" :auto-upload="false" :on-change="onImagesChange" :file-list="fileList">
          <el-icon><Plus /></el-icon>
        </el-upload>
      </el-form-item>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">发布上架</el-button>
    </el-form>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { bookApi, productApi } from '@/api'

const router = useRouter()
const isbn = ref('')
const looking = ref(false)
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
    ElMessage.warning({ message: '请输入 ISBN', duration: 1200 })
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
    ElMessage.success({ message: '识别成功', duration: 1200 })
  } catch (err) {
    ElMessage.warning({ message: '未找到ISBN信息，请手动填写书籍信息', duration: 2000 })
  } finally {
    looking.value = false
  }
}

function onImagesChange(file, fileList) {
  images.value = fileList.map((f) => f.raw)
}

async function handleSubmit() {
  if (!form.bookTitle) {
    ElMessage.warning('请填写书名')
    return
  }
  if (!form.price) {
    ElMessage.warning('请填写售价')
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
    ElMessage.success('发布成功')
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