<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Search } from '@element-plus/icons-vue'
import {
  getAdminCampusPersonPage,
  createAdminCampusPerson,
  updateAdminCampusPerson,
  deleteAdminCampusPerson,
  personTypeText,
} from '@/api/verify'
import PageFilterBar from './PageFilterBar.vue'

// ===== 搜索条件 =====
const filters = reactive({
  keyword: '',
  personType: '',
  status: '',
  pageNum: 1,
  pageSize: 10,
})

const fields = [
  { key: 'keyword', label: '关键词', type: 'input', placeholder: '学号/工号 或 真实姓名' },
  {
    key: 'personType',
    label: '人员类型',
    type: 'select',
    placeholder: '全部',
    options: [
      { value: 1, label: '学生' },
      { value: 2, label: '教师' },
      { value: 3, label: '其他' },
    ],
  },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    placeholder: '全部',
    options: [
      { value: 1, label: '在读/在职' },
      { value: 2, label: '已毕业/已离职' },
      { value: 3, label: '禁用' },
    ],
  },
]

const loading = ref(false)
const list = ref([])
const total = ref(0)

const fetchList = async () => {
  loading.value = true
  try {
    const res = await getAdminCampusPersonPage(filters)
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
    keyword: '',
    personType: '',
    status: '',
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

// ===== 弹窗 =====
const dialogVisible = ref(false)
const dialogMode = ref('add')  // 'add' | 'edit'
const formRef = ref()
const submitting = ref(false)
const form = reactive({
  id: null,
  campusId: '',
  realName: '',
  personType: 1,
  department: '',
  status: 1,
  enrolledYear: null,
})

const rules = {
  campusId: [
    { required: true, message: '请输入学号/工号', trigger: 'blur' },
    { min: 4, max: 20, message: '长度 4-20', trigger: 'blur' },
  ],
  realName: [
    { required: true, message: '请输入真实姓名', trigger: 'blur' },
    { min: 2, max: 30, message: '长度 2-30', trigger: 'blur' },
  ],
  personType: [
    { required: true, message: '请选择人员类型', trigger: 'change' },
  ],
  status: [
    { required: true, message: '请选择状态', trigger: 'change' },
  ],
}

const resetForm = () => {
  Object.assign(form, {
    id: null,
    campusId: '',
    realName: '',
    personType: 1,
    department: '',
    status: 1,
    enrolledYear: null,
  })
}

const openAdd = () => {
  dialogMode.value = 'add'
  resetForm()
  dialogVisible.value = true
}

const openEdit = (row) => {
  dialogMode.value = 'edit'
  Object.assign(form, {
    id: row.id,
    campusId: row.campusId,
    realName: row.realName,
    personType: row.personType,
    department: row.department || '',
    status: row.status,
    enrolledYear: row.enrolledYear,
  })
  dialogVisible.value = true
}

const handleSubmit = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  submitting.value = true
  try {
    if (dialogMode.value === 'add') {
      await createAdminCampusPerson({
        campusId: form.campusId,
        realName: form.realName,
        personType: form.personType,
        department: form.department || undefined,
        status: form.status,
        enrolledYear: form.enrolledYear || undefined,
      })
      ElMessage.success('新增成功')
    } else {
      await updateAdminCampusPerson(form.id, {
        realName: form.realName,
        personType: form.personType,
        department: form.department || undefined,
        status: form.status,
        enrolledYear: form.enrolledYear || undefined,
      })
      ElMessage.success('修改成功')
    }
    dialogVisible.value = false
    fetchList()
  } catch (e) {
    ElMessage.error(e?.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

const handleDelete = async (row) => {
  await ElMessageBox.confirm(
    `确定要删除「${row.campusId} · ${row.realName}」吗？${
      row.linkedUserId ? '该条目已被用户绑定,删除后用户需重新认证。' : ''
    }`,
    '删除确认',
    { type: 'error' }
  )
  await deleteAdminCampusPerson(row.id)
  ElMessage.success('删除成功')
  fetchList()
}

const statusTagType = (s) =>
  ({ 1: 'success', 2: 'info', 3: 'danger' }[s] || 'info')
</script>

<template>
  <div class="campus-person-tab">
    <PageFilterBar
      v-model="filters"
      :fields="fields"
      @search="handleSearch"
      @reset="handleReset"
    >
      <template #extra>
        <el-button type="success" :icon="Plus" @click="openAdd">新增白名单</el-button>
        <el-button :icon="Refresh" @click="fetchList">刷新</el-button>
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
        <el-table-column prop="campusId" label="学号/工号" min-width="120" align="center" />
        <el-table-column prop="realName" label="真实姓名" min-width="100" align="center" />
        <el-table-column label="类型" min-width="80" align="center">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">
              {{ personTypeText(row.personType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="department" label="院系/部门" min-width="160" align="center" />
        <el-table-column label="入学年份" min-width="100" align="center">
          <template #default="{ row }">
            {{ row.enrolledYear || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="状态" min-width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small" effect="plain">
              {{ row.statusText }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="已绑定用户" min-width="140" align="center">
          <template #default="{ row }">
            <span v-if="row.linkedNickname || row.linkedUsername" class="linked-user">
              <el-icon class="link-icon"><UserFilled /></el-icon>
              {{ row.linkedNickname || row.linkedUsername }}
            </span>
            <span v-else class="muted">未绑定</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="160" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEdit(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>

        <template #empty>
          <el-empty description="暂无白名单数据" />
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

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'add' ? '新增白名单' : '编辑白名单'"
      width="520px"
      align-center
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
      >
        <el-form-item label="学号/工号" prop="campusId">
          <el-input
            v-model="form.campusId"
            placeholder="4-20 位"
            maxlength="20"
            :disabled="dialogMode === 'edit'"
          />
          <div v-if="dialogMode === 'edit'" class="form-tip">不允许修改,改 = 换人,请删除+新增</div>
        </el-form-item>
        <el-form-item label="真实姓名" prop="realName">
          <el-input v-model="form.realName" placeholder="请输入真实姓名" maxlength="30" />
        </el-form-item>
        <el-form-item label="人员类型" prop="personType">
          <el-radio-group v-model="form.personType">
            <el-radio :value="1">学生</el-radio>
            <el-radio :value="2">教师</el-radio>
            <el-radio :value="3">其他</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="院系/部门">
          <el-input v-model="form.department" placeholder="选填" maxlength="100" />
        </el-form-item>
        <el-form-item v-if="form.personType === 1" label="入学年份">
          <el-input-number
            v-model="form.enrolledYear"
            :min="1950"
            :max="2100"
            placeholder="选填"
            controls-position="right"
            style="width: 140px;"
          />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">在读/在职</el-radio>
            <el-radio :value="2">已毕业/已离职</el-radio>
            <el-radio :value="3">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ dialogMode === 'add' ? '新增' : '保存' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.campus-person-tab { min-height: 200px; }
.data-card {
  background: #fff;
  border-radius: 12px;
  padding: 18px 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}
.linked-user {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #555;
}
.link-icon { color: #ff6b35; font-size: 13px; }
.muted { color: #bbb; font-size: 12px; }

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

.form-tip {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
  line-height: 1.4;
}
</style>
