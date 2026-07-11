<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  ChatLineRound,
  ChatDotRound,
  CreditCard,
  Star,
  StarFilled,
  ShoppingCart,
  View,
  Phone,
  Calendar,
  Plus as IconPlus,
  Minus as IconMinus,
  Warning,
} from '@element-plus/icons-vue'
import { getGoods, toggleFavorite, toggleWant, recordView } from '@/api/goods'
import { getReviewPage, getReviewStats, getUserReviewStats } from '@/api/reviews'
import { REPORT_TARGET } from '@/api/reviewReports'
import { useUserStore } from '@/stores/user'
import ImageViewer from '@/components/ImageViewer.vue'
import ReviewReportDialog from '@/components/ReviewReportDialog.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const currentUserId = computed(() => userStore.userInfo?.id)

// ============ 商品 ============
const product = ref(null)
const loading = ref(true)
const activeTab = ref('album')
const previewVisible = ref(false)
const previewIndex = ref(0)

// 商品图册：cover 优先；否则 images[0]；否则渐变占位
const productImages = computed(() => {
  if (!product.value) return []
  const list = []
  if (product.value.cover) list.push(product.value.cover)
  if (Array.isArray(product.value.images)) {
    product.value.images.forEach((u) => {
      if (u && !list.includes(u)) list.push(u)
    })
  }
  return list
})

// 渐变占位（无图时使用）
const visualForId = (id) => {
  const palettes = [
    ['#ff8c5a', '#ff6b35'],
    ['#5b8def', '#4f7ce0'],
    ['#52c41a', '#389e0d'],
    ['#722ed1', '#531dab'],
    ['#13c2c2', '#08979c'],
  ]
  const n = Number(id) || 0
  return { bg1: palettes[n % palettes.length][0], bg2: palettes[n % palettes.length][1] }
}

const renderImg = (src, idx) => {
  if (!product.value) return { background: '#f5f7fa', label: '' }
  if (typeof src === 'string' && src.length) {
    return { background: `url(${src}) center/cover`, label: '' }
  }
  const v = visualForId(product.value.id || idx)
  return {
    background: `linear-gradient(135deg, ${v.bg1} 0%, ${v.bg2} 100%)`,
    label: product.value.title?.split(' ')[0] || '商品',
  }
}

// ============ 评价 ============
const reviews = ref([])
const reviewStats = ref({ rating: 0, count: 0 })

// 卖家双角色口碑（公开接口，任意访客都能看）
// 形态对齐后端 UserReviewStatsVO：{ asSeller, asBuyer }，每个含
//   totalCount 卖出/买到数 / reviewCount 评价条数 / goodCount 好评条数
//   goodRate 0-1 的小数（无评价为 null） / avgRating 平均分（无评价为 null）
const sellerStats = ref(null)
const sellerStatsLoading = ref(false)
const EMPTY_ROLE = { totalCount: 0, reviewCount: 0, goodCount: 0, goodRate: null, avgRating: null }
const sellerAsSeller = computed(
  () => sellerStats.value?.asSeller || EMPTY_ROLE
)
const sellerAsBuyer = computed(
  () => sellerStats.value?.asBuyer || EMPTY_ROLE
)

// 把 0.96 这样的好评率渲染成 "96%"；后端已做了 2 位小数 round，UI 再取整一次
const ratePercent = (rate) => {
  if (rate == null) return '-'
  return `${Math.round(rate * 100)}%`
}

// 后端 ReviewStatsVO 字段是 { total, avg, dist }，不是 avgRating/rating/count
const loadReviews = async (goodsId) => {
  try {
    const [pageRes, statsRes] = await Promise.all([
      getReviewPage({ goodsId, pageNum: 1, pageSize: 5, auditStatus: 1 }),
      getReviewStats(goodsId).catch(() => null),
    ])
    reviews.value = pageRes?.records || []
    if (statsRes) {
      // 兼容不同命名（avg / avgRating / rating），avg 才是 ReviewStatsVO 的真名
      const avg = statsRes.avg ?? statsRes.avgRating ?? statsRes.rating ?? 0
      const count = statsRes.total ?? statsRes.count ?? reviews.value.length
      reviewStats.value = { rating: Number(avg) || 0, count }
    } else {
      reviewStats.value = {
        rating: pageRes?.records?.[0]?.rating || 0,
        count: pageRes?.total ?? reviews.value.length,
      }
    }
  } catch {
    reviews.value = []
  }
}

// 商品详情页评价展示规则（与后端 t_review 一行双打分对齐）：
//   1) 只有买家已评（rating != null）的行才渲染——
//      卖家单方面先评时（rating 为 null、sellerRating 有值），
//      整行直接过滤掉，避免出现"买家无内容评价"的占位
//   2) 卖家对买家的评价（sellerRating / sellerRatingContent）只在买家已评的前提下再展示
const visibleReviews = computed(() =>
  (reviews.value || []).filter((r) => r && r.rating != null)
)

// tab 标题 / summary 区里展示的"评价条数"，必须与下方实际可见行数一致。
// 后端 stats.total / page.total 会把"卖家单方面已评、买家未评"的行也算进去，
// 那些行按上面规则会被过滤掉，所以这里用 visibleReviews.length 自洽。
const reviewCount = computed(() => visibleReviews.value.length)

// 拉取卖家作为"卖家角色"+"买家角色"的双向口碑；与商品评价并行，失败不影响主流程
const loadSellerStats = async (sellerId) => {
  if (!sellerId) {
    sellerStats.value = null
    return
  }
  sellerStatsLoading.value = true
  try {
    const data = await getUserReviewStats(sellerId).catch(() => null)
    // 兼容 asSeller/asBuyer 字段缺失（公开接口，后端总会返回两层结构）
    sellerStats.value = data || null
  } finally {
    sellerStatsLoading.value = false
  }
}

// ============ 加载商品 ============
const loadProduct = async (id) => {
  loading.value = true
  try {
    const p = await getGoods(id)
    if (!p) {
      ElMessage.error('商品不存在或已下架')
      router.replace('/home')
      return
    }
    product.value = p
    isFavorited.value = !!p.isFavorite
    isWanted.value = !!p.isWant
    await loadReviews(p.id)
    // 双角色口碑（卖家维度）与评价并行拉；任一失败都不阻塞主流程
    loadSellerStats(p.sellerId)
    // 记录一次浏览（fire-and-forget）
    recordView(p.id).catch(() => {})
  } catch (e) {
    console.error('loadProduct error', e)
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  // 商品详情要登录，游客态被直达 URL 进来了就跳登录页
  if (!userStore.isLoggedIn) {
    ElMessage.warning('查看商品详情需要登录')
    router.replace({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  loadProduct(route.params.id)
})
watch(() => route.params.id, (v) => v && userStore.isLoggedIn && loadProduct(v))

// ============ 派生：标签 / 库存条 ============
const conditionTag = computed(() => {
  const lvl = product.value?.conditionLevel
  if (lvl == null) return { text: '全新', color: '#52c41a', bg: '#f6ffed' }
  if (lvl >= 9) return { text: '全新', color: '#52c41a', bg: '#f6ffed' }
  if (lvl >= 7) return { text: '九成新', color: '#722ed1', bg: '#f9f0ff' }
  if (lvl >= 5) return { text: '八成新', color: '#1890ff', bg: '#e6f7ff' }
  return { text: '其他', color: '#999', bg: '#f5f5f5' }
})

const tradeMethodText = (m) =>
  ({ FACE_TO_FACE: '自提', EXPRESS: '邮递', BOTH: '两者皆可' }[m] || '两者皆可')

const stockPercent = computed(() => {
  const stock = product.value?.stock ?? product.value?.quantity ?? 1
  if (stock <= 2) return 12
  if (stock <= 5) return 35
  if (stock <= 10) return 60
  return 85
})

const priceFmt = computed(() => {
  if (!product.value?.price) return '0'
  return Number(product.value.price).toLocaleString('zh-CN')
})
// 评价 / 卖家回复时间：到分钟；空值返回 '-'
const formatReviewTime = (t) => {
  if (!t) return '-'
  const s = String(t)
  // 后端返回形如 "2025-08-12T15:30:45" —— 取前 16 位（到分钟）
  return s.length >= 16 ? s.slice(0, 16).replace('T', ' ') : s
}
const originalPriceFmt = computed(() => {
  if (!product.value?.originalPrice) return ''
  return Number(product.value.originalPrice).toLocaleString('zh-CN')
})

// ============ 操作 ============
const isFavorited = ref(false)
const isWanted = ref(false)

const buyQuantity = ref(1)
const maxBuyQuantity = computed(() => {
  const stock = product.value?.stock ?? product.value?.quantity ?? 1
  return Math.max(1, stock)
})
watch(
  () => product.value?.id,
  () => {
    buyQuantity.value = 1
  }
)
const incQty = () => {
  if (buyQuantity.value < maxBuyQuantity.value) buyQuantity.value += 1
}
const decQty = () => {
  if (buyQuantity.value > 1) buyQuantity.value -= 1
}

const handleToggleFavorite = async () => {
  if (!product.value) return
  // 不能收藏自己的商品（前端 UX；后端会再校验一次）
  if (currentUserId.value && product.value.sellerId === currentUserId.value) {
    ElMessage.warning('不能收藏自己的商品')
    return
  }
  try {
    const res = await toggleFavorite(product.value.id)
    isFavorited.value = !!res?.favorited
    if (product.value.favoriteCount != null) {
      product.value.favoriteCount += isFavorited.value ? 1 : -1
    }
    ElMessage.success(isFavorited.value ? '已收藏' : '已取消收藏')
  } catch (e) {
    ElMessage.error(e?.message || '操作失败')
  }
}
const handleToggleWant = async () => {
  if (!product.value) return
  // 不能想要自己的商品（前端 UX；后端会再校验一次）
  if (currentUserId.value && product.value.sellerId === currentUserId.value) {
    ElMessage.warning('不能想要自己的商品')
    return
  }
  try {
    const res = await toggleWant(product.value.id)
    // toggle 接口返回 favorited 字段（want 也用同一字段命名习惯）
    const wanted = res?.favorited ?? res?.wanted
    isWanted.value = !!wanted
    if (product.value.wantCount != null) {
      product.value.wantCount += isWanted.value ? 1 : -1
    }
    ElMessage.success(isWanted.value ? '已想要' : '已取消想要')
  } catch (e) {
    ElMessage.error(e?.message || '操作失败')
  }
}

const handleBuyNow = () => {
  if (!product.value) return
  // 卖家不能购买自己的商品
  if (currentUserId.value && product.value.sellerId === currentUserId.value) {
    ElMessage.warning('不能购买自己的商品')
    return
  }
  const stock = product.value.stock ?? product.value.quantity ?? 0
  if (stock <= 0) {
    ElMessage.warning('该商品已售罄')
    return
  }
  router.push({
    path: '/user-home/create-order',
    query: { goodsId: product.value.id, quantity: buyQuantity.value },
  })
}

const contactSeller = () => {
  if (!product.value) return
  // 不能跟自己聊天（后端 ChatService.openOrCreate 会拒绝）
  if (currentUserId.value && product.value.sellerId === currentUserId.value) {
    ElMessage.warning('不能联系自己的商品')
    return
  }
  router.push({
    path: '/user-home/chat',
    query: {
      peerId: product.value.sellerId,
      peerNickname: product.value.sellerNickname || '',
      goodsId: product.value.id,
      goodsTitle: product.value.title,
      goodsCover: product.value.cover || '',
    },
  })
}

const openPreview = (idx) => {
  previewIndex.value = idx
  previewVisible.value = true
}

const setTab = (k) => (activeTab.value = k)

const handleBack = () => {
  if (window.history.length > 1) router.back()
  else router.push('/home')
}

// ============ 评价/回复举报（任意已登录用户均可发起）============
// 复用共享弹窗 ReviewReportDialog；这里只持有"打开哪一条举报"的上下文
const reportDialog = ref({ visible: false, reviewId: null, targetType: null, targetLabel: '' })

const openReportDialog = (r, targetType) => {
  reportDialog.value = {
    visible: true,
    reviewId: r.id,
    targetType,
    targetLabel: targetType === REPORT_TARGET.REPLY_CONTENT ? '卖家回复' : '评价内容',
  }
}

const onReportSuccess = () => {
  // 举报提交成功后无需刷新列表（列表本身不变，后端只创建一条举报记录）
  // 这里留 hook 方便以后做"标记已举报"等扩展
}
</script>

<template>
  <div class="product-detail-page">
    <main class="detail-main">
      <div class="back-link" @click="handleBack">
        <el-icon><ArrowLeft /></el-icon>
        <span>{{ product?.title || '商品' }} 详情</span>
      </div>

      <div v-if="loading" class="loading">加载中...</div>

      <div v-else-if="product" class="detail-card">
        <h1 class="detail-title">{{ product.title }}</h1>

        <div class="price-bar">
          <span class="currency">¥</span>
          <span class="num">{{ priceFmt }}</span>
          <span v-if="originalPriceFmt" class="original">原价 ¥{{ originalPriceFmt }}</span>
        </div>

        <div class="tag-row">
          <span class="tag" :style="{ color: conditionTag.color, background: conditionTag.bg }">
            <el-icon><StarFilled /></el-icon>
            {{ conditionTag.text }}
          </span>
          <span class="tag tag-trade">
            <el-icon><CreditCard /></el-icon>
            {{ tradeMethodText(product.tradeMethod) }}
          </span>
          <span class="tag tag-camera">
            <el-icon><View /></el-icon>
            {{ product.categoryName || '其他' }}
          </span>
        </div>

        <div class="stat-row">
          <div class="stat">
            <el-icon><View /></el-icon>
            <span class="stat-num">{{ product.viewCount ?? 0 }}</span>
            <span class="stat-label">次浏览</span>
          </div>
          <div class="stat">
            <el-icon><Star /></el-icon>
            <span class="stat-num">{{ product.favoriteCount ?? 0 }}</span>
            <span class="stat-label">收藏</span>
          </div>
          <div class="stat">
            <el-icon><ShoppingCart /></el-icon>
            <span class="stat-num">{{ product.wantCount ?? 0 }}</span>
            <span class="stat-label">想要</span>
          </div>
        </div>

        <div class="stock-bar">
          <div class="stock-tip">
            <span class="dot">ⓘ</span>
            <span>库存紧张，仅剩 <b>{{ product.stock ?? 1 }}</b> 件</span>
          </div>
          <div class="progress">
            <div class="progress-fill" :style="{ width: stockPercent + '%' }"></div>
          </div>
        </div>

        <div class="time-row">
          <div class="time-item">
            <span class="time-label">发布时间</span>
            <span class="time-value">
              {{ product.createTime ? String(product.createTime).slice(0, 10) : '-' }}
            </span>
          </div>
          <div class="time-item">
            <span class="time-label">销量</span>
            <span class="time-value">{{ product.salesCount ?? 0 }} 件</span>
          </div>
        </div>

        <div class="qty-row">
          <span class="qty-label">购买数量</span>
          <div class="qty-control">
            <button class="qty-btn" :disabled="buyQuantity <= 1" @click="decQty">
              <el-icon><IconMinus /></el-icon>
            </button>
            <input class="qty-input" v-model.number="buyQuantity" type="number" min="1" :max="maxBuyQuantity" />
            <button class="qty-btn" :disabled="buyQuantity >= maxBuyQuantity" @click="incQty">
              <el-icon><IconPlus /></el-icon>
            </button>
          </div>
          <span class="qty-tip">库存 {{ product.stock ?? product.quantity ?? 1 }} 件</span>
        </div>

        <div class="action-row">
          <el-button
            class="act-btn fav"
            round
            :disabled="!!(currentUserId && product.sellerId === currentUserId)"
            @click="handleToggleFavorite"
          >
            <el-icon><Star /></el-icon>
            <span>{{ currentUserId && product.sellerId === currentUserId ? '自己的商品' : (isFavorited ? '已收藏' : '收藏') }}</span>
          </el-button>
          <el-button
            class="act-btn want"
            round
            :disabled="!!(currentUserId && product.sellerId === currentUserId)"
            @click="handleToggleWant"
          >
            <el-icon><ChatLineRound /></el-icon>
            <span>{{ currentUserId && product.sellerId === currentUserId ? '自己的商品' : (isWanted ? '已想要' : '我想要') }}</span>
            <span class="want-count">{{ product.wantCount ?? 0 }}</span>
          </el-button>
          <el-button
            class="act-btn buy"
            round
            :disabled="!!(currentUserId && product.sellerId === currentUserId)"
            @click="handleBuyNow"
          >
            <el-icon><ShoppingCart /></el-icon>
            <span>{{ currentUserId && product.sellerId === currentUserId ? '自己的商品' : '立即下单' }}</span>
          </el-button>
        </div>

        <div class="seller-card">
          <el-avatar :size="44" :src="product.sellerAvatar">
            {{ (product.sellerNickname || '卖').slice(0, 1) }}
          </el-avatar>
          <div class="seller-info">
            <div class="seller-name">{{ product.sellerNickname || '匿名卖家' }}</div>
            <div class="seller-meta">
              <el-icon><Calendar /></el-icon>
              <span>
                发布于 {{ product.createTime ? String(product.createTime).slice(0, 10) : '-' }}
              </span>
            </div>
            <!-- 卖家双角色口碑（独立 block，紧跟昵称，避免与"联系卖家"按钮争抢右侧空间） -->
            <!-- 两条都没有评价时，整块隐藏：避免展示"好评率 0%"误导用户 -->
            <div
              v-if="sellerStats && (sellerAsSeller.reviewCount || sellerAsBuyer.reviewCount)"
              class="seller-reputation"
            >
              <div class="rep-item">
                <span class="rep-label">卖家好评率</span>
                <span class="rep-value">{{ ratePercent(sellerAsSeller.goodRate) }}</span>
                <span class="rep-sub">卖出 {{ sellerAsSeller.totalCount }} 件 · 好评 {{ sellerAsSeller.goodCount }} 笔</span>
              </div>
              <div class="rep-item">
                <span class="rep-label">买家好评率</span>
                <span class="rep-value">{{ ratePercent(sellerAsBuyer.goodRate) }}</span>
                <span class="rep-sub">买到 {{ sellerAsBuyer.totalCount }} 件 · 好评 {{ sellerAsBuyer.goodCount }} 笔</span>
              </div>
            </div>
          </div>
          <el-button
            type="primary"
            round
            class="contact-btn"
            :disabled="!!(currentUserId && product.sellerId === currentUserId)"
            @click="contactSeller"
          >
            <el-icon><Phone /></el-icon>
            <span>联系卖家</span>
          </el-button>
        </div>

        <div class="tab-row">
          <div
            class="tab-pill"
            :class="{ active: activeTab === 'album' }"
            @click="setTab('album')"
          >
            <el-icon><View /></el-icon>
            <span>商品图册</span>
          </div>
          <div
            class="tab-pill"
            :class="{ active: activeTab === 'desc' }"
            @click="setTab('desc')"
          >
            <el-icon><ChatLineRound /></el-icon>
            <span>商品描述</span>
          </div>
          <div
            class="tab-pill"
            :class="{ active: activeTab === 'review' }"
            @click="setTab('review')"
          >
            <el-icon><ChatLineRound /></el-icon>
            <span>商品评价 ({{ reviewCount }})</span>
          </div>
        </div>

        <div v-if="activeTab === 'album'" class="tab-content">
          <div v-if="productImages.length" class="album-grid">
            <div
              v-for="(src, i) in productImages"
              :key="i"
              class="album-cell"
              :style="{ background: renderImg(src, i).background }"
              @click="openPreview(i)"
            >
              <span v-if="renderImg(src, i).label" class="album-label">{{ renderImg(src, i).label }}</span>
            </div>
          </div>
          <div v-else class="no-image-tip">该商品暂无图片</div>
        </div>

        <div v-else-if="activeTab === 'desc'" class="tab-content">
          <p class="desc-text">
            {{ product.description || '卖家暂未提供描述' }}
          </p>
        </div>

        <div v-else class="tab-content">
          <div class="review-summary">
            <h3 class="sub-title">商品评价</h3>
            <div class="rating">
              <!-- 每颗星根据 reviewStats.rating 决定状态：实心 / 半星 / 空心 -->
              <span
                v-for="i in 5"
                :key="i"
                class="star"
                :class="{
                  'is-half': reviewStats.rating >= i - 0.5 && reviewStats.rating < i,
                  'is-empty': reviewStats.rating < i - 0.5,
                }"
              >
                <el-icon><StarFilled /></el-icon>
              </span>
              <span class="score">{{ Number(reviewStats.rating || 0).toFixed(1) }}</span>
              <span class="count">（{{ reviewCount }} 条评价）</span>
            </div>
          </div>

          <div v-if="visibleReviews.length" class="review-list">
            <!-- 商品详情页评价展示规则（与后端 t_review 一行双打分对齐）：
                 1) 只有买家已评（rating != null）的行才进入列表——卖家单方面先评时整行隐藏
                 2) 卖家对买家的评价（sellerRating / sellerRatingContent）
                    仅在买家已评 + 卖家已评 时才在买家侧下追加展示 -->
            <div v-for="r in visibleReviews" :key="r.id" class="review-item">
              <el-avatar :size="36" :src="r.reviewerAvatar">
                {{ (r.reviewerNickname || '匿').slice(0, 1) }}
              </el-avatar>
              <div class="review-main">
                <div class="review-head">
                  <span class="reviewer-name">{{ r.reviewerNickname || '匿名用户' }}</span>
                  <span class="reviewer-stars">
                    <el-icon v-for="i in r.rating" :key="i"><StarFilled /></el-icon>
                  </span>
                  <span class="review-time">
                    {{ r.createTime ? String(r.createTime).slice(0, 10) : '' }}
                  </span>
                  <!-- 举报入口：任意已登录用户可见 -->
                  <button
                    class="report-link"
                    @click="openReportDialog(r, REPORT_TARGET.REVIEW_CONTENT)"
                    title="举报此条评价"
                  >
                    <el-icon><Warning /></el-icon>
                    <span>举报</span>
                  </button>
                </div>
                <p class="review-content">{{ r.content }}</p>
                <!-- 商家回复：后端 ReviewVO.Reply（仅 replyContent 非空时渲染） -->
                <div v-if="r.reply && r.reply.content" class="review-reply">
                  <div class="reply-head">
                    <el-icon class="reply-icon"><ChatDotRound /></el-icon>
                    <span class="reply-label">卖家回复</span>
                    <span class="reply-time">{{ formatReviewTime(r.reply.createTime) }}</span>
                    <!-- 举报回复：任意已登录用户可见 -->
                    <button
                      class="report-link"
                      @click="openReportDialog(r, REPORT_TARGET.REPLY_CONTENT)"
                      title="举报此条卖家回复"
                    >
                      <el-icon><Warning /></el-icon>
                      <span>举报</span>
                    </button>
                  </div>
                  <p class="reply-content">{{ r.reply.content }}</p>
                </div>
                <div v-if="r.images && r.images.length" class="review-images">
                  <div
                    v-for="(img, idx) in r.images"
                    :key="idx"
                    class="review-img"
                    :style="{ backgroundImage: `url(${img})` }"
                    @click="openPreview(idx)"
                  ></div>
                </div>

                <!-- ========== 卖家对买家的评价（v4 升级：双打分一行）==========
                     展示条件：买家已评 + 卖家已评
                     —— 约定"买家先评才解锁卖家侧显示"，避免出现卖家单向骚扰曝光 -->
                <div
                  v-if="r.sellerRating != null"
                  class="review-seller-block"
                >
                  <div class="seller-block-head">
                    <el-icon class="seller-block-icon"><ChatDotRound /></el-icon>
                    <span class="seller-block-label">卖家对买家的评价</span>
                  </div>
                  <div class="seller-block-body">
                    <el-avatar :size="28">
                      {{ (r.sellerNickname || '卖').slice(0, 1) }}
                    </el-avatar>
                    <div class="seller-block-main">
                      <div class="review-head seller-head">
                        <span class="reviewer-name">{{ r.sellerNickname || '匿名卖家' }}</span>
                        <span class="reviewer-stars">
                          <el-icon v-for="i in r.sellerRating" :key="i"><StarFilled /></el-icon>
                        </span>
                        <span class="review-time">{{ formatReviewTime(r.sellerRatingTime) }}</span>
                      </div>
                      <p class="review-content">{{ r.sellerRatingContent }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="no-review-tip">暂无评价</div>
        </div>
      </div>
    </main>

    <!-- 图片预览：复用共享 ImageViewer，支持滚轮缩放 / 拖拽平移 / 左右切换 -->
    <ImageViewer
      v-model="previewVisible"
      :src-list="productImages"
      :start-index="previewIndex"
      alt="商品图片"
    />

    <!-- 评价 / 回复举报弹窗（共享 ReviewReportDialog） -->
    <ReviewReportDialog
      v-model="reportDialog.visible"
      :review-id="reportDialog.reviewId"
      :target-type="reportDialog.targetType"
      :target-label="reportDialog.targetLabel"
      @success="onReportSuccess"
    />
  </div>
</template>

<style scoped>
.product-detail-page { min-height: 100vh; background: #f5f7fa; }
.detail-main { max-width: 800px; margin: 0 auto; padding: 18px 24px 60px; }

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #666;
  font-size: 13px;
  cursor: pointer;
  margin-bottom: 16px;
  user-select: none;
  transition: color 0.2s;
}
.back-link:hover { color: #ff6b35; }

.loading { text-align: center; padding: 60px 0; color: #999; }

.detail-card {
  background: #fff;
  border-radius: 12px;
  padding: 28px 32px 22px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.detail-title {
  font-size: 26px;
  font-weight: 700;
  color: #1f1f1f;
  margin: 0 0 16px;
  letter-spacing: 0.5px;
}

.price-bar {
  display: inline-flex;
  align-items: baseline;
  background: linear-gradient(135deg, #fff5f0 0%, #ffe8db 100%);
  padding: 12px 20px;
  border-radius: 12px;
  margin-bottom: 16px;
  color: #ff6b35;
}
.price-bar .currency { font-size: 18px; font-weight: 600; }
.price-bar .num { font-size: 30px; font-weight: 800; letter-spacing: 1px; margin: 0 4px; }
.price-bar .original {
  font-size: 13px;
  color: #999;
  text-decoration: line-through;
  margin-left: 10px;
}

.tag-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
}
.tag :deep(.el-icon) { font-size: 13px; }

.stat-row {
  display: flex;
  gap: 32px;
  padding: 6px 4px 18px;
  border-bottom: 1px dashed #f0f2f5;
  margin-bottom: 18px;
}
.stat { display: inline-flex; align-items: center; gap: 6px; color: #888; font-size: 13px; }
.stat :deep(.el-icon) { font-size: 16px; color: #bbb; }
.stat-num { font-size: 15px; font-weight: 600; color: #1f1f1f; }
.stat-label { color: #999; font-size: 12px; }

.stock-bar {
  background: linear-gradient(135deg, #fffaf0 0%, #fff5e0 100%);
  border: 1px solid #ffe4b8;
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 22px;
}
.stock-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #d48806;
  margin-bottom: 8px;
}
.stock-tip .dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #ffd56b;
  color: #fff;
  font-size: 11px;
}
.stock-tip b { color: #d4380d; font-size: 14px; margin: 0 2px; }

.progress {
  height: 6px;
  background: #fff;
  border-radius: 999px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff8c5a 0%, #ff6b35 100%);
  border-radius: 999px;
  transition: width 0.4s;
}

.time-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 4px 18px;
  border-bottom: 1px dashed #f0f2f5;
  margin-bottom: 22px;
}
.time-item { display: flex; gap: 12px; align-items: center; }
.time-label { color: #999; font-size: 13px; }
.time-value { color: #555; font-size: 13px; }

.qty-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 4px 4px 18px;
  border-bottom: 1px dashed #f0f2f5;
  margin-bottom: 18px;
}
.qty-label { color: #666; font-size: 13px; min-width: 64px; }
.qty-control {
  display: inline-flex;
  align-items: stretch;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}
.qty-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: #fafbfc;
  color: #555;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.qty-btn:hover:not(:disabled) { background: #fff7f2; color: #ff6b35; }
.qty-btn:disabled { color: #ccc; cursor: not-allowed; }
.qty-input {
  width: 60px;
  height: 32px;
  border: none;
  border-left: 1px solid #e4e7ed;
  border-right: 1px solid #e4e7ed;
  text-align: center;
  font-size: 14px;
  color: #1f1f1f;
  background: #fff;
  outline: none;
  -moz-appearance: textfield;
}
.qty-input::-webkit-outer-spin-button,
.qty-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.qty-tip { color: #999; font-size: 12px; }

.action-row {
  display: flex;
  justify-content: center;
  gap: 18px;
  padding: 8px 0 22px;
}
.act-btn {
  min-width: 130px;
  height: 44px !important;
  font-size: 14px !important;
  display: inline-flex !important;
  align-items: center;
  gap: 6px;
}
.act-btn.fav {
  background: #fff !important;
  border: 1px solid #e4e7ed !important;
  color: #555 !important;
}
.act-btn.fav:hover { border-color: #ff8c5a !important; color: #ff6b35 !important; }
.act-btn.want {
  background: linear-gradient(135deg, #ff8c5a 0%, #ff6b35 100%) !important;
  border: none !important;
  color: #fff !important;
  box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
}
.want-count {
  margin-left: 6px;
  background: rgba(255, 255, 255, 0.25);
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 11px;
}
.act-btn.buy {
  background: #1f1f1f !important;
  border: none !important;
  color: #fff !important;
  box-shadow: 0 4px 12px rgba(31, 31, 31, 0.3);
}
.act-btn.buy:hover { background: #2c2c2c !important; transform: translateY(-1px); }

.seller-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  background: #fafbfc;
  border-radius: 10px;
  margin-bottom: 28px;
}
.seller-info { flex: 1; }
.seller-name { font-size: 15px; font-weight: 600; color: #1f1f1f; margin-bottom: 4px; }
.seller-meta { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #999; margin-bottom: 6px; }
/* 双角色口碑：两行紧贴 seller-meta 下方；
   flex-wrap 让窄屏自动竖排；
   rep-value 用主色橙高亮好评率，rep-sub 灰小字带数字 */
.seller-reputation {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  font-size: 12px;
  color: #777;
  margin-top: 2px;
}
.rep-item { display: inline-flex; align-items: baseline; gap: 4px; white-space: nowrap; }
.rep-label { color: #999; }
.rep-value {
  color: #ff6b35;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.3px;
}
.rep-sub { color: #bbb; margin-left: 2px; }
.contact-btn {
  background: linear-gradient(135deg, #ff8c5a 0%, #ff6b35 100%) !important;
  border: none !important;
  height: 34px !important;
  padding: 0 16px !important;
}

.tab-row {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 24px;
}
.tab-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 18px;
  border-radius: 999px;
  background: #f5f7fa;
  color: #666;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}
.tab-pill:hover { background: #fff7f2; color: #ff6b35; }
.tab-pill.active { background: #1f1f1f; color: #fff; }
.tab-pill :deep(.el-icon) { font-size: 14px; }

.tab-content { min-height: 200px; }

.album-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
}
.album-cell {
  aspect-ratio: 1 / 1;
  border-radius: 10px;
  position: relative;
  cursor: pointer;
  overflow: hidden;
  background-color: #f5f7fa;
  background-size: cover;
  background-position: center;
  transition: transform 0.2s;
}
.album-cell:hover { transform: scale(1.03); }

.no-image-tip,
.no-review-tip {
  text-align: center;
  color: #999;
  padding: 60px 0;
  font-size: 14px;
}

.desc-text {
  font-size: 14px;
  line-height: 1.8;
  color: #555;
  background: #fafbfc;
  padding: 18px 20px;
  border-radius: 10px;
  margin-bottom: 16px;
  white-space: pre-wrap;
}

.sub-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f1f1f;
  margin: 0 0 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.sub-title::before {
  content: '';
  display: inline-block;
  width: 4px;
  height: 14px;
  background: linear-gradient(180deg, #ff8c5a 0%, #ff6b35 100%);
  border-radius: 2px;
}

.review-summary { margin-bottom: 20px; }
.rating {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #1f1f1f;
}
.star {
  color: #ffb300;
  position: relative;
  display: inline-flex;
}
.star :deep(.el-icon) { font-size: 16px; }
/* 空心星：覆盖一层浅灰 */
.star.is-empty { color: #e4e7ed; }
/* 半星：用 -webkit-background-clip 实现左半边金色、右半边灰色 */
.star.is-half :deep(.el-icon) {
  background: linear-gradient(to right, #ffb300 0%, #ffb300 50%, #e4e7ed 50%, #e4e7ed 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}
.score { font-size: 18px; font-weight: 700; margin-left: 4px; color: #ff6b35; }
.count { color: #999; font-size: 13px; margin-left: 4px; }

.review-list { display: flex; flex-direction: column; gap: 20px; }
.review-item {
  display: flex;
  gap: 12px;
  padding-bottom: 20px;
  border-bottom: 1px dashed #f0f2f5;
}
.review-item:last-child { border-bottom: none; }
.review-main { flex: 1; }
.review-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.reviewer-name { font-weight: 600; font-size: 14px; color: #1f1f1f; }
.reviewer-stars { color: #ffb300; display: inline-flex; gap: 1px; }
.reviewer-stars :deep(.el-icon) { font-size: 12px; }
.review-time { margin-left: auto; margin-right: 8px; font-size: 12px; color: #999; }
/* 评价/回复举报小链接：灰底，悬浮变红 */
.report-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  background: transparent;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  color: #bbb;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}
.report-link :deep(.el-icon) { font-size: 12px; }
.report-link:hover {
  color: #f56c6c;
  background: #fef0f0;
}
/* 商家回复（t_review.replyContent / replyTime）*/
.review-reply {
  margin-top: 10px;
  padding: 10px 12px;
  background: #f5f7fa;
  border-left: 3px solid #ff8c5a;
  border-radius: 4px;
}
.reply-head {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #ff6b35;
  margin-bottom: 4px;
}
.reply-icon { font-size: 13px; }
.reply-label { font-weight: 600; }
.reply-time { margin-left: auto; color: #999; font-weight: normal; margin-right: 8px; }
/* 卖家回复区里"举报"按钮的颜色变体（暗背景下用更浅的底色） */
.review-reply .report-link { color: #c0a08a; }
.review-reply .report-link:hover { color: #f56c6c; background: #fef0f0; }
.reply-content {
  margin: 0;
  font-size: 13px;
  color: #555;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.review-content { font-size: 13px; color: #555; margin: 0 0 10px; line-height: 1.6; }

/* ========== 卖家对买家的评价（v4 双打分）==========
   嵌在买家侧 review-main 内、用浅橙底 + 左边框与买家侧分隔；
   seller-block-head 是"卖家对买家的评价"小标签；
   seller-block-body 是头像 + 昵称/星/时间 + 内容的标准布局，
   头像略小于买家侧（28 vs 36）以体现层级 */
.review-seller-block {
  margin-top: 12px;
  padding: 10px 12px;
  background: #fff8f3;
  border-left: 3px solid #ff8c5a;
  border-radius: 4px;
}
.seller-block-head {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #ff6b35;
  margin-bottom: 6px;
  font-weight: 600;
}
.seller-block-icon { font-size: 13px; }
.seller-block-label { letter-spacing: 0.3px; }
.seller-block-body {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.seller-block-main { flex: 1; min-width: 0; }
/* 卖家侧 head 用更紧凑的内边距，避免和买家侧 head 视觉上等权 */
.seller-head { margin-bottom: 6px; }
.review-seller-block .review-content {
  margin: 0;
  font-size: 13px;
  color: #555;
  line-height: 1.6;
}
.review-images { display: flex; gap: 6px; }
.review-img {
  width: 64px;
  height: 64px;
  border-radius: 6px;
  background-color: #f0f2f5;
  background-size: cover;
  background-position: center;
  cursor: pointer;
  transition: transform 0.2s;
}
.review-img:hover { transform: scale(1.05); }

/* 旧 el-dialog 预览 (.preview-dialog / .preview-box / .preview-img /
   .preview-label / .preview-thumbs / .thumb) 已废弃，改为共享 ImageViewer */
</style>
