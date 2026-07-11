<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Delete, ChatLineRound, StarFilled } from '@element-plus/icons-vue'
import { getMyReviewPage, deleteReview } from '@/api/reviews'
import ImageViewer from '@/components/ImageViewer.vue'

const router = useRouter()

const loading = ref(false)
const list = ref([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(10)
const keyword = ref('')
const orderDesc = ref(true) // true=评价时间倒序(新→旧),false=正序(旧→新)

const fetchList = async () => {
  loading.value = true
  try {
    const res = await getMyReviewPage({
      keyword: keyword.value.trim(),
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      orderDesc: orderDesc.value,
    })
    list.value = res?.records ?? []
    total.value = res?.total ?? 0
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pageNum.value = 1
  fetchList()
}
const handleSortChange = () => {
  pageNum.value = 1
  fetchList()
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确认删除对「${row.goodsTitle}」的评价吗？该操作不可恢复`,
      '删除评价',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  await deleteReview(row.id)
  ElMessage.success('已删除')
  fetchList()
}

const handleReplyPreview = (row) => {
  if (!row.reply) return
  ElMessageBox.alert(
    `卖家回复：\n${row.reply.content}\n\n回复时间：${row.reply.createTime}`,
    '卖家回复',
    { confirmButtonText: '我知道了' }
  )
}

const goToGoods = (row) => {
  router.push(`/user-home/product-detail/${row.goodsId}`)
}

// 图片预览（评价可能有多张，用 srcList 多图模式；左右切换 + 缩放/拖拽）
const viewerOpen = ref(false)
const viewerList = ref([])
const viewerIndex = ref(0)
const openImageViewer = (imgs, startIdx = 0) => {
  viewerList.value = imgs
  viewerIndex.value = startIdx
  viewerOpen.value = true
}
const onThumbClick = (imgs, idx) => openImageViewer(imgs, idx)

const formatTime = (t) => {
  if (!t) return ''
  // 输出 YYYY-MM-DD HH:mm（带年份，去秒）
  const m = String(t).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`
  return t
}

onMounted(fetchList)
</script>

<template>
  <div class="my-reviews-page">
    <!-- 顶部：搜索（评价内容 / 商品名称） + 时间排序（移到搜索按钮右边） -->
    <div class="search-card">
      <el-input
        v-model="keyword"
        class="search-input"
        placeholder="搜索评价内容 / 商品名称"
        clearable
        @keyup.enter="handleSearch"
      >
        <template #prefix>
          <el-icon class="search-prefix"><Search /></el-icon>
        </template>
      </el-input>
      <el-button class="search-btn" round @click="handleSearch">搜索</el-button>
      <span class="sort-hint">
        按时间<strong>{{ orderDesc ? '倒序' : '正序' }}</strong>排列
      </span>
      <el-radio-group v-model="orderDesc" size="small" @change="handleSortChange">
        <el-radio-button :value="true">倒序</el-radio-button>
        <el-radio-button :value="false">正序</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 列表 -->
    <div v-loading="loading" class="reviews-body">
      <el-empty v-if="!loading && list.length === 0" description="暂无评价记录" />

      <div v-else class="review-grid">
        <article v-for="r in list" :key="r.id" class="review-card">
          <!-- 商品行 -->
          <div class="goods-row" @click="goToGoods(r)">
            <img v-if="r.goodsCover" :src="r.goodsCover" class="goods-cover" alt="cover" />
            <div v-else class="goods-cover goods-cover-empty"></div>
            <div class="goods-meta">
              <h4 class="goods-title" :title="r.goodsTitle">{{ r.goodsTitle }}</h4>
              <div class="star-row">
                <el-icon
                  v-for="i in 5"
                  :key="i"
                  :size="14"
                  :color="i <= r.rating ? '#ffb300' : '#e4e7ed'"
                >
                  <StarFilled />
                </el-icon>
                <span class="time-text">{{ formatTime(r.createTime) }}</span>
              </div>
            </div>
          </div>

          <!-- 评价内容 -->
          <div class="content-row">
            <span class="content-label">内容：</span>
            <span class="content-text">{{ r.content }}</span>
          </div>

          <!-- 评价图 -->
          <div v-if="r.images && r.images.length" class="images-row">
            <img
              v-for="(img, i) in r.images"
              :key="i"
              :src="img"
              class="image-thumb"
              alt="review image"
              @click="onThumbClick(r.images, i)"
            />
          </div>

          <!-- ========== 卖家对买家的评价（v4 双打分）==========
               与商品详情页规则一致：仅当 sellerRating != null 时渲染。
               sellerRating 来自同一 review 行的卖家侧字段（写在买家这条 t_review 上），
               后端 ReviewVO.of 已把整行序列化过来，buyer 视角能直接看到。 -->
          <div v-if="r.sellerRating != null" class="seller-rating-row">
            <div class="seller-rating-head">
              <span class="seller-rating-label">卖家对我的评价</span>
              <span class="seller-rating-time">{{ formatTime(r.sellerRatingTime) }}</span>
            </div>
            <div class="seller-rating-body">
              <div class="seller-stars">
                <el-icon
                  v-for="i in 5"
                  :key="i"
                  :size="14"
                  :color="i <= r.sellerRating ? '#ffb300' : '#e4e7ed'"
                >
                  <StarFilled />
                </el-icon>
              </div>
              <p v-if="r.sellerRatingContent" class="seller-rating-content">
                {{ r.sellerRatingContent }}
              </p>
            </div>
          </div>

          <!-- 底部：操作 + 状态 -->
          <div class="card-foot">
            <div class="foot-actions">
              <button
                v-if="r.reply"
                class="foot-link"
                @click="handleReplyPreview(r)"
                title="查看卖家回复"
              >
                <el-icon><ChatLineRound /></el-icon>
                <span>卖家已回复</span>
              </button>
              <button class="foot-link danger" @click="handleDelete(r)">
                <el-icon><Delete /></el-icon>
                <span>删除评价</span>
              </button>
            </div>
            <span class="status-tag">已评价</span>
          </div>
        </article>
      </div>

      <!-- 分页 -->
      <div v-if="total > pageSize" class="pagination-bar">
        <el-pagination
          v-model:current-page="pageNum"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next, jumper"
          background
          @current-change="fetchList"
        />
      </div>
    </div>

    <!-- 图片预览（共享 ImageViewer） -->
    <ImageViewer
      v-model="viewerOpen"
      :src-list="viewerList"
      :start-index="viewerIndex"
      alt="评价图片"
    />
  </div>
</template>

<style scoped>
.my-reviews-page {
  width: 100%;
}

/* ========== 顶部搜索 ========== */
.search-card {
  background: #fff;
  border-radius: 12px;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  margin-bottom: 18px;
}
.search-input {
  flex: 1;
  max-width: 420px;
}
.search-input :deep(.el-input__wrapper) {
  border-radius: 999px;
  background: #f5f7fa;
  box-shadow: none !important;
}
.search-prefix {
  color: #999;
}
.sort-hint {
  font-size: 13px;
  color: #666;
  white-space: nowrap;
}
.sort-hint strong {
  color: #ff6b35;
  font-weight: 700;
  margin: 0 2px;
}
.search-btn {
  background: linear-gradient(135deg, #ff8c5a 0%, #ff6b35 100%) !important;
  border: none !important;
  color: #fff !important;
  padding: 8px 24px !important;
  height: 36px !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3) !important;
}

/* ========== 卡片网格 ========== */
.reviews-body {
  min-height: 320px;
}

.review-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

@media (max-width: 900px) {
  .review-grid {
    grid-template-columns: 1fr;
  }
}

.review-card {
  background: #fff;
  border-radius: 12px;
  padding: 18px 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.2s, transform 0.2s;
}
.review-card:hover {
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
  transform: translateY(-2px);
}

/* 商品行 */
.goods-row {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}
.goods-cover {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  object-fit: cover;
  background: #f5f7fa;
  flex-shrink: 0;
}
.goods-cover-empty {
  border: 1px solid #f0f2f5;
}
.goods-meta {
  flex: 1;
  min-width: 0;
}
.goods-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f1f1f;
  margin: 0 0 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.star-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.time-text {
  margin-left: 8px;
  font-size: 12px;
  color: #999;
}

/* 内容 */
.content-row {
  margin-top: 14px;
  font-size: 13px;
  line-height: 1.7;
  color: #4a4a4a;
}
.content-label {
  color: #999;
  margin-right: 4px;
}
.content-text {
  word-break: break-word;
}

/* 评价图 */
.images-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

/* 卖家对买家的评价（v4 双打分）——与商品详情页 seller-block 视觉风格统一：
   浅橙底 + 左侧 3px 橙边，与"评价内容"行用顶部细线分隔 */
.seller-rating-row {
  margin-top: 14px;
  padding: 10px 12px;
  background: #fff8f3;
  border-left: 3px solid #ff8c5a;
  border-radius: 4px;
}
.seller-rating-head {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
}
.seller-rating-label {
  font-size: 12px;
  font-weight: 600;
  color: #ff6b35;
  letter-spacing: 0.3px;
}
.seller-rating-time {
  margin-left: auto;
  font-size: 12px;
  color: #999;
  font-weight: normal;
}
.seller-rating-body { display: flex; flex-direction: column; gap: 6px; }
.seller-stars { display: inline-flex; gap: 1px; }
.seller-rating-content {
  margin: 0;
  font-size: 13px;
  color: #555;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.image-thumb {
  width: 64px;
  height: 64px;
  border-radius: 6px;
  object-fit: cover;
  border: 1px solid #eef0f3;
  cursor: zoom-in;
  transition: transform 0.15s;
}
.image-thumb:hover {
  transform: scale(1.05);
}

/* 底部 */
.card-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed #f0f2f5;
}
.foot-actions {
  display: flex;
  gap: 16px;
}
.foot-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 12px;
  color: #5b8def;
  transition: color 0.15s;
}
.foot-link:hover { color: #4f7ce0; }
.foot-link.danger { color: #f56c6c; }
.foot-link.danger:hover { color: #e85a5a; }

.status-tag {
  display: inline-block;
  padding: 3px 12px;
  background: linear-gradient(135deg, #ffe7d6 0%, #ffd8b8 100%);
  color: #ff6b35;
  font-size: 12px;
  font-weight: 500;
  border-radius: 999px;
}

/* 分页 */
.pagination-bar {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}
</style>