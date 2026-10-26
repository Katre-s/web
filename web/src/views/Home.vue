<template>
  <div class="home">
    <!-- ===== 类目入口 ===== -->
    <section class="block">
      <div class="block-head">
        <div>
          <h2>{{ $t('home.exploreCats') }}</h2>
          <p>{{ $t('home.exploreCatsSub') }}</p>
        </div>
        <button class="head-link" @click="goTrade()">{{ $t('home.viewAll') }}<span>→</span></button>
      </div>
      <div class="cat-grid">
        <button
          v-for="(c, ci) in categories"
          :key="c.value"
          class="cat-card"
          :class="'cat-tone-' + ci"
          @click="goTrade(c.value)"
        >
          <span class="cat-watermark" aria-hidden="true">{{ c.icon }}</span>
          <span class="cat-emoji">{{ c.icon }}</span>
          <span class="cat-name">{{ $t('tradeCat.' + c.key) }}</span>
          <span class="cat-desc">{{ $t('tradeCatHint.' + c.key) }}</span>
        </button>
      </div>
    </section>

    <!-- ===== 未登录：推荐区换成登录引导 ===== -->
    <section class="block guest-rec" v-if="!userStore.isLoggedIn">
      <div class="guest-rec-card">
        <span class="guest-rec-emoji">🐟</span>
        <div class="guest-rec-text">
          <h2>{{ $t('home.guestRecTitle') }}</h2>
          <p>{{ $t('home.guestRecDesc') }}</p>
        </div>
        <el-button type="primary" round class="guest-rec-btn" @click="openAuthDialog('login', '/')">
          {{ $t('home.guestRecBtn') }}
        </el-button>
      </div>
    </section>

    <!-- ===== 推荐 ===== -->
    <section class="block" v-if="recs.items.length">
      <div class="block-head">
        <div>
          <h2>{{ $t('home.recommend') }}</h2>
          <p>{{ recommendSub }}</p>
        </div>
        <button class="head-link" @click="goTrade()">{{ $t('home.viewAll') }}<span>→</span></button>
      </div>

      <div class="rec-grid">
        <article
          v-for="p in recs.items"
          :key="p.id"
          class="rec-card"
          @click="openRec(p)"
        >
          <div class="rec-cover" :style="coverStyle(p.bookCover || p.images?.[0]?.imagePath)">
            <span class="rec-cat">{{ $t('tradeCat.' + categoryKey(p.category)) }}</span>
          </div>
          <div class="rec-info">
            <h3>{{ p.title || p.bookTitle }}</h3>
            <div class="rec-meta">
              <span class="rec-price">¥{{ p.price }}</span>
              <span class="rec-seller" v-if="p.seller?.campus">{{ p.seller.campus }}</span>
            </div>
          </div>
        </article>
      </div>
    </section>

    <!-- ===== 发布 CTA ===== -->
    <section class="cta">
      <div class="cta-fish"><BrandLogo :size="96" /></div>
      <div class="cta-text">
        <h3>{{ $t('home.ctaTitle') }}</h3>
        <p>{{ $t('home.ctaDesc') }}</p>
      </div>
      <button class="btn light" @click="goPublish">
        {{ $t('home.publishIdle') }}<span class="arrow">→</span>
      </button>
    </section>
  </div>
</template>

<script setup>import { useI18n } from 'vue-i18n'
const { t } = useI18n()

import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { recommendApi } from '@/api'
import { openAuthDialog } from '@/stores/authDialog'
import { thumb } from '@/utils/image'
import BrandLogo from '@/components/BrandLogo.vue'
import { TRADE_CATEGORIES, categoryKey } from '@/constants/categories'

const userStore = useUserStore()
const router = useRouter()
const categories = TRADE_CATEGORIES

/* ------------------------------ 推荐 ------------------------------ */
const recs = ref({ items: [], source: 'random', basis: { categories: [], keywords: [] } })
const recommendSub = computed(() => {
  const map = {
    llm: 'home.recommendSubLlm',
    rule: 'home.recommendSubRule',
    random: 'home.recommendSubRandom'
  }
  return t(map[recs.value.source] || map.random)
})

async function loadRecommend() {
  // 推荐接口要求登录态（后端 verifyToken）。游客跳过请求，
  // 否则首页一打开就是 401，会被弹登录窗打断浏览。
  if (!userStore.isLoggedIn) {
    recs.value = { items: [], source: 'random', basis: { categories: [], keywords: [] } }
    return
  }
  try {
    const res = await recommendApi.home({ limit: 8 })
    const data = res.data || {}
    recs.value = {
      items: Array.isArray(data.items) ? data.items : [],
      source: data.source || 'random',
      basis: data.basis || { categories: [], keywords: [] }
    }
  } catch {
    recs.value = { items: [], source: 'random', basis: { categories: [], keywords: [] } }
  }
}

function openRec(p) {
  if (!p?.id) return
  // 埋点接口要求登录态，游客点了不要触发 401
  if (userStore.isLoggedIn) {
    recommendApi
      .track({
        type: 'click',
        productId: p.id,
        category: p.category,
        keyword: p.title || p.bookTitle
      })
      .catch(() => {})
  }
  router.push(`/product/${p.id}`)
}

function coverStyle(cover) {
  const url = thumb(cover, 640)
  if (!url) return {}
  return { backgroundImage: `url("${url}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
}

function goTrade(category) {
  router.push(category ? { path: '/trade', query: { category } } : '/trade')
}

function goPublish() {
  router.push('/publish')
}

// 游客登录成功后，推荐区立刻补上，不用手动刷新
watch(
  () => userStore.isLoggedIn,
  (v) => {
    if (v) loadRecommend()
  }
)

onMounted(() => {
  loadRecommend()
})
</script>

<style scoped>
.home {
  padding-bottom: 36px;
  --ink: #0b2f3f;
  --ink-soft: #5d7b87;
  --pond: #1a90a0;
  --pond-deep: #10667a;
  --coral: #ff9a5a;
}

/* ================= 通用按钮 ================= */
.btn {
  height: 46px;
  padding: 0 26px;
  border-radius: 999px;
  font-size: 14.5px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.25s ease;
}
.btn.primary {
  position: relative;
  overflow: hidden;
  color: #fff;
  background: linear-gradient(135deg, #0e5568, #1a90a0 70%, #23a7a5);
  box-shadow: 0 14px 26px -12px rgba(16, 102, 122, 0.8);
}
/* 悬停时一道高光扫过按钮 */
.btn.primary::after {
  content: '';
  position: absolute;
  top: -20%;
  bottom: -20%;
  left: -70%;
  width: 45%;
  background: linear-gradient(105deg, transparent, rgba(255, 255, 255, 0.35), transparent);
  transform: skewX(-16deg);
  transition: left 0.55s var(--ease-smooth);
  pointer-events: none;
}
.btn.primary:hover::after {
  left: 135%;
}
.btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 32px -12px rgba(16, 102, 122, 0.9);
}
.btn.ghost {
  color: var(--pond-deep);
  background: rgba(255, 255, 255, 0.8);
  border-color: rgba(26, 144, 160, 0.24);
}
.btn.ghost:hover {
  background: #fff;
  border-color: var(--pond);
  transform: translateY(-2px);
}
.btn .arrow {
  transition: transform 0.25s;
}
.btn:hover .arrow {
  transform: translateX(4px);
}


/* ================= 通用区块 ================= */
.block {
  margin-bottom: 30px;
}
/* 游客引导卡：替代需要登录的推荐区 */
.guest-rec-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 22px 24px;
  border-radius: 18px;
  background: var(--card-bg, #fff);
  border: 1px dashed var(--accent-soft, rgba(66, 165, 245, 0.35));
  box-shadow: 0 10px 26px -18px rgba(13, 40, 71, 0.35);
}
.guest-rec-emoji {
  font-size: 34px;
  line-height: 1;
  flex-shrink: 0;
}
.guest-rec-text {
  flex: 1;
  min-width: 0;
}
.guest-rec-text h2 {
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: var(--text-main);
  margin-bottom: 4px;
}
.guest-rec-text p {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-sub, #78909c);
}
.guest-rec-btn {
  flex-shrink: 0;
  font-weight: 700;
  letter-spacing: 1px;
}
@media (max-width: 768px) {
  .guest-rec-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 18px;
  }
  .guest-rec-btn {
    width: 100%;
  }
}
.block-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.block-head h2 {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-main);
  letter-spacing: 1px;
}
.block-head p {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-sub);
}
.head-link {
  border: 0;
  background: transparent;
  font-family: inherit;
  font-size: 12.5px;
  color: var(--pond-deep);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 0;
}
.head-link span {
  transition: transform 0.22s;
}
.head-link:hover span {
  transform: translateX(3px);
}

/* 类目：专属渐变卡面 + 元素水印 + 3D 悬浮 */
.cat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: 12px;
}
.cat-card {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 14px 16px;
  border-radius: 18px;
  background: linear-gradient(135deg, var(--accent-soft), var(--accent-soft-2) 55%, transparent);
  border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: transform 0.35s var(--ease-spring), border-color 0.24s, box-shadow 0.35s;
  animation: rise 0.5s var(--ease-spring) backwards;
  transform-style: preserve-3d;
}
/* 每个类目一套专属渐变卡面 */
.cat-tone-0 { background: linear-gradient(135deg, rgba(66,165,245,.16), rgba(255,224,130,.12) 55%, transparent); }
.cat-tone-1 { background: linear-gradient(135deg, rgba(102,187,106,.16), rgba(255,224,130,.12) 55%, transparent); }
.cat-tone-2 { background: linear-gradient(135deg, rgba(38,198,218,.16), rgba(167,139,250,.14) 55%, transparent); }
.cat-tone-3 { background: linear-gradient(135deg, rgba(236,64,122,.14), rgba(66,165,245,.12) 55%, transparent); }
.cat-tone-4 { background: linear-gradient(135deg, rgba(0,150,136,.15), rgba(102,187,106,.12) 55%, transparent); }
.cat-tone-5 { background: linear-gradient(135deg, rgba(186,104,200,.15), rgba(255,183,77,.12) 55%, transparent); }
.cat-tone-6 { background: linear-gradient(135deg, rgba(141,110,99,.16), rgba(102,187,106,.12) 55%, transparent); }
.cat-tone-7 { background: linear-gradient(135deg, rgba(66,165,245,.14), rgba(167,139,250,.14) 55%, transparent); }
.cat-tone-8 { background: linear-gradient(135deg, rgba(255,152,0,.15), rgba(229,57,53,.12) 55%, transparent); }
.cat-card:nth-child(1) { animation-delay: 0.05s; }
.cat-card:nth-child(2) { animation-delay: 0.09s; }
.cat-card:nth-child(3) { animation-delay: 0.13s; }
.cat-card:nth-child(4) { animation-delay: 0.17s; }
.cat-card:nth-child(5) { animation-delay: 0.21s; }
.cat-card:nth-child(6) { animation-delay: 0.25s; }
.cat-card:nth-child(n + 7) { animation-delay: 0.29s; }
.cat-card:hover {
  transform: perspective(420px) translateY(-6px) rotateX(4deg) scale(1.03);
  border-color: var(--accent);
  box-shadow: 0 18px 36px -16px var(--accent-soft), 0 0 0 1px var(--accent-soft);
}
.cat-emoji {
  font-size: 24px;
  line-height: 1.3;
  position: relative;
  z-index: 2;
  transition: transform 0.35s var(--ease-spring);
}
.cat-card:hover .cat-emoji {
  transform: scale(1.28) rotate(-8deg) translateY(-2px);
}
/* 专属元素水印：卡片右上大号半透明元素，随主题柔和变化 */
.cat-watermark {
  position: absolute;
  right: -8px;
  top: -10px;
  font-size: 64px;
  opacity: 0.1;
  z-index: 1;
  pointer-events: none;
  transform: rotate(12deg);
  transition: transform 0.5s var(--ease-spring), opacity 0.3s;
  filter: saturate(1.1);
}
.cat-card:hover .cat-watermark {
  transform: rotate(0deg) scale(1.12);
  opacity: 0.2;
}
.cat-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
  position: relative;
  z-index: 2;
}
.cat-desc {
  font-size: 10.5px;
  color: var(--text-sub);
  position: relative;
  z-index: 2;
  opacity: 0.8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* 热销 */
.rec-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
.rec-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 18px;
  overflow: hidden;
  cursor: pointer;
  box-shadow: var(--card-shadow);
  transition: all 0.3s ease;
}
.rec-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 18px 34px -20px rgba(16, 102, 122, 0.55);
}
.rec-cover {
  position: relative;
  aspect-ratio: 4 / 3;
  background: linear-gradient(135deg, #e6f4f2, #d9edf3);
  background-size: cover;
  background-position: center;
}
.rec-cat {
  position: absolute;
  left: 10px;
  top: 10px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 10.5px;
  color: #fff;
  background: rgba(11, 47, 63, 0.55);
  backdrop-filter: blur(4px);
}
.rec-info {
  padding: 12px 14px 14px;
}
.rec-info h3 {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--text-main);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 40px;
}
.rec-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}
.rec-price {
  font-size: 17px;
  font-weight: 800;
  color: #e5484d;
}
.rec-seller {
  font-size: 11px;
  color: #9db2ba;
}

.hot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
.hot-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 18px;
  overflow: hidden;
  cursor: pointer;
  box-shadow: var(--card-shadow);
  transition: transform 0.3s var(--ease-spring), box-shadow 0.3s;
  animation: rise 0.5s var(--ease-spring) backwards;
}
.hot-card:nth-child(1) { animation-delay: 0.06s; }
.hot-card:nth-child(2) { animation-delay: 0.11s; }
.hot-card:nth-child(3) { animation-delay: 0.16s; }
.hot-card:nth-child(4) { animation-delay: 0.21s; }
.hot-card:nth-child(n + 5) { animation-delay: 0.26s; }
.hot-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 18px 34px -20px rgba(16, 102, 122, 0.55);
}
.hot-cover {
  position: relative;
  aspect-ratio: 4 / 3;
  background: linear-gradient(135deg, #e6f4f2, #d9edf3);
  background-size: cover;
  background-position: center;
  transition: transform 0.45s var(--ease-smooth);
}
.hot-card:hover .hot-cover {
  transform: scale(1.06);
}
.hot-rank {
  position: absolute;
  left: 10px;
  top: 10px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 10.5px;
  color: #fff;
  background: rgba(11, 47, 63, 0.55);
  backdrop-filter: blur(4px);
}
.hot-info {
  padding: 12px 14px 14px;
}
.hot-info h3 {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--text-main);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 40px;
}
.hot-author {
  margin-top: 4px;
  font-size: 11.5px;
  color: var(--text-sub);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hot-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}
.hot-price {
  font-size: 17px;
  font-weight: 800;
  color: #e5484d;
}
.hot-price em {
  font-style: normal;
  font-size: 10.5px;
  font-weight: 500;
  color: #9db2ba;
  margin-left: 2px;
}
.hot-price.empty {
  font-size: 11.5px;
  font-weight: 500;
  color: #9db2ba;
}
.hot-views {
  font-size: 11px;
  color: #9db2ba;
}

/* CTA */
@keyframes mascot-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
@keyframes rise {
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: translateY(0); }
}
.cta {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 26px 32px;
  border-radius: 24px;
  color: #f4fbfa;
  background:
    radial-gradient(70% 120% at 100% 0%, rgba(255, 154, 90, 0.35), transparent 60%),
    linear-gradient(120deg, #0b2f3f 0%, #0e4f61 60%, #126f7e 100%);
  box-shadow: 0 22px 44px -30px rgba(11, 47, 63, 0.9);
  animation: rise 0.5s var(--ease-smooth) 0.35s backwards;
}
.cta-fish {
  flex-shrink: 0;
  opacity: 0.95;
  animation: mascot-float 7s ease-in-out infinite;
}
.cta-text {
  flex: 1;
  min-width: 0;
}
.cta-text h3 {
  font-size: 19px;
  font-weight: 800;
  letter-spacing: 1px;
}
.cta-text p {
  margin-top: 5px;
  font-size: 12.5px;
  color: rgba(244, 251, 250, 0.62);
}
.btn.light {
  flex-shrink: 0;
  color: #0b2f3f;
  background: #fff;
  box-shadow: 0 10px 24px -12px rgba(0, 0, 0, 0.5);
}
.btn.light:hover {
  transform: translateY(-2px);
  background: #fff7ee;
}

/* ================= 响应式 ================= */
@media (max-width: 768px) {
  .btn {
    height: 42px;
    padding: 0 18px;
    font-size: 13.5px;
    flex: 1;
    justify-content: center;
  }
  .block {
    margin-bottom: 22px;
  }
  .block-head {
    margin-bottom: 12px;
  }
  .block-head h2 {
    font-size: 17px;
  }
  .cat-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .cat-card {
    padding: 10px 10px 11px;
    border-radius: 14px;
    gap: 2px;
  }
  .cat-emoji {
    font-size: 20px;
  }
  .cat-name {
    font-size: 12.5px;
  }
  .cat-desc {
    display: none;
  }
  .hot-grid,
  .rec-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  .hot-info {
    padding: 10px 12px 12px;
  }
  .hot-info h3 {
    font-size: 13px;
    min-height: 36px;
  }
  .hot-price {
    font-size: 15px;
  }
  .cta {
    flex-direction: column;
    align-items: flex-start;
    padding: 22px;
    gap: 12px;
    border-radius: 20px;
  }
  .cta-fish {
    order: 2;
    align-self: flex-end;
    margin-top: -34px;
    opacity: 0.9;
  }
  .btn.light {
    width: 100%;
    justify-content: center;
  }
}
</style>
