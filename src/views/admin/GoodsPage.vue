<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getAdminGoodsPage,
  getAdminGoods,
  deleteAdminGoods,
  auditStatusText,
  saleStatusText,
  tradeMethodText,
} from '@/api/goods'
import PageFilterBar from './components/PageFilterBar.vue'
import ImageViewer from '@/components/ImageViewer.vue'

const filters = reactive({
  title: '',
  auditStatus: '',
  conditionLevel: '',
  pageNum: 1,
  pageSize: 10,
})

const fields = [
  { key: 'title', label: '商品标题', type: 'input', placeholder: '请输入商品标题' },
  {
    key: 'auditStatus',
    label: '审核状态',
    type: 'select',
    placeholder: '全部',
    options: [
      { value: 0, label: '待审核' },
      { value: 1, label: '已通过' },
      { value: 2, label: '已拒绝' },
    ],
  },
  {
    key: 'conditionLevel',
    label: '新旧程度',
    type: 'select',
    placeholder: '全部',
    options: [
      { value: 9, label: '全新' },
      { value: 8, label: '九成新' },
      { value: 7, label: '八成新' },
      { value: 6, label: '七成新' },
      { value: 5, label: '五成新' },
    ],
  },
]

const loading = ref(false)
const list = ref([])
const total = ref(0)

const fetchList = async () => {
  loading.value = true
  try {
    const res = await getAdminGoodsPage(filters)
    list.value = res.records
    total.value = res.total
  } finally {
    loading.value = false
  }
}
onMounted(fetchList)

const handleSearch = () => {
  filters.pageNum = 1
  fetchList()
}
const handleReset = () => {
  Object.assign(filters, {
    title: '',
    auditStatus: '',
    conditionLevel: '',
    pageNum: 1,
    pageSize: 10,
  })
  fetchList()
}
const handlePageChange = (page) => {
  filters.pageNum = page
  fetchList()
}
const handleSizeChange = (size) => {
  filters.pageSize = size
  filters.pageNum = 1
  fetchList()
}

const handleDelete = async (row) => {
  await ElMessageBox.confirm(
    `确定要强制下架并删除商品「${row.title}」吗？`,
    '删除确认',
    { type: 'error' }
  )
  await deleteAdminGoods(row.id)
  ElMessage.success('删除成功')
  fetchList()
}

// 详情弹窗
const detailVisible = ref(false)
const detailItem = ref(null)
const handleView = async (row) => {
  const res = await getAdminGoods(row.id)
  detailItem.value = res
  detailVisible.value = true
}

// 图片预览（共享 ImageViewer：滚轮缩放 / 拖拽平移 / 左右切换）
const coverViewerOpen = ref(false)
const coverViewerSrc = ref('')
const openCover = (row) => {
  if (!row?.cover) return
  coverViewerSrc.value = row.cover
  coverViewerOpen.value = true
}
const detailImageViewerOpen = ref(false)
const detailImageViewerIndex = ref(0)
const openDetailImage = (idx) => {
  detailImageViewerIndex.value = idx
  detailImageViewerOpen.value = true
}

const auditTagType = (s) => ({ 0: 'warning', 1: 'success', 2: 'danger' }[s] || 'info')
const saleTagType = (s) => ({ 0: 'info', 1: 'success', 2: 'warning' }[s] || 'info')
const conditionText = (l) => {
  const map = { 10: '全新', 9: '几乎全新', 8: '九成新', 7: '八成新', 6: '七成新', 5: '五成新及以下' }
  return map[l] || '几乎全新'
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">商品列表</h2>
    </div>

    <PageFilterBar
      v-model="filters"
      :fields="fields"
      @search="handleSearch"
      @reset="handleReset"
    />

    <div class="data-card">
      <el-table
        v-loading="loading"
        :data="list"
        stripe
        style="width: 100%"
        :header-cell-style="{ background: '#fafbfc', color: '#1f1f1f' }"
      >
        <el-table-column prop="id" label="ID" min-width="60" align="center" />
        <el-table-column prop="title" label="商品标题" min-width="200" align="center">
          <template #default="{ row }">
            <div class="title-cell">
              <img
                v-if="row.cover"
                :src="row.cover"
                class="cover-thumb"
                alt="cover"
                @click="openCover(row)"
              />
              <span class="title-text">{{ row.title }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="发布者" min-width="120" align="center">
          <template #default="{ row }">{{ row.sellerNickname || ('用户#' + row.sellerId) }}</template>
        </el-table-column>
        <el-table-column prop="categoryName" label="分类" min-width="100" align="center" />
        <el-table-column label="价格" min-width="100" align="center">
          <template #default="{ row }">
            <span class="price">¥{{ row.price }}</span>
          </template>
        </el-table-column>
        <el-table-column label="新旧" min-width="100" align="center">
          <template #default="{ row }">{{ conditionText(row.conditionLevel) }}</template>
        </el-table-column>
        <el-table-column label="状态" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="auditTagType(row.auditStatus)" effect="light" size="small">
              {{ auditStatusText(row.auditStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="发布时间" min-width="160" align="center" />
        <el-table-column label="操作" min-width="160" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleView(row)">详情</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>

        <template #empty>
          <el-empty description="暂无数据" />
        </template>
      </el-table>

      <div class="pagination">
        <span class="total">共 {{ total }} 条</span>
        <el-pagination
          v-model:current-page="filters.pageNum"
          v-model:page-size="filters.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="sizes, prev, pager, next, jumper"
          background
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </div>

    <!-- 商品详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      title="商品详情"
      width="640px"
      align-center
    >
      <template v-if="detailItem">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="商品标题">{{ detailItem.title }}</el-descriptions-item>
          <el-descriptions-item label="分类">{{ detailItem.categoryName }}</el-descriptions-item>
          <el-descriptions-item label="价格">¥{{ detailItem.price }}</el-descriptions-item>
          <el-descriptions-item label="原价">¥{{ detailItem.originalPrice }}</el-descriptions-item>
          <el-descriptions-item label="新旧程度">{{ conditionText(detailItem.conditionLevel) }}</el-descriptions-item>
          <el-descriptions-item label="交易方式">{{ tradeMethodText(detailItem.tradeMethod) }}</el-descriptions-item>
          <el-descriptions-item label="审核状态">{{ auditStatusText(detailItem.auditStatus) }}</el-descriptions-item>
          <el-descriptions-item label="售卖状态">{{ saleStatusText(detailItem.saleStatus) }}</el-descriptions-item>
          <el-descriptions-item label="浏览/想要/收藏">
            {{ detailItem.viewCount }} / {{ detailItem.wantCount }} / {{ detailItem.favoriteCount }}
          </el-descriptions-item>
          <el-descriptions-item label="交易地点">{{ detailItem.address }}</el-descriptions-item>
          <el-descriptions-item label="发布时间" :span="2">{{ detailItem.createTime }}</el-descriptions-item>
          <el-descriptions-item label="商品描述" :span="2">{{ detailItem.description }}</el-descriptions-item>
        </el-descriptions>
        <div v-if="detailItem.images && detailItem.images.length" class="detail-images">
          <img
            v-for="(url, idx) in detailItem.images"
            :key="idx"
            :src="url"
            class="detail-img"
            alt="商品图片"
            @click="openDetailImage(idx)"
          />
        </div>
      </template>
    </el-dialog>

    <!-- 封面/详情图预览：共享 ImageViewer -->
    <ImageViewer
      v-model="coverViewerOpen"
      :src="coverViewerSrc"
      alt="商品封面"
    />
    <ImageViewer
      v-model="detailImageViewerOpen"
      :src-list="detailItem?.images || []"
      :start-index="detailImageViewerIndex"
      alt="商品图片"
    />
  </div>
</template>

<style scoped>
.page-container { min-height: 100%; }
.page-header { margin-bottom: 16px; }
.page-title { font-size: 18px; font-weight: 600; color: #1f1f1f; margin: 0; }
.data-card { background: #fff; border-radius: 12px; padding: 18px 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }

.title-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.cover-thumb {
  width: 44px;
  height: 44px;
  border-radius: 6px;
  background: #f5f7fa;
  flex-shrink: 0;
  object-fit: cover;
  cursor: zoom-in;
  transition: transform 0.15s;
}
.cover-thumb:hover { transform: scale(1.05); }
.title-text { color: #1f1f1f; }

.price { color: #ff6b35; font-weight: 600; }

.pagination {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-top: 16px;
  gap: 16px;
}
.total { font-size: 13px; color: #666; }

.pagination :deep(.el-pager li.is-active) {
  background: linear-gradient(135deg, #ff8c5a 0%, #ff6b35 100%) !important;
  color: #fff !important;
}

.detail-images {
  margin-top: 14px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.detail-img {
  width: 110px;
  height: 110px;
  border-radius: 6px;
  object-fit: cover;
  cursor: zoom-in;
  transition: transform 0.15s;
}
.detail-img:hover { transform: scale(1.05); }
</style>