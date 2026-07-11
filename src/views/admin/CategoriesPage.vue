<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import Sortable from 'sortablejs'
import {
  getCategoryTree,
  getCategoryList,
  addCategory,
  updateCategory,
  deleteCategory,
  updateCategoryStatus,
  updateCategorySort,
} from '@/api/categories'
import PageFilterBar from './components/PageFilterBar.vue'
import CategoryFormModal from './components/CategoryFormModal.vue'

// 搜索条件
const filters = reactive({
  name: '',
  status: '',
})

const fields = [
  { key: 'name', label: '分类名称', type: 'input', placeholder: '请输入分类名称' },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    placeholder: '全部',
    options: [
      { value: 1, label: '启用' },
      { value: 0, label: '禁用' },
    ],
  },
]

// 数据
const loading = ref(false)
const treeData = ref([])
const flatOptions = ref([]) // 平铺的父级候选

const fetchTree = async () => {
  loading.value = true
  try {
    const res = await getCategoryTree(filters)
    treeData.value = res
  } finally {
    loading.value = false
  }
}
const fetchFlat = async () => {
  const res = await getCategoryList()
  flatOptions.value = res
}
onMounted(() => {
  fetchTree()
  fetchFlat()
})

const handleSearch = () => fetchTree()
const handleReset = () => {
  Object.assign(filters, { name: '', status: '' })
  fetchTree()
}

// ===== 弹窗 =====
const modalVisible = ref(false)
const modalMode = ref('add')
const modalInitial = ref({})
const modalExcludeIds = ref([])

const openAdd = (parentId = 0) => {
  modalMode.value = 'add'
  modalInitial.value = { parentId, sort: 0, status: 1 }
  modalExcludeIds.value = []
  modalVisible.value = true
}

const openAddChild = (parent) => {
  modalMode.value = 'add'
  modalInitial.value = { parentId: parent.id, sort: 0, status: 1 }
  modalExcludeIds.value = []
  modalVisible.value = true
}

const openEdit = (row) => {
  modalMode.value = 'edit'
  modalInitial.value = { ...row }
  // 编辑时不能把自己 / 子级设为父级
  modalExcludeIds.value = collectChildrenIds(row.id, [row.id])
  modalVisible.value = true
}

const collectChildrenIds = (id, acc = []) => {
  const findIn = (list) => {
    for (const n of list) {
      if (n.id === id) {
        const walk = (node) => {
          acc.push(node.id)
          node.children?.forEach(walk)
        }
        walk(n)
        return true
      }
      if (n.children && findIn(n.children)) return true
    }
    return false
  }
  findIn(treeData.value)
  return acc
}

const handleSubmit = async (form) => {
  if (modalMode.value === 'add') {
    await addCategory(form)
    ElMessage.success('新增成功')
  } else {
    await updateCategory(form)
    ElMessage.success('修改成功')
  }
  modalVisible.value = false
  await fetchTree()
  await fetchFlat()
}

const handleDelete = async (row) => {
  await ElMessageBox.confirm(
    `确定要删除分类「${row.name}」吗？子分类也会一并删除！`,
    '删除确认',
    { type: 'error' }
  )
  await deleteCategory(row.id)
  ElMessage.success('删除成功')
  await fetchTree()
  await fetchFlat()
}

const handleToggleStatus = async (row) => {
  const newStatus = row.status === 1 ? 0 : 1
  await updateCategoryStatus(row.id, newStatus)
  ElMessage.success(newStatus === 1 ? '已启用' : '已禁用')
  await fetchTree()
}

// ===== 拖拽排序（仅一级可拖） =====
const initSortable = () => {
  const tbody = document.querySelector('.categories-page .el-table__body-wrapper tbody')
  if (!tbody) return
  Sortable.create(tbody, {
    handle: '.drag-handle',
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: async () => {
      // 简化：拖拽后把当前一级顺序写回后端
      const newOrder = [...tbody.querySelectorAll('tr')].map((tr) => {
        const id = Number(tr.getAttribute('data-id'))
        return id
      }).filter(Boolean)
      // 重建树
      const idMap = new Map()
      treeData.value.forEach((n) => idMap.set(n.id, { ...n, children: [] }))
      const newTree = []
      newOrder.forEach((id) => {
        const n = idMap.get(id)
        if (n) newTree.push(n)
      })
      treeData.value = newTree
      try {
        // 后端期望 [{id, sort}, ...]（SortItem 列表）
        // 把树拍平，sort 取当前一级下标即可
        const flat = []
        const walk = (nodes, level) => {
          nodes.forEach((n, idx) => {
            flat.push({ id: n.id, sort: (level === 0 ? idx : n.sort ?? idx) })
            if (n.children?.length) walk(n.children, level + 1)
          })
        }
        walk(newTree, 0)
        await updateCategorySort(flat)
        ElMessage.success('排序已更新')
      } catch {
        ElMessage.error('排序更新失败')
      }
    },
  })
}

onMounted(async () => {
  await nextTick()
  // 数据加载完后再初始化
  setTimeout(initSortable, 300)
})
</script>

<template>
  <div class="categories-page">
    <div class="page-header">
      <h2 class="page-title">商品分类</h2>
    </div>

    <PageFilterBar
      v-model="filters"
      :fields="fields"
      @search="handleSearch"
      @reset="handleReset"
    >
      <template #extra>
        <el-button type="success" :icon="Plus" @click="openAdd(0)">新增顶级分类</el-button>
      </template>
    </PageFilterBar>

    <el-alert
      title="拖拽行可调整排序，拖动到其它分类下方可更改父级分类"
      type="info"
      :closable="false"
      show-icon
      class="tip-alert"
    />

    <div class="data-card">
      <el-table
        v-loading="loading"
        :data="treeData"
        row-key="id"
        :tree-props="{ children: 'children' }"
        default-expand-all
        :row-class-name="'cat-row'"
        :header-cell-style="{ background: '#fafbfc', color: '#1f1f1f' }"
        style="width: 100%"
      >
        <el-table-column prop="name" label="分类名称" min-width="240">
          <template #default="{ row }">
            <div class="cat-name">
              <el-icon class="drag-handle"><Rank /></el-icon>
              <span class="name-text" :class="{ disabled: row.status === 0 }">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="sort" label="排序权重" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag size="small" effect="plain" type="info">{{ row.sort }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column label="状态" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" effect="light" size="small">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="createTime" label="创建时间" min-width="160" align="center" />

        <el-table-column label="操作" min-width="240" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEdit(row)">编辑</el-button>
            <el-button type="success" link size="small" @click="openAddChild(row)">添加子级</el-button>
            <el-button
              :type="row.status === 1 ? 'warning' : 'success'"
              link
              size="small"
              @click="handleToggleStatus(row)"
            >
              {{ row.status === 1 ? '禁用' : '启用' }}
            </el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>

        <template #empty>
          <el-empty description="暂无数据" />
        </template>
      </el-table>
    </div>

    <CategoryFormModal
      v-model="modalVisible"
      :mode="modalMode"
      :initial="modalInitial"
      :parent-options="flatOptions"
      :exclude-ids="modalExcludeIds"
      @submit="handleSubmit"
    />
  </div>
</template>

<style scoped>
.categories-page { min-height: 100%; }
.page-header { margin-bottom: 16px; }
.page-title { font-size: 18px; font-weight: 600; color: #1f1f1f; margin: 0; }

.tip-alert {
  margin-bottom: 12px;
  border-radius: 8px;
}

.tip-alert :deep(.el-alert__title) {
  font-size: 13px;
  color: #666;
}

.data-card {
  background: #fff;
  border-radius: 12px;
  padding: 18px 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.cat-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.drag-handle {
  cursor: grab;
  color: #c0c4cc;
  font-size: 14px;
  transition: color 0.2s;
}

.drag-handle:hover {
  color: #ff6b35;
}

.name-text {
  color: #1f1f1f;
  font-weight: 500;
}

.name-text.disabled {
  color: #999;
  text-decoration: line-through;
}

:deep(.sortable-ghost) {
  background: #fff7f2 !important;
  opacity: 0.7;
}

:deep(.el-table__row) td {
  padding: 10px 0;
}
</style>
