<template>
  <div class="home">
    <div class="search-bar">
      <el-input v-model="keyword" placeholder="搜索书名、作者、ISBN" clearable @keyup.enter="loadProducts" style="width: 400px" />
      <el-button type="primary" @click="loadProducts">搜索</el-button>
      <el-button @click="showImportDialog = true">导入书单</el-button>
    </div>

    <div class="filter-row">
      <el-select v-model="category" placeholder="全部分类" clearable @change="loadProducts" style="width: 140px">
        <el-option label="教材" value="教材" />
        <el-option label="小说" value="小说" />
        <el-option label="考研" value="考研" />
        <el-option label="其他" value="其他" />
      </el-select>
      <el-select v-model="sort" @change="loadProducts" style="width: 140px">
        <el-option label="最新发布" value="newest" />
        <el-option label="价格最低" value="price_asc" />
        <el-option label="价格最高" value="price_desc" />
      </el-select>
    </div>

    <div v-loading="loading">
      <div class="product-grid" v-if="products.length">
        <ProductCard v-for="p in products" :key="p.id" :product="p" />
      </div>
      <el-empty v-else description="暂无商品" />
    </div>

    <el-dialog v-model="showImportDialog" title="导入书单" width="520px">
      <el-tabs v-model="importTab">
        <el-tab-pane label="上传图片" name="image">
          <el-upload drag accept="image/*" :auto-upload="false" :on-change="onFileChange">
            <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
            <div class="el-upload__text">拖拽书单图片到此处，或<em>点击上传</em></div>
          </el-upload>
        </el-tab-pane>
        <el-tab-pane label="粘贴文本" name="text">
          <el-input v-model="booklistText" type="textarea" :rows="8" placeholder="粘贴书单文字，每行一本书" />
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <el-button @click="showImportDialog = false">取消</el-button>
        <el-button type="primary" :loading="parsing" @click="handleParseList">解析并匹配</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showMatchDialog" title="书单匹配结果" width="600px">
      <div v-if="matchedProducts.length">
        <h4>已匹配 ({{ matchedProducts.length }} 本)</h4>
        <div class="match-list">
          <div v-for="p in matchedProducts" :key="p.id" class="match-item">
            <span>{{ p.title || p.bookTitle }} - {{ p.bookAuthor }}</span>
            <span class="match-price">¥{{ p.price }}</span>
          </div>
        </div>
      </div>
      <div v-if="unmatchedBooks.length" style="margin-top: 16px">
        <h4>未匹配 ({{ unmatchedBooks.length }} 本)</h4>
        <div class="match-list">
          <div v-for="(b, i) in unmatchedBooks" :key="i" class="match-item unmatched">
            <span>{{ b.title || b.isbn }} - 暂无在售</span>
            <el-button size="small" @click="addToWishlist(b)">求购</el-button>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showMatchDialog = false">关闭</el-button>
        <el-button type="primary" v-if="matchedProducts.length" @click="batchAddToCart">全部加入购物车</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import ProductCard from '@/components/ProductCard.vue'
import { productApi, bookApi, cartApi, wishlistApi } from '@/api'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const keyword = ref('')
const category = ref('')
const sort = ref('newest')
const products = ref([])
const loading = ref(false)

const showImportDialog = ref(false)
const importTab = ref('image')
const uploadFile = ref(null)
const booklistText = ref('')
const parsing = ref(false)

const showMatchDialog = ref(false)
const matchedProducts = ref([])
const unmatchedBooks = ref([])

async function loadProducts() {
  loading.value = true
  try {
    const res = await productApi.list({ keyword: keyword.value, category: category.value, sort: sort.value })
    products.value = res.data || res || []
  } finally {
    loading.value = false
  }
}

function onFileChange(file) {
  uploadFile.value = file.raw
}

async function handleParseList() {
  parsing.value = true
  try {
    let parsed
    if (importTab.value === 'image' && uploadFile.value) {
      const fd = new FormData()
      fd.append('image', uploadFile.value)
      parsed = await bookApi.parseList(fd)
    } else if (importTab.value === 'text' && booklistText.value) {
      const fd = new FormData()
      fd.append('text', booklistText.value)
      parsed = await bookApi.parseList(fd)
    } else {
      ElMessage.warning('请上传图片或粘贴文本')
      return
    }
    const bookList = parsed.books || parsed || []
    const matchRes = await bookApi.match(bookList)
    matchedProducts.value = matchRes.matched || []
    unmatchedBooks.value = matchRes.unmatched || []
    showImportDialog.value = false
    showMatchDialog.value = true
  } finally {
    parsing.value = false
  }
}

async function batchAddToCart() {
  const ids = matchedProducts.value.map((p) => p.id)
  await cartApi.batchAdd(ids)
  ElMessage.success('已加入购物车')
  showMatchDialog.value = false
}

async function addToWishlist(book) {
  await wishlistApi.add(book)
  ElMessage.success('已加入求购清单')
}

onMounted(loadProducts)
</script>

<style scoped>
.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.filter-row {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}
.match-list {
  max-height: 300px;
  overflow-y: auto;
}
.match-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}
.match-price {
  color: #e53935;
  font-weight: 600;
}
.match-item.unmatched span {
  color: #999;
}
</style>