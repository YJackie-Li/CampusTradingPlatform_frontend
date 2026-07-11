<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search,
  RefreshLeft,
  Plus,
} from '@element-plus/icons-vue'
import {
  getMyGoods,
  addGoods,
  updateGoods,
  deleteGoods,
  batchDeleteGoods,
  onSaleGoods,
  offSaleGoods,
  auditStatusText,
  saleStatusText,
} from '@/api/goods'
import { getCategoryList } from '@/api/categories'
import ProductFormModal from './components/ProductFormModal.vue'
import ImageViewer from '@/components/ImageViewer.vue'

const filters = reactive({
  title: '',
  saleStatus: '', // ''=全部，0=未上架，1=在售，2=已下架，3=已售
  auditStatus: '', // ''=全部，0=待审核，1=已通过，2=已拒绝
  categoryId: '', // 分类
  minPrice: '', // 价格下限
  maxPrice: '', // 价格上限
  orderDesc: true, // true=按发布时间倒序(新→旧),false=正序(旧→新)
  pageNum: 1,
  pageSize: 10,
})

const loading = ref(false)
const list = ref([])
const total = ref(0)
const categories = ref([])

const fetchCategories = async () => {
  try {
    const res = await getCategoryList()
    categories.value = (res || []).filter((c) => c.status === 1)
  } catch {
    categories.value = []
  }
}

const fetchList = async () => {
  loading.value = true
  try {
    const res = await getMyGoods(filters)
    list.value = res.records
    total.value = res.total
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
  // 重置：将所有筛选条件清空，回到第一页并刷新
  Object.assign(filters, {
    title: '',
    saleStatus: '',
    auditStatus: '',
    categoryId: '',
    minPrice: '',
    maxPrice: '',
    orderDesc: true,
    pageNum: 1,
    pageSize: 10,
  })
  fetchList()
}
const handleSortChange = () => {
  filters.pageNum = 1
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

// 发布/编辑 Modal
const modalVisible = ref(false)
const modalMode = ref('add')
const modalInitial = ref({})

const openPublish = () => {
  modalMode.value = 'add'
  modalInitial.value = { conditionLevel: 9, tradeMethod: 'FACE_TO_FACE' }
  modalVisible.value = true
}
const openEdit = (row) => {
  modalMode.value = 'edit'
  modalInitial.value = { ...row }
  modalVisible.value = true
}

const handleSubmit = async (form) => {
  if (modalMode.value === 'add') {
    await addGoods({ ...form, saleStatus: 1 })
    ElMessage.success('发布成功，等待审核')
  } else {
    await updateGoods(form)
    ElMessage.success('修改成功')
  }
  modalVisible.value = false
  fetchList()
}

const handleToggleSale = async (row) => {
  const onSale = row.saleStatus === 1
  const action = onSale ? '下架' : '上架'
  await ElMessageBox.confirm(`确定要${action}商品「${row.title}」吗？`, `${action}确认`, { type: 'warning' })
  if (onSale) await offSaleGoods(row.id)
  else await onSaleGoods(row.id)
  ElMessage.success(`${action}成功`)
  fetchList()
}

const handleDelete = async (row) => {
  await ElMessageBox.confirm(`确定要删除商品「${row.title}」吗？`, '删除确认', { type: 'error' })
  await deleteGoods(row.id)
  ElMessage.success('删除成功')
  fetchList()
}

// ============ 批量删除 ============
// el-table 多选的状态：选中行数组
const selection = ref([])
const onSelectionChange = (rows) => {
  // 用 .slice() 切断引用，避免 el-table 后续内部替换触发副作用
  selection.value = (rows || []).slice()
}

// 封面点击放大（共享 ImageViewer：滚轮缩放 / 拖拽平移）
const coverViewerOpen = ref(false)
const coverViewerList = ref([])
const coverViewerIndex = ref(0)
const openCoverViewer = (idx) => {
  // 仅取当前页里有封面的行；空封面会被过滤掉，避免预览器显示坏图
  coverViewerList.value = list.value
    .map((r) => r.cover)
    .filter((u) => typeof u === 'string' && u.length)
  coverViewerIndex.value = Math.min(idx, Math.max(coverViewerList.value.length - 1, 0))
  coverViewerOpen.value = true
}

const handleBatchDelete = async () => {
  if (!selection.value.length) {
    ElMessage.warning('请先勾选要删除的商品')
    return
  }
  const ids = selection.value.map((r) => r.id)
  const titles = selection.value.map((r) => r.title).filter(Boolean)
  const preview =
    titles.length <= 3
      ? titles.join('、')
      : `${titles.slice(0, 3).join('、')} 等 ${titles.length} 件`
  try {
    await ElMessageBox.confirm(
      `确定要删除以下商品吗？\n${preview}\n\n该操作不可撤销`,
      '批量删除确认',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'error' },
    )
  } catch {
    return
  }
  try {
    await batchDeleteGoods(ids)
    ElMessage.success(`已删除 ${ids.length} 件商品`)
    selection.value = []
    fetchList()
  } catch (err) {
    ElMessage.error(err?.message || '批量删除失败')
  }
}

const saleTagType = (s) => ({ 0: 'info', 1: 'success', 2: 'warning', 3: 'info' }[s] || 'info')
const auditTagType = (s) => ({ 0: 'warning', 1: 'success', 2: 'danger' }[s] || 'info')
</script>

<template>
  <div class="my-products-page">
    <div class="filter-bar">
      <div class="filter-fields">
        <div class="filter-item">
          <label>标题</label>
          <el-input
            v-model="filters.title"
            placeholder="搜索商品标题"
            clearable
            class="filter-input"
          />
        </div>
        <div class="filter-item">
          <label>分类</label>
          <el-select v-model="filters.categoryId" placeholder="全部分类" clearable class="filter-input">
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
          <label>售卖状态</label>
          <el-select v-model="filters.saleStatus" placeholder="全部" clearable class="filter-input">
            <el-option label="在售" :value="1" />
            <el-option label="已下架" :value="2" />
            <el-option label="未上架" :value="0" />
            <el-option label="已售" :value="3" />
          </el-select>
        </div>
        <div class="filter-item">
          <label>审核状态</label>
          <el-select v-model="filters.auditStatus" placeholder="全部" clearable class="filter-input">
            <el-option label="待审核" :value="0" />
            <el-option label="已通过" :value="1" />
            <el-option label="已拒绝" :value="2" />
          </el-select>
        </div>
        <div class="filter-item">
          <label>时间排序</label>
          <el-radio-group v-model="filters.orderDesc" size="small" @change="handleSortChange">
            <el-radio-button :value="true">倒序</el-radio-button>
            <el-radio-button :value="false">正序</el-radio-button>
          </el-radio-group>
        </div>
        <div class="filter-buttons">
          <el-button
            type="danger"
            :disabled="!selection.length"
            @click="handleBatchDelete"
          >
            批量删除<span v-if="selection.length">（已选 {{ selection.length }}）</span>
          </el-button>
          <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
          <el-button :icon="RefreshLeft" @click="handleReset">重置</el-button>
          <el-button type="success" :icon="Plus" @click="openPublish">发布商品</el-button>
        </div>
      </div>
    </div>

    <div class="data-card">
      <el-table
        v-loading="loading"
        :data="list"
        stripe
        style="width: 100%"
        :header-cell-style="{ background: '#fafbfc', color: '#1f1f1f' }"
        @selection-change="onSelectionChange"
      >
        <!-- 多选列：表头复选框与每行复选框；宽度 50 居中即可 -->
        <el-table-column type="selection" width="50" align="center" />
        <el-table-column label="封面" min-width="80" align="center">
          <template #default="{ row, $index }">
            <img
              v-if="row.cover"
              :src="row.cover"
              class="cover-thumb"
              alt="cover"
              @click="openCoverViewer($index)"
            />
            <div v-else class="cover-thumb cover-thumb-empty"></div>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="商品标题" min-width="200" align="center" />
        <el-table-column prop="categoryName" label="分类" min-width="100" align="center" />
        <el-table-column label="价格" min-width="100" align="center">
          <template #default="{ row }">
            <span class="price">¥{{ row.price }}</span>
          </template>
        </el-table-column>
        <el-table-column label="库存" min-width="100" align="center">
          <template #default="{ row }">
            <span :class="['stock', (row.stock ?? row.quantity ?? 0) <= 0 ? 'stock-out' : ((row.stock ?? row.quantity ?? 0) <= 2 ? 'stock-low' : '')]">
              {{ row.stock ?? row.quantity ?? 0 }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" min-width="120" align="center">
          <template #default="{ row }">
            <div class="status-cell">
              <el-tag :type="auditTagType(row.auditStatus)" effect="light" size="small">
                {{ auditStatusText(row.auditStatus) }}
              </el-tag>
              <el-tag :type="saleTagType(row.saleStatus)" effect="plain" size="small">
                {{ saleStatusText(row.saleStatus) }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="发布时间" min-width="160" align="center" />
        <el-table-column label="操作" min-width="220" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEdit(row)">编辑</el-button>
            <el-button
              :type="row.saleStatus === 1 ? 'warning' : 'success'"
              link
              size="small"
              @click="handleToggleSale(row)"
            >
              {{ row.saleStatus === 1 ? '下架' : '上架' }}
            </el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>

        <template #empty>
          <el-empty description="暂无商品" />
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

    <ProductFormModal
      v-model="modalVisible"
      :mode="modalMode"
      :initial="modalInitial"
      @submit="handleSubmit"
    />

    <!-- 封面预览：共享 ImageViewer，支持滚轮缩放 / 拖拽平移 / 左右切换 -->
    <ImageViewer
      v-model="coverViewerOpen"
      :src-list="coverViewerList"
      :start-index="coverViewerIndex"
      alt="商品封面"
    />
  </div>
</template>

<style scoped>
.my-products-page { min-height: 100%; }

.filter-bar {
  background: #fff;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.filter-fields {
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
  width: 180px;
}

.price-range {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.price-input {
  width: 100px;
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

.data-card {
  background: #fff;
  border-radius: 12px;
  padding: 18px 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.cover-thumb {
  width: 50px;
  height: 50px;
  border-radius: 6px;
  background: #f5f7fa;
  object-fit: cover;
  cursor: zoom-in;
  transition: transform 0.15s;
}
.cover-thumb:hover {
  transform: scale(1.05);
}
.cover-thumb-empty {
  border: 1px solid #eef0f3;
  cursor: default;
}

.price { color: #ff6b35; font-weight: 600; }
.stock { font-weight: 600; color: #1f1f1f; }
.stock-low { color: #fa8c16; }
.stock-out { color: #ff4d4f; }

.status-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}

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
</style>