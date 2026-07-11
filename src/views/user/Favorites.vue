<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search,
  RefreshLeft,
  Delete,
  ShoppingCart,
  ChatLineRound,
  StarFilled,
  View,
} from '@element-plus/icons-vue'
import {
  getFavoritePage,
  removeFavorite,
  removeFavoritesBatch,
  auditStatusText,
  saleStatusText,
} from '@/api/goods'
import { getCategoryList } from '@/api/categories'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
const currentUserId = computed(() => userStore.userInfo?.id)

// 筛选
const filters = reactive({
  keyword: '',
  saleStatus: '', // ''=全部，1=在售，2=已下架，3=已售
  categoryId: '', // 分类 id；空=全部
  minPrice: '', // 价格区间下限
  maxPrice: '', // 价格区间上限
  orderDesc: true, // true=收藏时间倒序(新→旧),false=正序(旧→新)
  pageNum: 1,
  pageSize: 12,
})

const loading = ref(false)
const list = ref([])
const total = ref(0)
const categories = ref([])

// 批量选择
const selectedIds = ref([])

const fetchCategories = async () => {
  try {
    const res = await getCategoryList()
    // 仅显示叶子分类（带商品的）
    categories.value = (res || []).filter((c) => c.status === 1)
  } catch {
    categories.value = []
  }
}

const fetchList = async () => {
  loading.value = true
  try {
    const res = await getFavoritePage({
      keyword: filters.keyword.trim(),
      categoryId: filters.categoryId,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      orderDesc: filters.orderDesc,
      pageNum: filters.pageNum,
      pageSize: filters.pageSize,
    })
    list.value = res.records
    total.value = res.total
    // 跨页保留选择：仅保留当前页里仍然选中的项
    selectedIds.value = selectedIds.value.filter((id) =>
      list.value.some((g) => g.id === id)
    )
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchCategories()
  fetchList()
})

const handleSearch = () => {
  filters.pageNum = 1
  fetchList()
}
const handleReset = () => {
  // 重置：将所有筛选条件恢复到初始值并重新加载第一页
  Object.assign(filters, {
    keyword: '',
    saleStatus: '',
    categoryId: '',
    minPrice: '',
    maxPrice: '',
    orderDesc: true,
    pageNum: 1,
    pageSize: 12,
  })
  selectedIds.value = []
  fetchList()
}
const handleSortChange = () => {
  filters.pageNum = 1
  fetchList()
}
const handlePageChange = (p) => {
  filters.pageNum = p
  fetchList()
}
const handleSizeChange = (s) => {
  filters.pageSize = s
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
  // 不能跟自己聊天（后端 ChatService.openOrCreate 也会拒绝，
  // 这里提前拦下，避免一次没必要的请求 + 给个清楚的提示）
  if (currentUserId.value && g.sellerId === currentUserId.value) {
    ElMessage.warning('不能联系自己的商品')
    return
  }
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

// ===== 单条取消收藏 =====
const handleRemove = async (g) => {
  try {
    await ElMessageBox.confirm(
      `确认取消收藏「${g.title}」吗？`,
      '取消收藏',
      { type: 'warning', confirmButtonText: '取消收藏', cancelButtonText: '再想想' }
    )
  } catch {
    return
  }
  await removeFavorite(g.id)
  ElMessage.success('已取消收藏')
  // 如果删完当前页空了，回退一页
  if (list.value.length === 1 && filters.pageNum > 1) {
    filters.pageNum -= 1
  }
  fetchList()
}

// ===== 批量多选 =====
const isAllSelected = computed(
  () => list.value.length > 0 && list.value.every((g) => selectedIds.value.includes(g.id))
)
const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = list.value.map((g) => g.id)
  }
}
const toggleSelect = (id) => {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(id)
}
const handleBatchRemove = async () => {
  if (selectedIds.value.length === 0) {
    ElMessage.warning('请先勾选要取消收藏的商品')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认取消选中的 ${selectedIds.value.length} 件收藏吗？`,
      '批量取消收藏',
      { type: 'warning', confirmButtonText: '确认', cancelButtonText: '再想想' }
    )
  } catch {
    return
  }
  await removeFavoritesBatch(selectedIds.value)
  ElMessage.success(`已取消 ${selectedIds.value.length} 件收藏`)
  selectedIds.value = []
  if (list.value.length === selectedIds.value.length && filters.pageNum > 1) {
    filters.pageNum -= 1
  }
  fetchList()
}

// ===== 状态徽标 =====
const saleTagType = (s) =>
  ({ 0: 'info', 1: 'success', 2: 'warning', 3: 'info' }[s] || 'info')

// ===== 时间格式 =====
const shortTime = (t) => {
  if (!t) return ''
  // 输出 YYYY-MM-DD HH:mm（带年份，去秒）
  const m = String(t).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`
  return t
}

// 价格颜色
const priceColor = (s) =>
  s === 1 ? '#ff6b35' : '#bbb'
</script>

<template>
  <div class="favorites-page">
    <!-- ====== 顶部搜索卡 ====== -->
    <div class="filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <label>商品标题</label>
          <el-input
            v-model="filters.keyword"
            placeholder="搜索已收藏商品标题"
            clearable
            class="filter-input"
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>
        <div class="filter-item">
          <label>分类</label>
          <el-select
            v-model="filters.categoryId"
            placeholder="全部分类"
            clearable
            class="filter-input"
          >
            <el-option
              v-for="c in categories"
              :key="c.id"
              :label="c.name"
              :value="c.id"
            />
          </el-select>
        </div>
        <div class="filter-item">
          <label>价格区间</label>
          <div class="price-range">
            <el-input
              v-model.number="filters.minPrice"
              placeholder="最低价"
              clearable
              class="price-input"
              type="number"
            />
            <span class="dash">-</span>
            <el-input
              v-model.number="filters.maxPrice"
              placeholder="最高价"
              clearable
              class="price-input"
              type="number"
            />
          </div>
        </div>
        <div class="filter-item">
          <label>状态</label>
          <el-select
            v-model="filters.saleStatus"
            placeholder="全部"
            clearable
            class="filter-input"
          >
            <el-option label="在售" :value="1" />
            <el-option label="已下架" :value="2" />
            <el-option label="已售" :value="3" />
          </el-select>
        </div>
        <div class="filter-item">
          <label>收藏时间</label>
          <el-radio-group v-model="filters.orderDesc" size="small" @change="handleSortChange">
            <el-radio-button :value="true">倒序</el-radio-button>
            <el-radio-button :value="false">正序</el-radio-button>
          </el-radio-group>
        </div>
        <div v-if="list.length > 0" class="filter-batch">
          <el-button
            type="danger"
            plain
            :icon="Delete"
            :disabled="selectedIds.length === 0"
            @click="handleBatchRemove"
          >批量取消收藏</el-button>
        </div>
        <div class="filter-buttons">
          <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
          <el-button :icon="RefreshLeft" @click="handleReset">重置</el-button>
        </div>
      </div>
    </div>

    <!-- ====== 列表卡 ====== -->
    <div class="data-card" v-loading="loading">
      <!-- 批量操作工具栏（只展示全选 + 已选信息，批量按钮已挪到搜索行） -->
      <div v-if="list.length > 0" class="batch-bar">
        <el-checkbox
          :model-value="isAllSelected"
          @change="toggleSelectAll"
        >全选当前页</el-checkbox>
        <span class="batch-info">已选 {{ selectedIds.length }} 件</span>
      </div>

      <el-empty v-if="!loading && list.length === 0" description="暂无收藏" />

      <div v-else class="product-grid">
        <div
          v-for="g in list"
          :key="g.id"
          class="product-card"
          :class="{ selected: selectedIds.includes(g.id), disabled: g.saleStatus !== 1 }"
        >
          <!-- 多选框 -->
          <label class="check-box" @click.stop>
            <el-checkbox
              :model-value="selectedIds.includes(g.id)"
              @change="toggleSelect(g.id)"
            />
          </label>

          <!-- 缩略图 -->
          <div class="cover-wrap" @click="goDetail(g.id)">
            <img v-if="g.cover" :src="g.cover" :alt="g.title" class="cover-img" />
            <div v-else class="cover-fallback">{{ g.title?.slice(0, 1) || '?' }}</div>
            <span v-if="g.saleStatus === 3" class="sold-mask">已售</span>
            <span v-else-if="g.saleStatus === 2" class="off-mask">已下架</span>
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
              <span class="fav-time">
                <el-icon :size="12"><StarFilled /></el-icon>
                收藏于 {{ shortTime(g.favoriteTime) }}
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
                :disabled="!!(currentUserId && g.sellerId === currentUserId)"
                @click="goContact(g)"
              >联系卖家</el-button>
              <el-button
                size="small"
                :icon="Delete"
                type="danger"
                plain
                @click="handleRemove(g)"
              >取消收藏</el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div v-if="total > 0" class="pagination">
        <span class="total">共 {{ total }} 件收藏</span>
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
.favorites-page {
  min-height: 100%;
}

/* ========== 搜索卡 ========== */
.filter-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 14px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}
.filter-row {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  flex-wrap: wrap;
}
.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.filter-item label {
  font-size: 14px;
  color: #1f1f1f;
  font-weight: 500;
  white-space: nowrap;
}
.filter-input {
  width: 200px;
}
.price-range {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.price-input {
  width: 110px;
}
.dash {
  color: #999;
  font-weight: 600;
}
.filter-buttons {
  display: flex;
  gap: 8px;
  margin-left: auto;
  align-self: center;
}
.filter-batch {
  display: flex;
  align-items: center;
  align-self: center;
  /* 不要 margin-left:auto，让 .filter-buttons 的 auto 一次性把整组推到行尾
     这样 .filter-batch 会紧贴「搜索」按钮左侧 */
}

/* ========== 列表卡 ========== */
.data-card {
  background: #fff;
  border-radius: 12px;
  padding: 18px 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  min-height: 320px;
}

/* 批量操作栏 */
.batch-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 12px;
  margin-bottom: 14px;
  background: #fafbfc;
  border-radius: 8px;
  border: 1px dashed #e4e7ed;
}
.batch-info {
  color: #666;
  font-size: 13px;
}

/* ========== 一行四个瀑布流 ========== */
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
.product-card.selected {
  border-color: #ff8c5a;
  box-shadow: 0 0 0 2px rgba(255, 107, 53, 0.2);
}
.product-card.disabled {
  opacity: 0.78;
}

/* 多选框 */
.check-box {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 5;
  padding: 4px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
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
.fav-time {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: #fa8c16;
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