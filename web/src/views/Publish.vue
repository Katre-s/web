<template>
  <div class="publish-page">
    <h2 class="page-title">发布书籍</h2>

    <div class="isbn-section">
      <div class="isbn-row">
        <el-input v-model="isbn" placeholder="输入 ISBN 号" style="width: 300px" @keyup.enter="handleIsbnLookup" />
        <el-button type="primary" :loading="looking" @click="handleIsbnLookup">一键识别</el-button>
      </div>
      <p class="isbn-tip" v-if="!bookInfo">输入 ISBN 后自动填充书籍信息，只需补充售价和实物图片</p>
    </div>

    <el-form :model="form" label-position="top" v-if="bookInfo" class="publish-form">
      <div class="book-preview">
        <img :src="bookInfo.cover" v-if="bookInfo.cover" class="book-cover" />
        <div class="book-info-text">
          <h3>{{ bookInfo.title }}</h3>
          <p>作者：{{ bookInfo.author }}</p>
          <p>出版社：{{ bookInfo.publisher }}</p>
          <p>定价：¥{{ bookInfo.originalPrice }}</p>
        </div>
      </div>

      <el-form-item label="售价">
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
import { ref } from 'vue'
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

const form = ref({
  price: null,
  edition: '',
  condition: '九成新',
  category: '教材',
  delivery: true,
  description: ''
})

async function handleIsbnLookup() {
  if (!isbn.value) {
    ElMessage.warning('请输入 ISBN')
    return
  }
  looking.value = true
  try {
    const res = await bookApi.isbnLookup(isbn.value)
    bookInfo.value = res.data || res
    ElMessage.success('识别成功')
  } finally {
    looking.value = false
  }
}

function onImagesChange(file, fileList) {
  images.value = fileList.map((f) => f.raw)
}

async function handleSubmit() {
  if (!form.value.price) {
    ElMessage.warning('请填写售价')
    return
  }
  submitting.value = true
  try {
    const fd = new FormData()
    fd.append('isbn', isbn.value)
    fd.append('bookTitle', bookInfo.value.title)
    fd.append('bookAuthor', bookInfo.value.author)
    fd.append('bookPublisher', bookInfo.value.publisher)
    fd.append('bookCover', bookInfo.value.cover || '')
    fd.append('originalPrice', bookInfo.value.originalPrice || '')
    fd.append('price', form.value.price)
    fd.append('edition', form.value.edition)
    fd.append('delivery', form.value.delivery)
    fd.append('condition', form.value.condition)
    fd.append('category', form.value.category)
    fd.append('description', form.value.description)
    images.value.forEach((img) => fd.append('images', img))

    await productApi.create(fd)
    ElMessage.success('发布成功')
    router.push('/')
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
</style>