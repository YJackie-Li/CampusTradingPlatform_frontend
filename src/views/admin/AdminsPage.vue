<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getAdminPage,
  addAdmin,
  updateAdmin,
  deleteAdmin,
  updateAdminStatus,
} from '@/api/admins'
import PageFilterBar from './components/PageFilterBar.vue'
import UserFormModal from './components/UserFormModal.vue'

const filters = reactive({
  username: '',
  nickname: '',
  phone: '',
  status: '',
  pageNum: 1,
  pageSize: 10,
})

const fields = [
  { key: 'username', label: '账号', type: 'input', placeholder: '请输入账号' },
  { key: 'nickname', label: '用户名', type: 'input', placeholder: '请输入用户名' },
  { key: 'phone', label: '手机号', type: 'input', placeholder: '请输入手机号' },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    placeholder: '全部',
    options: [
      { value: 1, label: '正常' },
      { value: 0, label: '封号' },
    ],
  },
]

const loading = ref(false)
const list = ref([])
const total = ref(0)

const fetchList = async () => {
  loading.value = true
  try {
    const res = await getAdminPage(filters)
    list.value = res.records
    total.value = res.total
  } finally {
    loading.value = false
  }
}
onMounted(fetchList)

// 时间格式化：后端 ISO 串 → "YYYY-MM-DD HH:mm"
const shortTime = (t) => {
  if (!t) return ''
  const m = String(t).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`
  return t
}

const handleSearch = () => {
  filters.pageNum = 1
  fetchList()
}
const handleReset = () => {
  Object.assign(filters, { username: '', nickname: '', phone: '', status: '', pageNum: 1, pageSize: 10 })
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

const modalVisible = ref(false)
const modalMode = ref('add')
const modalInitial = ref({})

const openAdd = () => {
  modalMode.value = 'add'
  modalInitial.value = { status: 1, gender: 1 }
  modalVisible.value = true
}
const openEdit = (row) => {
  modalMode.value = 'edit'
  modalInitial.value = { ...row }
  modalVisible.value = true
}

const handleSubmit = async (form) => {
  if (modalMode.value === 'add') {
    await addAdmin({ ...form, role: 'ADMIN' })
    ElMessage.success('新增成功')
  } else {
    await updateAdmin(form)
    ElMessage.success('修改成功')
  }
  modalVisible.value = false
  fetchList()
}

const handleToggleStatus = async (row) => {
  const newStatus = row.status === 1 ? 0 : 1
  const action = newStatus === 1 ? '解封' : '封号'
  await ElMessageBox.confirm(
    `确定要${action}管理员「${row.username}」吗？`,
    `${action}确认`,
    { type: 'warning' }
  )
  await updateAdminStatus(row.id, newStatus)
  ElMessage.success(`${action}成功`)
  fetchList()
}

const handleDelete = async (row) => {
  if (row.username === 'admin') {
    ElMessage.warning('不能删除超级管理员')
    return
  }
  await ElMessageBox.confirm(
    `确定要删除管理员「${row.username}」吗？该操作不可恢复！`,
    '删除确认',
    { type: 'error' }
  )
  await deleteAdmin(row.id)
  ElMessage.success('删除成功')
  fetchList()
}

const genderText = (g) => (g === 1 ? '男' : g === 2 ? '女' : '-')
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">管理员管理</h2>
    </div>

    <PageFilterBar
      v-model="filters"
      :fields="fields"
      @search="handleSearch"
      @reset="handleReset"
    >
      <template #extra>
        <el-button type="success" :icon="Plus" @click="openAdd">新增管理员</el-button>
      </template>
    </PageFilterBar>

    <div class="data-card">
      <el-table
        v-loading="loading"
        :data="list"
        stripe
        style="width: 100%"
        :header-cell-style="{ background: '#fafbfc', color: '#1f1f1f' }"
      >
        <el-table-column prop="username" label="账号" min-width="120" align="center" />
        <el-table-column prop="nickname" label="用户名" min-width="160" align="center" />
        <el-table-column label="头像" min-width="80" align="center">
          <template #default="{ row }">
            <el-avatar :size="36" :src="row.avatar">
              {{ (row.nickname || row.username || 'A').slice(0, 1) }}
            </el-avatar>
          </template>
        </el-table-column>
        <el-table-column label="性别" min-width="80" align="center">
          <template #default="{ row }">{{ genderText(row.gender) }}</template>
        </el-table-column>
        <el-table-column prop="phone" label="手机号" min-width="140" align="center" />
        <el-table-column label="注册时间" min-width="170" align="center">
          <template #default="{ row }">
            <span v-if="row.createTime" :title="row.createTime">
              {{ shortTime(row.createTime) }}
            </span>
            <span v-else class="muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="最后登录" min-width="170" align="center">
          <template #default="{ row }">
            <span v-if="row.lastLoginTime" :title="row.lastLoginTime">
              {{ shortTime(row.lastLoginTime) }}
            </span>
            <span v-else class="muted">从未登录</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" effect="light" size="small">
              {{ row.status === 1 ? '正常' : '已封号' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="220" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEdit(row)">编辑</el-button>
            <el-button
              :type="row.status === 1 ? 'warning' : 'success'"
              link
              size="small"
              @click="handleToggleStatus(row)"
            >
              {{ row.status === 1 ? '封号' : '解封' }}
            </el-button>
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

    <UserFormModal
      v-model="modalVisible"
      :mode="modalMode"
      :initial="modalInitial"
      @submit="handleSubmit"
    />
  </div>
</template>

<style scoped>
.page-container { min-height: 100%; }
.page-header { margin-bottom: 16px; }
.page-title { font-size: 18px; font-weight: 600; color: #1f1f1f; margin: 0; }
.data-card { background: #fff; border-radius: 12px; padding: 18px 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
.pagination { display: flex; justify-content: flex-end; align-items: center; margin-top: 16px; gap: 16px; }
.total { font-size: 13px; color: #666; }
.pagination :deep(.el-pager li.is-active) {
  background: linear-gradient(135deg, #ff8c5a 0%, #ff6b35 100%) !important;
  color: #fff !important;
}
.muted { color: #bbb; font-size: 12px; }
</style>
