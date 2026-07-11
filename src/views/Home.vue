<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { getCategoryTree } from '@/api/categories'
import {
  getGoodsPage,
  getRecommendGoods,
  toggleFavorite,
  tradeMethodText,
  conditionLevelText,
} from '@/api/goods'
import TopNavbar from '@/components/TopNavbar.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import {
  View,
  StarFilled,
  ShoppingCart,
  Sort,
  ArrowRight,
  ArrowLeft,
  Star,
  Sunny,
  MagicStick,
  TrendCharts,
} from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

// ============ 状态 ============
const activeCategory = ref('all') // 'all' | <categoryId>
const searchKeyword = ref('')
const loading = ref(false)

// ============ 排序 ============
// recommend: 智能推荐（ItemCF，未登录 fallback 到 hotList）
// latest:    最新发布
// sales_count: 销量优先
// hot:       综合热度榜（后端 page 已支持 sortType=hot 分页）
// price_asc / price_desc: 价格升降序
const sortOptions = [
  { key: 'recommend', label: '智能推荐', icon: MagicStick },
  { key: 'latest', label: '最新发布', icon: Sunny },
  { key: 'sales_count', label: '销量优先', icon: TrendCharts },
  { key: 'hot', label: '综合热度', icon: Sort },
  { key: 'price_asc', label: '价格 ↑', icon: Sort },
  { key: 'price_desc', label: '价格 ↓', icon: Sort },
]
const sortKey = ref('hot')

// sortKey -> 后端 sortType + orderDesc 映射
// recommend 走 getRecommendGoods（不分页），不进这个表
const SORT_MAP = {
  latest: { sortType: 'create_time', orderDesc: true },
  sales_count: { sortType: 'sales_count', orderDesc: true },
  hot: { sortType: 'hot', orderDesc: true },
  price_asc: { sortType: 'price', orderDesc: false },
  price_desc: { sortType: 'price', orderDesc: true },
}

// ============ 渐变占位（商品 cover 缺失时使用）============
const palettes = [
  ['#ff8c5a', '#ff6b35'],
  ['#5b8def', '#4f7ce0'],
  ['#52c41a', '#389e0d'],
  ['#722ed1', '#531dab'],
  ['#13c2c2', '#08979c'],
  ['#fa8c16', '#d46b08'],
  ['#eb2f96', '#c41d7f'],
  ['#2f54eb', '#1d39c4'],
  ['#a0d911', '#7cb305'],
  ['#f5222d', '#cf1322'],
  ['#fa541c', '#d4380d'],
  ['#1890ff', '#096dd9'],
]
const visualForId = (id) => {
  const n = Number(id) || 0
  const [bg1, bg2] = palettes[n % palettes.length]
  return { bg1, bg2 }
}

const getCoverStyle = (p) => {
  if (p?.cover || p?.images?.length) {
    return { background: '#f5f7fa' }
  }
  const v = visualForId(p?.id)
  return { background: `linear-gradient(135deg, ${v.bg1} 0%, ${v.bg2} 100%)` }
}

// 推荐原因角标：标题过长时截断到 8 字 + 省略号，避免角标溢出
const truncateReason = (title) => {
  if (!title) return ''
  return title.length > 8 ? title.slice(0, 8) + '…' : title
}

// ============ 监听 query.keyword 同步搜索词 ============
watch(
  () => route.query.keyword,
  (kw) => {
    const next = kw ? String(kw) : ''
    if (next !== searchKeyword.value) {
      searchKeyword.value = next
      if (next) {
        ElMessage.info(`搜索关键词：${next}`)
        setTimeout(() => {
          document
            .querySelector('.home-main')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 100)
      }
    }
  },
  { immediate: true }
)

// ============ 为你推荐（ItemCF，未登录 fallback 后端会自动走 hotList）============
const recommendList = ref([])
const recommendLoading = ref(false)
const recommendRail = ref(null)
const loadRecommend = async () => {
  recommendLoading.value = true
  try {
    // 后端 recommendService.recommend() 对 null uid 会返回 hotList，
    // 所以这里直接传，未登录也能拿到热卖商品作为兜底。
    const list = await getRecommendGoods({ topN: 12 })
    recommendList.value = Array.isArray(list) ? list : []
  } catch {
    recommendList.value = []
  } finally {
    recommendLoading.value = false
  }
}

// ============ 分类（取一级 + 二级，平铺为 chips）============
const categories = ref([])
const loadCategories = async () => {
  try {
    const tree = await getCategoryTree()
    const flat = []
    if (Array.isArray(tree)) {
      tree.forEach((p) => {
        if (p?.id != null) {
          flat.push({ id: p.id, name: p.name, parentId: 0 })
          if (Array.isArray(p.children)) {
            p.children.forEach((c) => {
              if (c?.id != null) flat.push({ id: c.id, name: c.name, parentId: p.id })
            })
          }
        }
      })
    }
    categories.value = flat
  } catch {
    categories.value = []
  }
}

// ============ 主商品列表 ============
const products = ref([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(12)
// 智能推荐（ItemCF）走的是 topN，没有 total 概念，隐藏分页
const showPagination = computed(() => sortKey.value !== 'recommend')

// 空状态文案：根据当前是否有分类/关键词过滤给出更精准的提示
const emptyProductsMessage = computed(() => {
  const hasFilter =
    activeCategory.value !== 'all' || searchKeyword.value.trim() !== ''
  if (hasFilter) {
    return '当前筛选条件下没有匹配的商品，试试切换排序或清除筛选'
  }
  return '暂无商品'
})

const loadProducts = async () => {
  loading.value = true
  try {
    // 智能推荐：ItemCF 没分页，按需拉候选 + 客户端过滤
    if (sortKey.value === 'recommend') {
      const kw = searchKeyword.value.trim()
      const catId = activeCategory.value !== 'all' ? activeCategory.value : null
      // 有分类/关键词过滤时拉更大候选池，过滤后再截到 pageSize
      // 上限对齐后端 userTopN（已扩到 50）
      const needsFilter = !!catId || !!kw
      const topN = needsFilter ? Math.min(50, pageSize.value * 3) : pageSize.value
      const list = await getRecommendGoods({ topN })

      let filtered = Array.isArray(list) ? list : []
      if (catId != null) {
        filtered = filtered.filter((p) => p.categoryId === catId)
      }
      if (kw) {
        const lower = kw.toLowerCase()
        filtered = filtered.filter(
          (p) =>
            (p.title && p.title.toLowerCase().includes(lower)) ||
            (p.description && p.description.toLowerCase().includes(lower))
        )
      }
      products.value = filtered.slice(0, pageSize.value)
      total.value = products.value.length
      return
    }

    // 其他排序：走 page 接口
    const { sortType, orderDesc } = SORT_MAP[sortKey.value] || SORT_MAP.latest
    const params = {
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      saleStatus: 1,
      auditStatus: 1,
      sortType,
      orderDesc,
    }
    const kw = searchKeyword.value.trim()
    if (kw) params.keyword = kw
    if (activeCategory.value !== 'all') params.categoryId = activeCategory.value
    const res = await getGoodsPage(params)
    products.value = res?.records || []
    total.value = res?.total || 0
  } catch {
    products.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

// 监听：分类 / 排序 / 搜索词变更都把页码重置到 1
watch(activeCategory, () => { pageNum.value = 1 })
watch(sortKey, () => { pageNum.value = 1 })
watch(searchKeyword, () => { pageNum.value = 1 })
// 实际触发加载
watch([activeCategory, sortKey, searchKeyword, pageNum], () => {
  loadProducts()
})

onMounted(async () => {
  await Promise.all([loadCategories(), loadRecommend(), loadProducts()])
})

// ============ 操作 ============
const handleCategoryClick = (cat) => {
  activeCategory.value = cat.id === 'all' ? 'all' : cat.id
  if (route.query.keyword) {
    const { keyword, ...rest } = route.query
    router.replace({ path: route.path, query: rest })
  }
}

const goDetail = (p) => {
  if (!p?.id) return
  if (!userStore.isLoggedIn) {
    ElMessage.warning('查看商品详情需要登录')
    router.push({ path: '/login', query: { redirect: `/user-home/product-detail/${p.id}` } })
    return
  }
  router.push(`/user-home/product-detail/${p.id}`)
}

const handleToggleFavorite = async (p, e) => {
  if (e) e.stopPropagation()
  if (!userStore.isLoggedIn) {
    ElMessage.warning('请先登录')
    router.push('/login')
    return
  }
  if (!p?.id) return
  if (p.sellerId && userStore.userInfo?.id === p.sellerId) {
    ElMessage.warning('不能收藏自己的商品')
    return
  }
  try {
    const res = await toggleFavorite(p.id)
    const favorited = res?.favorited ?? res?.status === 'added'
    if (typeof p.favoriteCount === 'number') {
      p.favoriteCount = Math.max(0, p.favoriteCount + (favorited ? 1 : -1))
    }
    ElMessage.success(favorited ? '已收藏' : '已取消收藏')
  } catch (err) {
    ElMessage.error(err?.message || '操作失败')
  }
}

const isLoggedIn = computed(() => userStore.isLoggedIn)

// ============ 横向滚动条控制 ============
// 模板里传 ref 时 Vue 会自动 unwrap，所以这里接收的就是 DOM 元素本身
const CARD_WIDTH = 280
const CARD_GAP = 16
const scrollRail = (el, dir) => {
  if (!el) return
  const step = (CARD_WIDTH + CARD_GAP) * 2
  el.scrollBy({ left: dir * step, behavior: 'smooth' })
}

// 为你推荐区标题：固定"猜你喜欢"，副标题说明数据来源
const recommendTitle = '✨ 猜你喜欢'
const recommendSubtitle = computed(() =>
  isLoggedIn.value
    ? '基于你的浏览、收藏行为智能推荐'
    : '未登录状态下展示热门商品，登录后可获得个性化推荐'
)
</script>

<template>
  <div class="home-page">
    <TopNavbar />

    <!-- ============ 为你推荐（ItemCF，游客态 fallback 热卖） ============ -->
    <section class="rail-section recommend-section">
      <div class="rail-inner">
        <div class="rail-header">
          <h3 class="rail-title">
            <el-icon class="title-icon"><MagicStick /></el-icon>
            {{ recommendTitle }}
          </h3>
          <span class="rail-subtitle">{{ recommendSubtitle }}</span>
        </div>
        <div class="rail-wrapper">
          <button class="rail-arrow rail-arrow-left" @click="scrollRail(recommendRail, -1)">
            <el-icon><ArrowLeft /></el-icon>
          </button>
          <div ref="recommendRail" class="rail-track" v-loading="recommendLoading">
            <div
              v-for="r in recommendList"
              :key="r.id"
              class="recommend-card"
              @click="goDetail(r)"
            >
              <div class="recommend-cover" :style="getCoverStyle(r)">
                <img
                  v-if="r.cover || (r.images && r.images.length)"
                  :src="r.cover || r.images[0]"
                  class="cover-img"
                  @error="(e) => (e.target.style.display = 'none')"
                />
                <span
                  v-if="(r.stock ?? r.quantity ?? 0) <= 2"
                  class="stock-badge"
                >仅剩{{ r.stock ?? r.quantity }}件</span>
                <!-- 成色 + 交易方式 chip：与 stock-badge 错位（左下↔左上↔右上） -->
                <div class="info-chip-row">
                  <span v-if="r.conditionLevel != null" class="info-chip condition-chip">
                    {{ conditionLevelText(r.conditionLevel) }}
                  </span>
                  <span v-if="r.tradeMethod" class="info-chip trade-chip">
                    {{ tradeMethodText(r.tradeMethod) }}
                  </span>
                </div>
                <!-- 推荐原因角标：登录态 + 有 history 时由后端写入 reasonTitle -->
                <span
                  v-if="r.reasonTitle"
                  class="reason-badge"
                  :title="`因为浏览过《${r.reasonTitle}》`"
                >
                  <el-icon :size="11"><MagicStick /></el-icon>
                  因为浏览过《{{ truncateReason(r.reasonTitle) }}》
                </span>
                <button
                  v-if="r.id"
                  class="want-btn"
                  title="收藏"
                  @click.stop="handleToggleFavorite(r, $event)"
                >
                  <el-icon :size="14"><Star /></el-icon>
                </button>
              </div>
              <div class="recommend-info">
                <h4 class="recommend-title-text" :title="r.title">{{ r.title }}</h4>
                <div class="recommend-price">
                  <span class="currency">¥</span>
                  <span class="num">{{ r.price }}</span>
                </div>
              </div>
            </div>
            <div v-if="!recommendLoading && recommendList.length === 0" class="empty-tip">
              {{ isLoggedIn ? '暂无推荐，去逛逛商品吧' : '暂无热门商品' }}
            </div>
          </div>
          <button class="rail-arrow rail-arrow-right" @click="scrollRail(recommendRail, 1)">
            <el-icon><ArrowRight /></el-icon>
          </button>
        </div>
      </div>
    </section>

    <!-- ============ 主体（分类 + 排序 + 商品网格） ============ -->
    <main class="home-main">
      <div class="main-inner">
        <div class="category-bar">
          <div class="category-chips">
            <div
              class="category-chip"
              :class="{ active: activeCategory === 'all' }"
              @click="handleCategoryClick({ id: 'all' })"
            >
              <span class="chip-icon">🏷️</span>
              <span>全部</span>
            </div>
            <div
              v-for="cat in categories"
              :key="cat.id"
              class="category-chip"
              :class="{ active: activeCategory === cat.id, sub: cat.parentId !== 0 }"
              @click="handleCategoryClick(cat)"
            >
              <span>{{ cat.name }}</span>
            </div>
          </div>
          <div class="sort-box">
            <el-icon class="sort-icon"><Sort /></el-icon>
            <span class="sort-label">排序</span>
            <el-select v-model="sortKey" size="small" class="sort-select">
              <el-option
                v-for="opt in sortOptions"
                :key="opt.key"
                :label="opt.label"
                :value="opt.key"
              />
            </el-select>
          </div>
        </div>

        <div v-loading="loading" class="product-grid">
          <div
            v-for="p in products"
            :key="p.id"
            class="product-card"
            @click="goDetail(p)"
          >
            <div class="product-cover" :style="getCoverStyle(p)">
              <img
                v-if="p.cover || (p.images && p.images.length)"
                :src="p.cover || p.images[0]"
                class="cover-img"
                @error="(e) => (e.target.style.display = 'none')"
              />
              <span
                v-if="(p.stock ?? p.quantity ?? 0) <= 2"
                class="stock-badge"
              >仅剩{{ p.stock ?? p.quantity }}件</span>
              <!-- 成色 + 交易方式 chip：常驻显示，给买家快速决策信号 -->
              <div class="info-chip-row">
                <span v-if="p.conditionLevel != null" class="info-chip condition-chip">
                  {{ conditionLevelText(p.conditionLevel) }}
                </span>
                <span v-if="p.tradeMethod" class="info-chip trade-chip">
                  {{ tradeMethodText(p.tradeMethod) }}
                </span>
              </div>
              <span v-if="p.hot" class="hot-badge">🔥</span>
              <span
                v-if="!p.cover && !(p.images && p.images.length)"
                class="cover-label"
              >{{ p.title?.split(' ')[0] }}</span>
              <button class="want-btn" title="收藏" @click.stop="handleToggleFavorite(p, $event)">
                <el-icon :size="14"><Star /></el-icon>
              </button>
            </div>
            <div class="product-info">
              <h4 class="product-title" :title="p.title">{{ p.title }}</h4>
              <div class="product-price">
                <span class="currency">¥</span>
                <span class="num">{{ p.price }}</span>
              </div>
              <div class="product-stats">
                <span class="stat-item" title="浏览量">
                  <el-icon :size="13"><View /></el-icon>
                  {{ p.viewCount ?? 0 }}
                </span>
                <span class="stat-item" title="收藏量">
                  <el-icon :size="13"><StarFilled /></el-icon>
                  {{ p.favoriteCount ?? 0 }}
                </span>
                <span class="stat-item" title="销量">
                  <el-icon :size="13"><ShoppingCart /></el-icon>
                  {{ p.salesCount ?? p.sales ?? 0 }}
                </span>
              </div>
            </div>
          </div>
          <div v-if="!loading && products.length === 0" class="empty-tip">
            {{ emptyProductsMessage }}
          </div>
        </div>

        <!-- 分页：智能推荐（不分页）隐藏 -->
        <div v-if="showPagination" class="pagination-bar">
          <el-pagination
            v-model:current-page="pageNum"
            :page-size="pageSize"
            :total="total"
            :page-sizes="[12, 24, 48]"
            layout="total, sizes, prev, pager, next, jumper"
            background
            @size-change="(s) => { pageSize = s; pageNum = 1 }"
          />
        </div>
      </div>
    </main>

    <SiteFooter />
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100vh;
  background: #f5f7fa;
  display: flex;
  flex-direction: column;
}

/* ========== 通用 rail 容器 ========== */
.rail-section {
  background: #fff;
  padding: 22px 0 6px;
  border-bottom: 1px solid #f0f2f5;
}
.recommend-section {
  background: linear-gradient(180deg, #fff 0%, #fafbfc 100%);
}
.rail-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
}
.rail-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 14px;
}
.rail-title {
  font-size: 20px;
  font-weight: 700;
  color: #1f1f1f;
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.title-icon {
  color: #ff6b35;
  font-size: 18px;
}
.rail-subtitle {
  font-size: 12px;
  color: #999;
}

.rail-wrapper {
  position: relative;
  padding: 0 20px;
}
.rail-arrow {
  position: absolute;
  top: 130px;
  z-index: 5;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #e4e7ed;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  transition: all 0.2s;
}
.rail-arrow:hover {
  background: #ff8c5a;
  color: #fff;
  border-color: #ff8c5a;
  transform: translateY(-50%) scale(1.08);
}
.rail-arrow-left {
  left: -4px;
  transform: translateY(-50%);
}
.rail-arrow-right {
  right: -4px;
  transform: translateY(-50%);
}
.rail-track {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  padding: 6px 0 14px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.rail-track::-webkit-scrollbar {
  display: none;
}
.rail-track > * {
  scroll-snap-align: start;
  flex-shrink: 0;
}

/* ========== 为你推荐卡片 ========== */
.recommend-card {
  width: 280px;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.25s, box-shadow 0.25s;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
}
.recommend-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
}
.recommend-cover {
  position: relative;
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
  overflow: hidden;
}
/* 推荐原因角标：登录态 + ItemCF 有 history 时显示 */
.reason-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  text-shadow: none;
  z-index: 2;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  backdrop-filter: blur(4px);
  letter-spacing: 0.2px;
}
.recommend-info {
  padding: 10px 12px 12px;
}
.recommend-title-text {
  font-size: 13px;
  font-weight: 500;
  color: #1f1f1f;
  margin: 0 0 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recommend-price {
  display: flex;
  align-items: baseline;
  gap: 2px;
  color: #ff6b35;
}
.recommend-price .currency {
  font-size: 11px;
  font-weight: 600;
}
.recommend-price .num {
  font-size: 17px;
  font-weight: 700;
}

/* ========== Main ========== */
.home-main { flex: 1; padding: 22px 0 40px; }
.main-inner { max-width: 1280px; margin: 0 auto; padding: 0 24px; }

.category-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 22px;
  flex-wrap: wrap;
}
.category-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.sort-box {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 999px;
  padding: 4px 6px 4px 14px;
  font-size: 13px;
  color: #666;
  flex-shrink: 0;
  height: 32px;
  white-space: nowrap;
}
.sort-box:hover { border-color: #ff8c5a; }
.sort-icon { color: #ff8c5a; font-size: 14px; }
.sort-label { color: #555; font-weight: 500; }
.sort-select { width: 132px; }
.sort-select :deep(.el-select__wrapper) {
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 8px 0 4px;
  min-height: 24px;
  font-size: 13px;
}
.sort-select :deep(.el-select__placeholder),
.sort-select :deep(.el-select__selected-item) { color: #ff6b35; font-weight: 500; }
.sort-select :deep(.el-select__suffix) { color: #ff6b35; }

.category-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 16px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 999px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}
.category-chip.sub { padding-left: 10px; color: #888; }
.category-chip:hover { border-color: #ff8c5a; color: #ff6b35; }
.category-chip.active {
  background: linear-gradient(135deg, #ff8c5a 0%, #ff6b35 100%);
  border-color: transparent;
  color: #fff;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(255, 107, 53, 0.3);
}
.chip-icon { font-size: 14px; }

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  min-height: 200px;
}

.empty-tip {
  grid-column: 1 / -1;
  text-align: center;
  color: #999;
  padding: 60px 0;
  font-size: 14px;
  width: 100%;
}

.product-card {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}
.product-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
}

.product-cover {
  position: relative;
  aspect-ratio: 1 / 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.cover-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.stock-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(255, 77, 79, 0.9);
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  text-shadow: none;
  z-index: 2;
}

.hot-badge {
  position: absolute;
  top: 8px;
  left: 70px;
  font-size: 18px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
  z-index: 2;
}

/* 成色 + 交易方式 chip：放在封面左下角；与左上 stock-badge / 右上 reason-badge 错位 */
.info-chip-row {
  position: absolute;
  left: 8px;
  bottom: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  z-index: 2;
  max-width: calc(100% - 60px);
}
.info-chip {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
  line-height: 1.4;
  text-shadow: none;
  white-space: nowrap;
  backdrop-filter: blur(4px);
  letter-spacing: 0.2px;
}
.condition-chip {
  background: rgba(82, 196, 26, 0.85); /* 偏绿，暗示"成色好" */
  color: #fff;
}
.trade-chip {
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
}

.cover-label {
  font-size: 14px;
  letter-spacing: 1px;
}

.want-btn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  color: #ff6b35;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 2;
}
.want-btn:hover { background: #ff6b35; color: #fff; transform: scale(1.1); }

.product-info { padding: 12px 14px 14px; }
.product-title {
  font-size: 14px;
  font-weight: 500;
  color: #1f1f1f;
  margin: 0 0 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-price {
  display: flex;
  align-items: baseline;
  gap: 2px;
  margin-bottom: 6px;
  color: #ff6b35;
}
.product-price .currency { font-size: 12px; font-weight: 600; }
.product-price .num { font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }

.product-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #f0f2f5;
  font-size: 12px;
  color: #999;
}
.stat-item { display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
.stat-item :deep(.el-icon) { color: #bbb; }
.stat-item:nth-child(2) :deep(.el-icon) { color: #ff8c5a; }
.stat-item:nth-child(3) :deep(.el-icon) { color: #5bc0be; }

/* ========== 分页 ========== */
.pagination-bar {
  margin-top: 24px;
  display: flex;
  justify-content: center;
}
</style>