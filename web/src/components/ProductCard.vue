<template>
  <div class="product-card" @click="goDetail">
    <div class="card-image">
      <img :src="coverImg" :alt="product.title" loading="lazy" decoding="async" />
      <span class="status-tag" v-if="product.status === 'sold'">{{ $t('common.sold') }}</span>
    </div>
    <div class="card-body">
      <h3 class="card-title">{{ product.title || product.bookTitle }}</h3>
      <p class="card-author" v-if="product.bookAuthor">{{ product.bookAuthor }}</p>
      <div class="card-footer">
        <span class="card-price">¥{{ product.price }}</span>
        <span class="card-condition">{{ product.condition }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { resolveImg } from '@/utils/image'

const props = defineProps({ product: { type: Object, required: true } })
const router = useRouter()
const defaultImg = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23eee" width="200" height="200"/><text x="50%" y="50%" fill="%23aaa" text-anchor="middle" dy=".3em" font-size="14">暂无图片</text></svg>'

// 后端返回的封面字段是 bookCover，images 数组元素是 { imagePath } 对象，需兼容取图
// resolveImg: /uploads/ 相对路径拼 API 源，保证手机端(App壳/跨域)也能显示
const coverImg = computed(() => {
  const p = props.product
  const first = p.images?.[0]
  const firstPath = typeof first === 'string' ? first : first?.imagePath
  return resolveImg(p.cover || p.bookCover || firstPath) || defaultImg
})

function goDetail() {
  router.push(`/product/${props.product.id}`)
}
</script>

<style scoped>
.product-card {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.product-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}
.card-image {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  background: #f0f0f0;
}
.card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.status-tag {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}
.card-body {
  padding: 12px;
}
.card-title {
  font-size: 15px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
}
.card-author {
  font-size: 13px;
  color: #999;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card-price {
  color: #e53935;
  font-size: 18px;
  font-weight: 700;
}
.card-condition {
  font-size: 12px;
  color: #999;
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 4px;
}
</style>