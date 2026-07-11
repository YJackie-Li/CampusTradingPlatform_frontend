<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Search,
  RefreshLeft,
  ShoppingCart,
  ChatLineRound,
  Clock,
  Delete,
} from '@element-plus/icons-vue'
import { getBrowseHistory, saleStatusText } from '@/api/goods'

const router = useRouter()

const filters = reactive({
  orderDesc: true, // true=浏览时间倒序(最近浏览在前),false=正序
  pageNum: 1,
  pageSize: 12,
})

const loading = ref(false)
const list = ref([])
const total = ref(0)

const fetchList = async () => {
  loading.value = true
  try {
    const res = await getBrowseHistory({
      pageNum: filters.pageNum,
      pageSize: filters.pageSize,
      orderDesc: filters.orderDesc,
    })
    list.value = res.records || []
    total.value = res.total || 0
  } finally {
    loading.value = false
  }
}

onMounted(fetchList)

const handlePageChange = (p) => {
  filters.pageNum = p
  fetchList()
}
const handleSizeChange = (s) => {
  filters.pageSize = s
  filters.pageNum = 1
  fetchList()
}
const handleRefresh = () => {
  filters.pageNum = 1
  fetchList()
}
const handleSortChange = () => {
  filters.pageNum = 1
  fetchList()
}

// ===== 跳转 =====
const goDetail = (id) => {
  router.push(`/user-home/product-detail/${id}`)
}
const goBuy = (g) => {
  if (g.saleStatus !== 1) {
    ElMessage.warning('该商品当前不在售，无法购买')
    return
  }
  router.push({ path: '/user-home/create-order', query: { goodsId: g.id } })
}
const goContact = (g) => {
  router.push({
    path: '/user-home/chat',
    query: {
      peerId: g.sellerId,
      goodsId: g.id,
      goodsTitle: g.title,
      goodsCover: g.cover,
    },
  })
}

// ===== 状态徽标 =====
const saleTagType = (s) =>
  ({ 0: 'info', 1: 'success', 2: 'warning', 3: 'info' }[s] || 'info')

// ===== 时间格式 =====
const formatViewTime = (t) => {
  if (!t) return ''
  // 输出 YYYY-MM-DD HH:mm（带年份，去秒）
  const m = String(t).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
  if (!m) return t
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`
}

const priceColor = (s) => (s === 1 ? '#ff6b35' : '#bbb')
</script>

<template>
  <div class="browse-page">
    <!-- ====== 顶部提示 + 操作 ====== -->
    <div class="tip-card">
      <div class="tip-left">
        <el-icon :size="18" color="#ff6b35"><Clock /></el-icon>
        <span class="tip-text">
          当前按<strong>{{ filters.orderDesc ? '倒序' : '正序' }}</strong>排列（共 {{ total }} 条）
        </span>
      </div>
      <div class="tip-right">
        <span class="sort-label">浏览时间</span>
        <el-radio-group v-model="filters.orderDesc" size="small" @change="handleSortChange">
          <el-radio-button :value="true">倒序</el-radio-button>
          <el-radio-button :value="false">正序</el-radio-button>
        </el-radio-group>
        <el-button :icon="RefreshLeft" size="small" @click="handleRefresh">刷新</el-button>
      </div>
    </div>

    <!-- ====== 列表卡 ====== -->
    <div class="data-card" v-loading="loading">
      <el-empty v-if="!loading && list.length === 0" description="暂无浏览历史" />

      <div v-else class="product-grid">
        <div
          v-for="g in list"
          :key="g.id"
          class="product-card"
          :class="{ disabled: g.saleStatus !== 1 }"
        >
          <!-- 缩略图 -->
          <div class="cover-wrap" @click="goDetail(g.id)">
            <img v-if="g.cover" :src="g.cover" :alt="g.title" class="cover-img" />
            <div v-else class="cover-fallback">{{ g.title?.slice(0, 1) || '?' }}</div>
            <span v-if="g.saleStatus === 3" class="sold-mask">已售</span>
            <span v-else-if="g.saleStatus === 2" class="off-mask">已下架</span>
            <span v-else-if="g.saleStatus === 0" class="off-mask">未上架</span>
          </div>

          <!-- 信息 -->
          <div class="info">
            <h4 class="title" :title="g.title" @click="goDetail(g.id)">{{ g.title }}</h4>
            <div class="price-row">
              <span class="price" :style="{ color: priceColor(g.saleStatus) }">
                <span class="currency">¥</span>
                <span class="num">{{ g.price }}</span>
              </span>
              <span class="category">{{ g.categoryName || '未分类' }}</span>
            </div>
            <div class="meta-row">
              <span class="view-time">
                <el-icon :size="12"><Clock /></el-icon>
                浏览于 {{ formatViewTime(g.viewTime) || '-' }}
              </span>
              <el-tag
                :type="saleTagType(g.saleStatus)"
                effect="plain"
                size="small"
                round
              >{{ saleStatusText(g.saleStatus) }}</el-tag>
            </div>
            <!-- 操作 -->
            <div class="actions">
              <el-button
                type="primary"
                size="small"
                :icon="ShoppingCart"
                :disabled="g.saleStatus !== 1"
                @click="goBuy(g)"
              >立即购买</el-button>
              <el-button
                size="small"
                :icon="ChatLineRound"
                @click="goContact(g)"
              >联系卖家</el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div v-if="total > 0" class="pagination">
        <span class="total">共 {{ total }} 条浏览记录</span>
        <el-pagination
          v-model:current-page="filters.pageNum"
          v-model:page-size="filters.pageSize"
          :page-sizes="[12, 24, 48]"
          :total="total"
          layout="sizes, prev, pager, next, jumper"
          background
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.browse-page {
  min-height: 100%;
}

/* ========== 提示卡 ========== */
.tip-card {
  background: #fff;
  border-radius: 12px;
  padding: 14px 20px;
  margin-bottom: 14px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.tip-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.tip-text {
  font-size: 13px;
  color: #666;
}
.tip-text strong {
  color: #ff6b35;
  font-weight: 700;
  margin: 0 2px;
}
.tip-right {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.sort-label {
  font-size: 13px;
  color: #555;
  font-weight: 500;
}

/* ========== 列表卡 ========== */
.data-card {
  background: #fff;
  border-radius: 12px;
  padding: 18px 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  min-height: 320px;
}

/* ========== 网格 ========== */
.product-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

@media (max-width: 1200px) {
  .product-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 880px) {
  .product-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .product-grid {
    grid-template-columns: 1fr;
  }
}

.product-card {
  position: relative;
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.25s ease;
  display: flex;
  flex-direction: column;
}
.product-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
  border-color: #ffd8b8;
}
.product-card.disabled {
  opacity: 0.78;
}

/* 缩略图 */
.cover-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: #f5f7fa;
  cursor: pointer;
  overflow: hidden;
}
.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}
.cover-wrap:hover .cover-img {
  transform: scale(1.04);
}
.cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.15);
  background: linear-gradient(135deg, #fff5e6 0%, #ffe7d6 100%);
}
.sold-mask,
.off-mask {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-12deg);
  padding: 6px 24px;
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 2px;
  border-radius: 4px;
}
.sold-mask {
  background: rgba(0, 0, 0, 0.6);
}
.off-mask {
  background: rgba(255, 107, 53, 0.85);
}

/* 信息 */
.info {
  padding: 12px 12px 8px;
  display: flex;
  flex-direction: column;
  flex: 1;
}
.title {
  font-size: 14px;
  font-weight: 600;
  color: #1f1f1f;
  margin: 0 0 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.title:hover {
  color: #ff6b35;
}

.price-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
}
.price {
  color: #ff6b35;
  font-weight: 700;
}
.price .currency {
  font-size: 13px;
  margin-right: 2px;
}
.price .num {
  font-size: 20px;
  letter-spacing: 0.5px;
}
.category {
  font-size: 11px;
  color: #999;
  background: #f5f7fa;
  padding: 2px 8px;
  border-radius: 999px;
}

.meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: #999;
  margin-bottom: 10px;
}
.view-time {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: #909399;
}

/* 操作 */
.actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: auto;
}
.actions :deep(.el-button) {
  flex: 1;
  min-width: 0;
  padding: 5px 4px !important;
  font-size: 12px !important;
  height: 28px !important;
}
.actions :deep(.el-button .el-icon) {
  margin-right: 2px !important;
}

/* ========== 分页 ========== */
.pagination {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-top: 20px;
  gap: 16px;
}
.total {
  font-size: 13px;
  color: #666;
}
.pagination :deep(.el-pager li.is-active) {
  background: linear-gradient(135deg, #ff8c5a 0%, #ff6b35 100%) !important;
  color: #fff !important;
}
</style>