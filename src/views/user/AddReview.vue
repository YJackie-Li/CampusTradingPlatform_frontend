<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, StarFilled, Plus } from '@element-plus/icons-vue'
import { getOrder } from '@/api/orders'
import { createReview } from '@/api/reviews'
import { uploadFile } from '@/api/common'
import ImageViewer from '@/components/ImageViewer.vue'

const route = useRoute()
const router = useRouter()

const orderId = computed(() => route.params.id)

const order = ref(null)
const loading = ref(true)

const loadOrder = async () => {
  loading.value = true
  try {
    const res = await getOrder(orderId.value)
    order.value = res
  } finally {
    loading.value = false
  }
}

const rating = ref(5)
const hoverIdx = ref(0)
const ratingTexts = {
  1: '非常差',
  2: '差',
  3: '一般',
  4: '满意',
  5: '非常满意',
}
const ratingDesc = computed(() => ratingTexts[rating.value] || '')

const content = ref('')
const contentLen = computed(() => content.value.length)

const fileList = ref([])
const MAX_FILES = 9
const MAX_SIZE = 2 * 1024 * 1024 // 2MB
const uploading = ref(false)

const handleUploadChange = async (file) => {
  if (fileList.value.length >= MAX_FILES) {
    ElMessage.warning(`最多上传 ${MAX_FILES} 张图片`)
    return false
  }
  const raw = file.raw
  if (!raw) return false
  if (raw.size > MAX_SIZE) {
    ElMessage.warning('单张图片不能超过 2MB')
    return false
  }
  uploading.value = true
  try {
    const res = await uploadFile(raw, 'review')
    fileList.value.push({ url: res.url, name: file.name })
    return true
  } catch (e) {
    ElMessage.error(e?.message || '图片上传失败')
    return false
  } finally {
    uploading.value = false
  }
}
const handleRemove = (idx) => {
  fileList.value.splice(idx, 1)
}

// 图片预览（上传阶段：点击缩略图可放大查看，确认无误再提交）
const viewerOpen = ref(false)
const viewerList = ref([])
const viewerIndex = ref(0)
const openImageViewer = (idx) => {
  viewerList.value = fileList.value.map((f) => f.url)
  viewerIndex.value = idx
  viewerOpen.value = true
}

const submitting = ref(false)
const handleSubmit = async () => {
  if (!rating.value) {
    ElMessage.warning('请选择评分')
    return
  }
  if (!content.value.trim()) {
    ElMessage.warning('请输入评价内容')
    return
  }
  submitting.value = true
  try {
    await createReview({
      orderId: order.value.id,
      orderNo: order.value.orderNo,
      goodsId: order.value.goodsId,
      goodsTitle: order.value.goodsTitle,
      goodsCover: order.value.goodsCover,
      reviewerId: order.value.buyerId,
      reviewerNickname: order.value.buyerNickname,
      sellerId: order.value.sellerId,
      sellerNickname: order.value.sellerNickname,
      rating: rating.value,
      content: content.value.trim(),
      images: fileList.value.map((f) => f.url),
    })
    // 把订单标记为已评价（mock）
    order.value.reviewed = true
    ElMessage.success('评价成功')
    router.replace('/user-home/reviews')
  } finally {
    submitting.value = false
  }
}

const handleBack = () => router.back()

onMounted(loadOrder)
</script>

<template>
  <div class="add-review-page">
    <main class="review-main">
      <!-- 头部：返回 + 标题 -->
      <header class="page-head">
        <div class="back-link" @click="handleBack">
          <el-icon><ArrowLeft /></el-icon>
          <span>返回</span>
        </div>
        <h1 class="page-title">发表评论</h1>
      </header>

      <div v-if="loading" class="loading">加载中...</div>

      <template v-else-if="order">
        <!-- 商品信息 -->
        <section class="card goods-card">
          <div class="goods-row">
            <img v-if="order.goodsCover" :src="order.goodsCover" class="goods-cover" alt="cover" />
            <div v-else class="goods-cover goods-cover-empty"></div>
            <div class="goods-info">
              <div class="goods-title">{{ order.goodsTitle }}</div>
              <div class="goods-price-row">
                <span class="price">¥{{ order.price }}</span>
                <span class="qty">× {{ order.quantity }}</span>
              </div>
              <div class="order-no">订单号：{{ order.orderNo }}</div>
            </div>
          </div>
        </section>

        <!-- 评分 -->
        <section class="card">
          <h2 class="card-title">商品评分</h2>
          <div class="rating-row">
            <div class="stars">
              <span
                v-for="i in 5"
                :key="i"
                class="star-item"
                :class="{
                  active: i <= (hoverIdx || rating),
                  preview: hoverIdx && i > rating && i <= hoverIdx,
                }"
                @click="rating = i"
                @mouseover="hoverIdx = i"
                @mouseleave="hoverIdx = 0"
              >
                <el-icon :size="24"><StarFilled /></el-icon>
              </span>
            </div>
            <span class="rating-desc">{{ ratingDesc }}</span>
          </div>
        </section>

        <!-- 内容 -->
        <section class="card">
          <h2 class="card-title">评价内容</h2>
          <el-input
            v-model="content"
            type="textarea"
            :rows="6"
            :maxlength="500"
            placeholder="分享你的购物体验，帮助其他小伙伴～"
            show-word-limit
          />
        </section>

        <!-- 图片 -->
        <section class="card">
          <h2 class="card-title">上传图片</h2>
          <div class="image-list">
            <div v-for="(f, idx) in fileList" :key="idx" class="image-item">
              <img :src="f.url" :alt="f.name" @click="openImageViewer(idx)" />
              <button class="remove-btn" @click="handleRemove(idx)">×</button>
            </div>
            <el-upload
              v-if="fileList.length < MAX_FILES"
              class="image-uploader"
              list-type="picture-card"
              :auto-upload="false"
              :show-file-list="false"
              accept="image/*"
              :on-change="handleUploadChange"
            >
              <el-icon class="upload-icon"><Plus /></el-icon>
            </el-upload>
          </div>
          <div class="form-tip">
            最多上传 {{ MAX_FILES }} 张，支持 JPG/PNG，单张不超过 2MB
          </div>
        </section>

        <!-- 提交 -->
        <div class="submit-bar">
          <el-button
            type="primary"
            class="submit-btn"
            :loading="submitting"
            @click="handleSubmit"
          >
            提交评价
          </el-button>
        </div>
      </template>

      <el-empty v-else description="未找到对应订单" />
    </main>

    <!-- 图片预览（共享 ImageViewer：滚轮缩放 / 拖拽平移） -->
    <ImageViewer
      v-model="viewerOpen"
      :src-list="viewerList"
      :start-index="viewerIndex"
      alt="待上传图片"
    />
  </div>
</template>

<style scoped>
.add-review-page {
  min-height: 100vh;
  background: #f5f7fa;
}

.review-main {
  max-width: 720px;
  margin: 0 auto;
  padding: 18px 24px 60px;
}

/* ========== Header ========== */
.page-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 22px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #888;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
  transition: color 0.2s;
}
.back-link:hover { color: #ff6b35; }

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: #1f1f1f;
  margin: 0;
  letter-spacing: 1px;
}

/* ========== 加载/空 ========== */
.loading {
  text-align: center;
  padding: 80px 0;
  color: #999;
}

/* ========== 通用卡片 ========== */
.card {
  background: #fff;
  border-radius: 12px;
  padding: 22px 26px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f1f1f;
  margin: 0 0 16px;
}

/* ========== 商品 ========== */
.goods-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.goods-cover {
  width: 72px;
  height: 72px;
  border-radius: 8px;
  object-fit: cover;
  background: #f5f7fa;
  flex-shrink: 0;
}
.goods-cover-empty {
  border: 1px solid #f0f2f5;
}
.goods-info { flex: 1; min-width: 0; }
.goods-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f1f1f;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.goods-price-row { margin-bottom: 6px; }
.price {
  color: #ff6b35;
  font-weight: 700;
  font-size: 16px;
  margin-right: 6px;
}
.qty { color: #888; font-size: 13px; }
.order-no { font-size: 12px; color: #999; }

/* ========== 评分 ========== */
.rating-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.stars { display: inline-flex; gap: 6px; }
.star-item {
  cursor: pointer;
  color: #e4e7ed;
  transition: color 0.15s, transform 0.15s;
}
.star-item:hover { transform: scale(1.1); }
.star-item.active,
.star-item.preview { color: #ffb300; }
.rating-desc {
  color: #ff6b35;
  font-size: 14px;
  font-weight: 500;
}

/* ========== 图片上传 ========== */
.image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 8px;
}
.image-item {
  position: relative;
  width: 88px;
  height: 88px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #eef0f3;
  background: #fafbfc;
}
.image-item img { width: 100%; height: 100%; object-fit: cover; cursor: zoom-in; }
.remove-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  border: none;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.upload-icon { font-size: 22px; color: #5b8def; }
.image-uploader :deep(.el-upload--picture-card) {
  width: 88px;
  height: 88px;
  border-radius: 6px;
}

.form-tip {
  font-size: 12px;
  color: #999;
  margin-top: 6px;
}

/* ========== 提交按钮（蓝色，匹配截图） ========== */
.submit-bar {
  display: flex;
  justify-content: center;
  margin-top: 32px;
}
.submit-btn {
  width: 200px;
  height: 44px !important;
  font-size: 15px !important;
  background: linear-gradient(135deg, #5b8def 0%, #4f7ce0 100%) !important;
  border: none !important;
  border-radius: 999px !important;
  box-shadow: 0 4px 12px rgba(79, 124, 224, 0.3) !important;
  letter-spacing: 1px;
}
.submit-btn:hover {
  background: linear-gradient(135deg, #6e9bff 0%, #5a87e8 100%) !important;
}
</style>