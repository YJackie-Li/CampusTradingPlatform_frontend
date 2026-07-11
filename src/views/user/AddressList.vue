<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus,
  Location,
  Edit,
  Delete,
  Phone,
  User,
  House,
  Search,
} from '@element-plus/icons-vue'
import { regionData, CodeToText } from 'element-china-area-data'
import {
  getAddressList,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from '@/api/addresses'

const loading = ref(false)
const list = ref([])
const keyword = ref('')

// ========== 弹窗 ==========
const dialogVisible = ref(false)
const dialogMode = ref('add') // 'add' | 'edit'
const submitting = ref(false)

const emptyForm = () => ({
  id: null,
  receiver: '',
  phone: '',
  region: [], // [省, 市, 区]
  detail: '',
  isDefault: false,
})
const form = reactive(emptyForm())

const formRules = {
  receiver: [{ required: true, message: '请输入收件人', trigger: 'blur' }],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' },
  ],
  region: [{ required: true, message: '请选择省/市/区', trigger: 'change' }],
  detail: [{ required: true, message: '请输入详细地址', trigger: 'blur' }],
}
const formRef = ref()

// ========== 数据 ==========
const fetchList = async () => {
  loading.value = true
  try {
    // 后端搜索用的是 fullAddress = province+city+district+detail，里面前三个是地区编号
    // （如 110000），搜"北京"匹配不到，所以关键字过滤放前端做
    const res = await getAddressList({ keyword: '' })
    list.value = res || []
  } finally {
    loading.value = false
  }
}

// ========== 操作 ==========
const openAdd = () => {
  Object.assign(form, emptyForm())
  dialogMode.value = 'add'
  dialogVisible.value = true
}

const openEdit = (row) => {
  Object.assign(form, emptyForm())
  form.id = row.id
  form.receiver = row.receiver
  form.phone = row.phone
  form.region = [row.province, row.city, row.district]
  form.detail = row.detail
  form.isDefault = row.isDefault
  dialogMode.value = 'edit'
  dialogVisible.value = true
}

const submitForm = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  submitting.value = true
  const [province, city, district] = form.region
  // element-china-area-data 的 regionData 是 { value: 行政编码, label: 汉字 }，
  // 级联选择器拿到的 value 是编码（如 110000/110100/110102）。
  // 后端 AddressService.buildFull 直接拼接 province+city+district+detail，
  // 不做编码→汉字转换，所以这里提交前先用 CodeToText 把编码翻成汉字，
  // 否则数据库里存的就是 "110000110100110102..."，订单中心展示也会是这一串数字。
  const payload = {
    receiver: form.receiver,
    phone: form.phone,
    province: codeToLabel(province),
    city: codeToLabel(city),
    district: codeToLabel(district),
    detail: form.detail,
    isDefault: form.isDefault ? 1 : 0,
  }
  try {
    if (dialogMode.value === 'add') {
      await addAddress(payload)
      ElMessage.success('新增成功')
    } else {
      await updateAddress({ id: form.id, ...payload })
      ElMessage.success('修改成功')
    }
    dialogVisible.value = false
    await fetchList()
  } finally {
    submitting.value = false
  }
}

const handleSetDefault = async (row) => {
  if (row.isDefault) return
  await setDefaultAddress(row.id)
  ElMessage.success(`已将「${row.receiver}」设为默认地址`)
  await fetchList()
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确认删除「${row.receiver}」的收货地址？此操作不可撤销`,
      '删除地址',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  await deleteAddress(row.id)
  ElMessage.success('已删除')
  await fetchList()
}

const goBack = () => history.back()

// ========== 计算属性 ==========
const hasDefault = computed(() => list.value.some((a) => a.isDefault))

// 地区编号（cascader 的 value）转汉字，存到 DB 里的是编号，
// 展示的时候要查表转回省/市/区名字
const codeToLabel = (code) => (code ? CodeToText[code] || code : '')
const formatAddress = (item) => {
  const region = [item.province, item.city, item.district]
    .map(codeToLabel)
    .filter(Boolean)
    .join('')
  return region + (item.detail || '')
}

// 关键字过滤：收件人 / 手机号 / 格式化后的地区文字 + 详细地址 三路模糊匹配
const filteredList = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  if (!k) return list.value
  return list.value.filter((item) => {
    const fields = [
      item.receiver || '',
      item.phone || '',
      formatAddress(item),
    ]
    return fields.some((f) => String(f).toLowerCase().includes(k))
  })
})

onMounted(fetchList)
</script>

<template>
  <div class="address-page">
    <!-- 标题区 -->
    <header class="page-header">
      <h1 class="page-title">收货地址</h1>
      <button class="add-fab" title="新增地址" @click="openAdd">
        <el-icon><Plus /></el-icon>
      </button>
    </header>

    <!-- 卡片网格 -->
    <div class="address-grid" v-loading="loading">
      <article v-for="item in filteredList" :key="item.id" class="addr-card">
        <div class="card-top">
          <div class="who">
            <span class="name">{{ item.receiver }}</span>
            <span class="phone">{{ item.phone }}</span>
            <el-tag v-if="item.isDefault" type="warning" size="small" effect="plain" class="default-tag">
              默认
            </el-tag>
          </div>
        </div>
        <div class="addr-text">{{ formatAddress(item) }}</div>
        <div class="card-actions">
          <el-button
            v-if="!item.isDefault"
            type="primary"
            link
            class="action-btn"
            @click="handleSetDefault(item)"
          >
            设为默认
          </el-button>
          <span v-else class="default-text">默认地址</span>
          <span class="divider"></span>
          <el-button type="primary" link class="action-btn" @click="openEdit(item)">
            修改
          </el-button>
          <span class="divider"></span>
          <el-button type="danger" link class="action-btn" @click="handleDelete(item)">
            删除
          </el-button>
        </div>
      </article>

      <article v-if="!loading && !filteredList.length" class="addr-empty">
        <el-icon :size="36" color="#dcdfe6"><Location /></el-icon>
        <p>暂无收货地址，点击右下角
          <el-icon :size="14" class="inline-icon"><Plus /></el-icon>
          按钮添加
        </p>
      </article>
    </div>

    <!-- 搜索（按图示顶部右侧的搜索框，挂在标题行） -->
    <div class="search-row">
      <el-input
        v-model="keyword"
        placeholder="搜索收件人/手机号/地址…"
        clearable
        @input="fetchList"
        @clear="fetchList"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
    </div>

    <!-- 表单弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'add' ? '新增收货地址' : '修改收货地址'"
      width="520px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="84px">
        <el-form-item label="收件人" prop="receiver">
          <el-input v-model="form.receiver" placeholder="请输入收件人姓名" maxlength="20" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入11位手机号" maxlength="11" />
        </el-form-item>
        <el-form-item label="所在地区" prop="region">
          <!-- element-china-area-data 的 regionData 默认 value 是行政编码（110000/110100/110102），
               直接提交给后端会导致数据库和订单中心展示成 "110000110100110102..."。
               这里把 cascader 的 value 字段改为 label（汉字），
               form.region 全程都是汉字数组，提交后端也是汉字，无需额外转换。
               注：北京市同时是省/市 label，但这是 regionData 数据本身的特性，与字段无关。 -->
          <el-cascader
            v-model="form.region"
            :options="regionData"
            :props="{ value: 'label' }"
            class="full"
            placeholder="请选择 省 / 市 / 区"
          />
        </el-form-item>
        <el-form-item label="详细地址" prop="detail">
          <el-input
            v-model="form.detail"
            type="textarea"
            :rows="2"
            placeholder="街道、楼栋、门牌号等"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="设为默认">
          <el-switch v-model="form.isDefault" />
          <span class="form-tip">默认地址在结算时会优先选择</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">
          {{ dialogMode === 'add' ? '保存' : '更新' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.address-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 8px 0 64px;
  position: relative;
}

/* ===== 标题 ===== */
.page-header {
  display: flex;
  align-items: center;
  margin-bottom: 18px;
}
.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #1f1f1f;
}

/* ===== 搜索 ===== */
.search-row {
  position: absolute;
  right: 0;
  top: 8px;
  width: 220px;
}

/* ===== 卡片网格 ===== */
.address-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  margin-top: 56px;
}

.addr-card {
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 6px;
  padding: 18px 20px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: box-shadow 0.2s, transform 0.2s;
}
.addr-card:hover {
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
  transform: translateY(-2px);
}

.card-top .who {
  display: flex;
  align-items: center;
  gap: 12px;
}
.card-top .name {
  font-size: 16px;
  font-weight: 600;
  color: #1f1f1f;
}
.card-top .phone {
  font-size: 13px;
  color: #666;
}
.default-tag {
  border-color: #ff6b35 !important;
  color: #ff6b35 !important;
}

.addr-text {
  font-size: 14px;
  color: #555;
  line-height: 1.6;
  padding-left: 0;
  margin-top: 2px;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 0;
  margin-top: 6px;
  border-top: 1px dashed #f0f2f5;
  padding-top: 10px;
  justify-content: flex-start;
}
.action-btn {
  font-size: 13px !important;
  padding: 2px 8px !important;
}
.divider {
  width: 1px;
  height: 12px;
  background: #e4e7ed;
  margin: 0 2px;
}
.default-text {
  font-size: 13px;
  color: #ff6b35;
  padding: 2px 8px;
}

/* ===== 空状态 ===== */
.addr-empty {
  grid-column: 1 / -1;
  background: #fff;
  border: 1px dashed #e4e7ed;
  border-radius: 6px;
  padding: 60px 0;
  text-align: center;
  color: #999;
}
.addr-empty p {
  margin: 12px 0 0;
  font-size: 13px;
}
.addr-empty .inline-icon {
  vertical-align: -2px;
  margin: 0 1px;
}

/* ===== 新增 FAB ===== */
.add-fab {
  position: fixed;
  right: 38px;
  bottom: 96px;       /* 离底部备案区上方留点距离 */
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #1f1f1f;
  color: #fff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.18);
  transition: transform 0.2s, background 0.2s;
  z-index: 9;
}
.add-fab:hover {
  background: #ff6b35;
  transform: scale(1.05);
}
.add-fab .el-icon { font-size: 22px; }

/* ===== 表单 ===== */
.full { width: 100%; }
.form-tip {
  margin-left: 10px;
  color: #999;
  font-size: 12px;
}

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .search-row {
    position: static;
    width: 100%;
    margin-bottom: 12px;
  }
  .address-grid {
    margin-top: 12px;
  }
}
</style>
