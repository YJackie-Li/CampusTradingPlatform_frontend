<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Search, Upload, Download } from '@element-plus/icons-vue'
import * as XLSX from 'xlsx'
import {
  getAdminCampusPersonPage,
  createAdminCampusPerson,
  updateAdminCampusPerson,
  deleteAdminCampusPerson,
  importCampusPerson,
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
      // 编辑时也带回 campusId:
      // 1) 后端 DTO 上 @NotBlank 拦截;前端 disabled 的 input 已经持有 row.campusId 原值
      // 2) service.adminUpdate 在 blank 时会跳过变更检查,但因为 DTO 注解,这里必须非空
      // 3) service 还会判 dto.campusId != p.campusId 则拒绝;由于原样回传,恒等通过
      await updateAdminCampusPerson(form.id, {
        campusId: form.campusId,
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

// ===========================================================
//  批量导入
// ===========================================================

// 用于结果对话框 & 预览表格的标签映射
const PERSON_TYPE_LABEL = { 1: '学生', 2: '教师', 3: '其他' }
const STATUS_LABEL = { 1: '在读/在职', 2: '已毕业/已离职', 3: '禁用' }
// Excel 单元格允许填中文别名
const PERSON_TYPE_ALIAS = { '学生': 1, '教师': 2, '其他': 3 }
const STATUS_ALIAS = { '在读/在职': 1, '已毕业/已离职': 2, '禁用': 3 }

// 单元格值 → 数字(或保持 null)。优先数字,中文走别名表
function parsePersonType(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  if (!Number.isNaN(n) && [1, 2, 3].includes(n)) return n
  return PERSON_TYPE_ALIAS[String(v).trim()] ?? null
}
function parseStatus(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  if (!Number.isNaN(n) && [1, 2, 3].includes(n)) return n
  return STATUS_ALIAS[String(v).trim()] ?? null
}
function parseInt2(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

// 前端预校验一行 —— 错误不进入提交。规则与后端 service.validateUpsert 等价
function validateRow(r) {
  const e = []
  if (!r.campusId) e.push('学号/工号不能为空')
  else if (String(r.campusId).length < 4 || String(r.campusId).length > 20) e.push('长度需 4-20')
  if (!r.realName) e.push('真实姓名不能为空')
  else if (String(r.realName).length < 2 || String(r.realName).length > 30) e.push('长度需 2-30')
  if (r.personType == null) e.push('人员类型必填(1/2/3)')
  if (r.status == null) e.push('状态必填(1/2/3)')
  if (r.department && String(r.department).length > 100) e.push('部门≤100字')
  if (r.enrolledYear != null && (r.enrolledYear < 1950 || r.enrolledYear > 2100)) e.push('年份 1950-2100')
  return e
}

// 导入对话框状态。step 决定渲染哪一个子区域
const importDialog = reactive({
  visible: false,
  step: 'upload',       // 'upload' | 'preview' | 'submitting' | 'done'
  fileName: '',
  rawRows: [],         // [{row, campusId, realName, personType, department, enrolledYear, status, errors:[]}]
  summary: { total: 0, valid: 0, invalid: 0 },
  result: null,        // 后端返回的 CampusPersonImportResultVO
})
const importing = ref(false)

const openImport = () => {
  importDialog.visible = true
  importDialog.step = 'upload'
  importDialog.fileName = ''
  importDialog.rawRows = []
  importDialog.summary = { total: 0, valid: 0, invalid: 0 }
  importDialog.result = null
}

const closeImport = () => {
  importDialog.visible = false
  importDialog.step = 'upload'
}

// 文件解析:拿到 arrayBuffer → SheetJS 解析 → 行数组 → 按表头列名定位
// 不再走 /api/common/upload —— 解析完全在前端完成,文件不入库
async function handleImportFile(file) {
  importDialog.fileName = file.name
  importDialog.step = 'preview'
  try {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    if (!wb.SheetNames.length) {
      ElMessage.error('表格为空')
      importDialog.step = 'upload'
      return
    }
    const ws = wb.Sheets[wb.SheetNames[0]]
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    if (!aoa.length || aoa.length < 2) {
      ElMessage.error('表格为空或只有表头')
      importDialog.step = 'upload'
      return
    }

    // 表头匹配:优先完全相等,否则 includes
    const headers = aoa[0].map((h) => String(h ?? ''))
    const findCol = (...kws) => {
      for (const kw of kws) {
        for (let i = 0; i < headers.length; i++) {
          if (headers[i] === kw) return i
        }
      }
      for (const kw of kws) {
        for (let i = 0; i < headers.length; i++) {
          if (headers[i].includes(kw)) return i
        }
      }
      return -1
    }
    const colIdx = {
      campusId:     findCol('学号/工号', '学号', '工号'),
      realName:     findCol('真实姓名', '姓名'),
      personType:   findCol('人员类型', '类型'),
      department:   findCol('院系/部门', '院系', '部门'),
      enrolledYear: findCol('入学年份', '入学'),
      status:       findCol('状态'),
    }
    const missing = Object.entries(colIdx).filter(([, v]) => v === -1).map(([k]) => k)
    if (missing.length) {
      ElMessage.error(`表格缺少列: ${missing.join('、')} (需要中文表头)`)
      importDialog.step = 'upload'
      return
    }

    // 数据行:aao[1] 开始。完全空行跳过
    const rows = []
    for (let i = 1; i < aoa.length; i++) {
      const arr = aoa[i] || []
      if (arr.every((c) => c == null || c === '')) continue
      const r = {
        row: i + 1,    // Excel 行号:首行表头,第 2 行起为 i+1
        campusId:     String(arr[colIdx.campusId] ?? '').trim(),
        realName:     String(arr[colIdx.realName] ?? '').trim(),
        personType:   parsePersonType(arr[colIdx.personType]),
        department:   arr[colIdx.department] ? String(arr[colIdx.department]).trim() : '',
        enrolledYear: parseInt2(arr[colIdx.enrolledYear]),
        status:       parseStatus(arr[colIdx.status]),
        errors: [],
      }
      r.errors = validateRow(r)
      rows.push(r)
    }
    importDialog.rawRows = rows
    importDialog.summary = {
      total:   rows.length,
      valid:   rows.filter((r) => r.errors.length === 0).length,
      invalid: rows.filter((r) => r.errors.length > 0).length,
    }
  } catch (err) {
    ElMessage.error('文件解析失败: ' + (err?.message || err))
    importDialog.step = 'upload'
  }
}

// 模板下载:浏览器内用 SheetJS 现场生成。2 条样例覆盖学生/教师两种 personType
function downloadTemplate() {
  const aoa = [
    ['学号/工号', '真实姓名', '人员类型', '院系/部门', '入学年份', '状态'],   // 表头
    ['20210001', '张三',  '1', '计算机学院', 2021, '1'],                   // 学生样例
    ['T20180001', '王老师', '2', '计算机学院', '',   '1'],                  // 教师样例(无入学年份)
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 10 }, { wch: 10 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '白名单模板')
  XLSX.writeFile(wb, '白名单导入模板.xlsx')
}

// 提交。只传通过预校验的行;campus_id 重复留给后端判
async function submitImport() {
  const items = importDialog.rawRows
    .filter((r) => r.errors.length === 0)
    .map((r) => ({
      campusId:     r.campusId,
      realName:     r.realName,
      personType:   r.personType,
      department:   r.department || undefined,
      enrolledYear: r.enrolledYear ?? undefined,
      status:       r.status,
    }))
  if (items.length === 0) {
    ElMessage.warning('没有可导入的有效行')
    return
  }
  importing.value = true
  importDialog.step = 'submitting'
  try {
    const res = await importCampusPerson(items)
    importDialog.result = res
    importDialog.step = 'done'
    fetchList()   // 刷新后台表格
  } catch (e) {
    // http.js 拦截器已 toast;留在 preview 让管理员修改后重试
    importDialog.step = 'preview'
  } finally {
    importing.value = false
  }
}
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
        <el-button type="warning" :icon="Upload" @click="openImport">批量导入</el-button>
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
        <!-- 入学年份:学生/教师/其他均可填(后端 service 不按 personType 区分) -->
        <el-form-item label="入学年份">
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

    <!-- ============================================================
         批量导入对话框
         step: 'upload' → 'preview' → 'submitting' → 'done'
         ============================================================ -->
    <el-dialog
      v-model="importDialog.visible"
      title="批量导入白名单"
      width="880px"
      align-center
      :close-on-click-modal="false"
      @close="closeImport"
    >
      <!-- 步骤 1:上传文件 + 下载模板 -->
      <div v-if="importDialog.step === 'upload'" class="import-step">
        <el-alert
          type="info" :closable="false" style="margin-bottom: 14px;"
        >
          支持 .xlsx / .xls / .csv 文件。请先下载模板,按表头填写后再上传。
          <strong>同一学号/工号已存在会自动跳过</strong>(不覆盖),可在结果对话框中确认。
        </el-alert>
        <el-upload
          :auto-upload="false"
          :show-file-list="false"
          accept=".xlsx,.xls,.csv"
          drag
          class="import-drop"
          @change="(f) => f?.raw && handleImportFile(f.raw)"
        >
          <el-icon class="upload-icon" :size="42"><Upload /></el-icon>
          <div class="el-upload__text">将文件拖到此处,或<em>点击选择</em></div>
          <template #tip>
            <div class="el-upload__tip">只支持 Excel 与 CSV 文件,大小 ≤ 5MB</div>
          </template>
        </el-upload>
        <div class="import-actions">
          <el-button :icon="Download" @click="downloadTemplate">下载导入模板</el-button>
        </div>
      </div>

      <!-- 步骤 2:预览表格 (含每行校验结果) -->
      <div v-else-if="importDialog.step === 'preview'" class="import-step">
        <div class="preview-summary">
          <span class="summary-name">文件: <strong>{{ importDialog.fileName }}</strong></span>
          <span>共 {{ importDialog.summary.total }} 行</span>
          <el-tag type="success">{{ importDialog.summary.valid }} 行有效</el-tag>
          <el-tag type="danger">{{ importDialog.summary.invalid }} 行无效</el-tag>
        </div>
        <el-table :data="importDialog.rawRows" max-height="380" stripe size="small" empty-text="表格无数据">
          <el-table-column label="行号" prop="row" width="64" align="center" />
          <el-table-column label="学号/工号" prop="campusId" min-width="120" />
          <el-table-column label="真实姓名" prop="realName" min-width="100" />
          <el-table-column label="人员类型" min-width="90" align="center">
            <template #default="{ row }">
              <span>{{ row.personType ? PERSON_TYPE_LABEL[row.personType] : '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="院系/部门" prop="department" min-width="160" show-overflow-tooltip />
          <el-table-column label="入学年份" prop="enrolledYear" width="100" align="center" />
          <el-table-column label="状态" min-width="100" align="center">
            <template #default="{ row }">
              <span>{{ row.status ? STATUS_LABEL[row.status] : '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="校验" min-width="220" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.errors.length === 0" type="success" size="small">通过</el-tag>
              <el-tooltip v-else :content="row.errors.join('；')" placement="top">
                <el-tag type="danger" size="small">
                  {{ row.errors[0] }}<span v-if="row.errors.length > 1"> 等{{ row.errors.length }}项</span>
                </el-tag>
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 步骤 3:提交中 -->
      <div v-else-if="importDialog.step === 'submitting'" v-loading="true" class="import-step" style="height: 220px;"></div>

      <!-- 步骤 4:导入结果 -->
      <div v-else-if="importDialog.step === 'done' && importDialog.result" class="import-step">
        <el-result
          :icon="importDialog.result.success > 0 ? 'success' : 'warning'"
          :title="`已处理 ${importDialog.result.total} 行`"
        >
          <template #sub-title>
            <div class="result-stats">
              <el-tag type="success" size="large">成功 {{ importDialog.result.success }}</el-tag>
              <el-tag type="info"    size="large">跳过 {{ importDialog.result.skipped }}</el-tag>
              <el-tag type="danger"  size="large">失败 {{ importDialog.result.failed }}</el-tag>
            </div>
          </template>
        </el-result>
        <div v-if="importDialog.result.errors.length > 0">
          <div class="errors-title">失败/跳过明细({{ importDialog.result.errors.length }} 行)</div>
          <el-table :data="importDialog.result.errors" max-height="280" stripe size="small">
            <el-table-column label="Excel 行" prop="row" width="80" align="center" />
            <el-table-column label="学号/工号" prop="campusId" min-width="120" />
            <el-table-column label="真实姓名" prop="realName" min-width="100" />
            <el-table-column label="原因" prop="message" min-width="240" />
          </el-table>
        </div>
      </div>

      <template #footer>
        <template v-if="importDialog.step === 'upload'">
          <el-button @click="closeImport">取消</el-button>
        </template>
        <template v-else-if="importDialog.step === 'preview'">
          <el-button @click="importDialog.step = 'upload'">重新选择文件</el-button>
          <el-button @click="closeImport">取消</el-button>
          <el-button
            type="primary" :loading="importing"
            :disabled="importDialog.summary.valid === 0"
            @click="submitImport"
          >开始导入({{ importDialog.summary.valid }} 行有效)</el-button>
        </template>
        <template v-else-if="importDialog.step === 'submitting'">
          <el-button disabled>处理中…</el-button>
        </template>
        <template v-else>
          <el-button @click="importDialog.step = 'upload'">再导一批</el-button>
          <el-button type="primary" @click="closeImport">关闭</el-button>
        </template>
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

/* ===== 批量导入 ===== */
.import-step { font-size: 14px; }
.import-drop {
  width: 100%;
}
.import-drop :deep(.el-upload) {
  width: 100%;
}
.import-drop :deep(.el-upload-dragger) {
  width: 100%;
  height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.import-drop :deep(.upload-icon) {
  color: #c0c4cc;
  margin-bottom: 8px;
}
.import-drop :deep(.el-upload__text) {
  font-size: 14px;
  color: #555;
}
.import-drop :deep(.el-upload__text em) {
  color: #ff6b35;
  font-style: normal;
  font-weight: 600;
}
.import-drop :deep(.el-upload__tip) {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.import-actions {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}

.preview-summary {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  background: #fafbfc;
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #555;
}
.preview-summary .summary-name {
  color: #1f1f1f;
}

.result-stats {
  display: flex;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.errors-title {
  font-size: 13px;
  font-weight: 600;
  color: #1f1f1f;
  margin: 14px 0 10px;
}
</style>
