<template>
  <div class="booklist-page">
    <h2 class="page-title">上传书单</h2>
    <div class="upload-card">
      <p class="upload-desc">输入ISBN列表（每行一个），系统将自动处理：</p>
      <ul class="upload-rules">
        <li>有卖家的书 → 自动加入购物车</li>
        <li>无卖家的板块 → 加入求购清单</li>
        <li>无板块的ISBN → 自动创建板块并加入求购清单</li>
      </ul>
      <el-input
        v-model="isbnText"
        type="textarea"
        :rows="12"
        placeholder="请输入ISBN，每行一个&#10;例如：&#10;9787111407010&#10;9787302529135&#10;9787564172220"
        class="isbn-input"
      />
      <div class="upload-actions">
        <el-button type="primary" round size="large" @click="processList" :loading="processing" :disabled="!isbnText.trim()">
          开始处理
        </el-button>
        <el-button round size="large" @click="isbnText = ''">清空</el-button>
      </div>
    </div>

    <div v-if="result" class="result-card">
      <h3 class="result-title">处理结果</h3>
      <div class="result-stats">
        <div class="result-stat stat-cart">
          <div class="stat-icon">🛒</div>
          <div class="stat-num">{{ result.stats.cart }}</div>
          <div class="stat-label">加入购物车</div>
        </div>
        <div class="result-stat stat-wishlist">
          <div class="stat-icon">📝</div>
          <div class="stat-num">{{ result.stats.wishlist }}</div>
          <div class="stat-label">加入求购清单</div>
        </div>
        <div class="result-stat stat-created">
          <div class="stat-icon">📚</div>
          <div class="stat-num">{{ result.stats.created }}</div>
          <div class="stat-label">新建板块</div>
        </div>
        <div class="result-stat stat-skipped">
          <div class="stat-icon">⏭</div>
          <div class="stat-num">{{ result.stats.skipped }}</div>
          <div class="stat-label">跳过（无效）</div>
        </div>
      </div>

      <div v-if="result.cartBooks && result.cartBooks.length" class="result-section">
        <h4 class="section-subtitle">已加入购物车的书</h4>
        <div class="book-tags">
          <el-tag v-for="b in result.cartBooks" :key="b.isbn" type="success" class="book-tag">
            {{ b.bookTitle }}（{{ b.sellerCount }}卖家）
          </el-tag>
        </div>
      </div>

      <div v-if="result.wishlistBooks && result.wishlistBooks.length" class="result-section">
        <h4 class="section-subtitle">已加入求购清单的书</h4>
        <div class="book-tags">
          <el-tag v-for="b in result.wishlistBooks" :key="b.isbn" type="warning" class="book-tag">
            {{ b.bookTitle || `ISBN ${b.isbn}` }}
          </el-tag>
        </div>
      </div>

      <div class="result-actions">
        <el-button type="primary" round @click="$router.push('/cart')">查看购物车</el-button>
        <el-button round @click="$router.push('/profile')">查看求购清单</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { bookApi } from '@/api'

const isbnText = ref('')
const processing = ref(false)
const result = ref(null)

async function processList() {
  const lines = isbnText.value.split('\n').map(l => l.trim()).filter(l => l)
  if (!lines.length) return ElMessage.warning('请输入至少一个ISBN')

  const isbns = []
  for (const line of lines) {
    const cleaned = line.replace(/[-\s]/g, '')
    if (/^\d{10,14}$/.test(cleaned)) {
      isbns.push(cleaned)
    }
  }
  if (!isbns.length) return ElMessage.warning('未识别到有效的ISBN（10-14位数字）')

  processing.value = true
  try {
    const res = await bookApi.processBookList(isbns)
    result.value = res.data
    ElMessage.success(res.message || '处理完成')
  } catch {} finally {
    processing.value = false
  }
}
</script>

<style scoped>
.booklist-page {
  max-width: 800px;
  margin: 0 auto;
}
.page-title {
  font-size: 24px;
  font-weight: 700;
  color: #0d2847;
  margin-bottom: 24px;
}
.upload-card {
  background: #fff;
  border-radius: 16px;
  padding: 28px 32px;
  box-shadow: 0 2px 12px rgba(13, 40, 71, 0.06);
  margin-bottom: 24px;
}
.upload-desc {
  font-size: 15px;
  color: #37474f;
  margin-bottom: 12px;
}
.upload-rules {
  margin-bottom: 20px;
  padding-left: 20px;
  color: #78909c;
  font-size: 14px;
  line-height: 2;
}
.isbn-input {
  margin-bottom: 20px;
}
.upload-actions {
  display: flex;
  gap: 12px;
}
.result-card {
  background: #fff;
  border-radius: 16px;
  padding: 28px 32px;
  box-shadow: 0 2px 12px rgba(13, 40, 71, 0.06);
}
.result-title {
  font-size: 20px;
  font-weight: 700;
  color: #0d2847;
  margin-bottom: 20px;
}
.result-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}
.result-stat {
  flex: 1;
  min-width: 120px;
  background: #f8f9fb;
  border-radius: 12px;
  padding: 20px 16px;
  text-align: center;
}
.stat-icon {
  font-size: 32px;
  margin-bottom: 8px;
}
.stat-num {
  font-size: 28px;
  font-weight: 700;
  color: #0d2847;
}
.stat-label {
  font-size: 13px;
  color: #78909c;
  margin-top: 4px;
}
.stat-cart { background: rgba(76, 175, 80, 0.08); }
.stat-wishlist { background: rgba(255, 152, 0, 0.08); }
.stat-created { background: rgba(33, 150, 243, 0.08); }
.stat-skipped { background: rgba(158, 158, 158, 0.08); }
.result-section {
  margin-bottom: 20px;
}
.section-subtitle {
  font-size: 16px;
  font-weight: 600;
  color: #37474f;
  margin-bottom: 12px;
}
.book-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.book-tag {
  padding: 8px 14px;
}
.result-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

@media (max-width: 768px) {
  .result-actions {
    flex-wrap: wrap;
    margin-top: 16px;
  }
  .result-actions .el-button {
    flex: 1;
    min-width: 120px;
    margin-left: 0 !important;
  }
  .book-tag {
    padding: 6px 10px;
    font-size: 13px;
  }
}
</style>