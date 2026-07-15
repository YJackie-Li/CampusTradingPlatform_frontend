<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { getCategoryTree } from '@/api/categories'
import { tradeMethodText, CONDITION_LEVEL_MAP } from '@/api/goods'
import { uploadFile } from '@/api/common'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  mode: { type: String, default: 'add' }, // 'add' | 'edit'
  initial: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:modelValue', 'submit'])

const formRef = ref()
const form = reactive({
  id: null,
  title: '',
  categoryId: null,
  categoryName: '',
  conditionLevel: 9,
  price: 0,
  originalPrice: 0,
  quantity: 1,
  tradeMethod: 'FACE_TO_FACE',
  description: '',
  cover: '',
  images: [],
  address: '',
  // 新增：运费(0=包邮)；仅当 tradeMethod 含 EXPRESS 时展示输入框
  freight: 0,
})

// 是否需要展示运费：仅 EXPRESS / BOTH 涉及快递
const showFreight = computed(
  () => form.tradeMethod === 'EXPRESS' || form.tradeMethod === 'BOTH'
)
// 交易方式变更时同步：自提不收运费,自动归零；恢复非纯自提则保留原值
watch(
  () => form.tradeMethod,
  (m) => {
    if (m !== 'EXPRESS' && m !== 'BOTH') form.freight = 0
  }
)

const rules = {
  title: [
    { required: true, message: '请输入商品标题', trigger: 'blur' },
    { min: 2, max: 50, message: '长度在 2-50 个字符', trigger: 'blur' },
  ],
  categoryId: [{ required: true, message: '请选择分类', trigger: 'change' }],
  conditionLevel: [{ required: true, message: '请选择新旧程度', trigger: 'change' }],
  price: [{ required: true, message: '请输入售价', trigger: 'blur' }],
  quantity: [
    { required: true, message: '请输入商品数量', trigger: 'blur' },
    {
      validator: (_r, v, cb) => (Number(v) >= 1 ? cb() : cb(new Error('数量至少为 1'))),
      trigger: 'blur',
    },
  ],
  description: [
    { required: true, message: '请填写商品描述', trigger: 'blur' },
    { max: 2000, message: '描述不能超过 2000 字', trigger: 'blur' },
  ],
}

const visible = ref(false)
watch(
  () => props.modelValue,
  (v) => {
    visible.value = v
    if (v) {
      Object.assign(form, {
        id: props.initial.id || null,
        title: props.initial.title || '',
        categoryId: props.initial.categoryId ?? null,
        categoryName: props.initial.categoryName || '',
        conditionLevel: props.initial.conditionLevel ?? 9,
        price: props.initial.price ?? 0,
        originalPrice: props.initial.originalPrice ?? 0,
        quantity: props.initial.quantity ?? props.initial.stock ?? 1,
        tradeMethod: props.initial.tradeMethod || 'FACE_TO_FACE',
        description: props.initial.description || '',
        cover: props.initial.cover || '',
        images: Array.isArray(props.initial.images)
          ? [...props.initial.images]
          : (props.initial.cover ? [props.initial.cover] : []),
        address: props.initial.address || '',
        freight: props.initial.freight ?? 0,
      })
    }
  }
)

// 分类树（仅叶子节点可选）
const categoryTree = ref([])
const leafOptions = ref([])

const flattenTree = (tree) => {
  const out = []
  const walk = (nodes, parents = []) => {
    for (const n of nodes) {
      const path = [...parents, n.name]
      const hasChildren = n.children && n.children.length
      if (hasChildren) {
        walk(n.children, path)
      } else {
        out.push({ id: n.id, name: n.name, fullName: path.join(' / ') })
      }
    }
  }
  walk(tree)
  return out
}

const fetchCategoryTree = async () => {
  const res = await getCategoryTree({ status: 1 })
  categoryTree.value = res
  leafOptions.value = flattenTree(res)
}
onMounted(fetchCategoryTree)

const handleCategoryChange = (id) => {
  const opt = leafOptions.value.find((o) => o.id === id)
  form.categoryName = opt ? opt.name : ''
}

// 上传图片：真正上传到 /api/common/upload（biz=goods），返回相对 URL 存入 form.images / form.cover
const uploading = ref(false)
const handleUploadChange = async (file) => {
  if (form.images.length >= 9) {
    ElMessage.warning('最多上传 9 张图片')
    return false
  }
  const raw = file.raw
  if (!raw) return false
  if (raw.size > 2 * 1024 * 1024) {
    ElMessage.error('单张图片不能超过 2MB')
    return false
  }
  uploading.value = true
  try {
    const res = await uploadFile(raw, 'goods')
    const url = res.url
    form.images.push(url)
    if (!form.cover) form.cover = url
    return true
  } catch (e) {
    ElMessage.error(e?.message || '图片上传失败')
    return false
  } finally {
    uploading.value = false
  }
}
const handleRemove = (idx) => {
  const removed = form.images.splice(idx, 1)[0]
  if (form.cover === removed) {
    form.cover = form.images[0] || ''
  }
}

const handleClose = () => {
  emit('update:modelValue', false)
  formRef.value?.clearValidate()
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate((valid) => {
    if (!valid) return
    // 自提不收运费,保底 0
    const finalFreight = showFreight.value ? Number(form.freight || 0) : 0
    emit('submit', {
      ...form,
      freight: finalFreight,
      cover: form.cover || form.images[0] || '',
    })
  })
}

const tradeMethods = [
  { value: 'FACE_TO_FACE', label: '自提' },
  { value: 'EXPRESS', label: '邮寄' },
  { value: 'BOTH', label: '两者皆可' },
]

// 成色下拉选项：与 @/api/goods 的 CONDITION_LEVEL_MAP 共用一份数据
// 渲染时降序展示(10 在上,1 在下)
const conditionOptions = Object.fromEntries(
  Object.entries(CONDITION_LEVEL_MAP).sort(([a], [b]) => Number(b) - Number(a))
)
</script>

<template>
  <el-dialog
    :model-value="visible"
    :title="mode === 'add' ? '发布商品' : '编辑商品'"
    width="640px"
    :close-on-click-modal="false"
    align-center
    @close="handleClose"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="100px"
      label-position="right"
    >
      <el-form-item label="商品标题" prop="title">
        <el-input v-model="form.title" placeholder="请输入商品标题" maxlength="50" show-word-limit />
      </el-form-item>

      <el-form-item label="分类" prop="categoryId">
        <el-select
          v-model="form.categoryId"
          placeholder="请选择分类"
          style="width: 100%"
          filterable
          @change="handleCategoryChange"
        >
          <el-option
            v-for="opt in leafOptions"
            :key="opt.id"
            :label="opt.fullName"
            :value="opt.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="新旧程度" prop="conditionLevel">
        <el-select v-model="form.conditionLevel" placeholder="请选择新旧程度" style="width: 100%">
          <!-- 选项与 CONDITION_LEVEL_MAP 单一来源对齐,详情页/列表/我的商品显示完全一致 -->
          <el-option
            v-for="(text, val) in conditionOptions"
            :key="val"
            :value="Number(val)"
            :label="text"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="售价" prop="price">
        <el-input-number
          v-model="form.price"
          :min="0"
          :max="999999"
          :precision="2"
          :step="10"
          controls-position="right"
        />
        <span class="form-tip">¥</span>
      </el-form-item>

      <el-form-item label="原价">
        <el-input-number
          v-model="form.originalPrice"
          :min="0"
          :max="999999"
          :precision="2"
          :step="10"
          controls-position="right"
        />
        <span class="form-tip">¥</span>
      </el-form-item>

      <el-form-item label="商品数量" prop="quantity">
        <el-input-number
          v-model="form.quantity"
          :min="1"
          :max="9999"
          :step="1"
          controls-position="right"
        />
        <span class="form-tip">件（剩余 0 时自动下架）</span>
      </el-form-item>

      <el-form-item label="交易方式">
        <el-radio-group v-model="form.tradeMethod">
          <el-radio v-for="m in tradeMethods" :key="m.value" :value="m.value">{{ m.label }}</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item v-if="showFreight" label="运费">
        <el-input-number
          v-model="form.freight"
          :min="0"
          :precision="2"
          :step="1"
          controls-position="right"
        />
        <span class="form-tip">¥（填 0 表示包邮，由卖家承担）</span>
      </el-form-item>

      <el-form-item label="交易地点">
        <el-input v-model="form.address" placeholder="如：北京邮电大学西土城校区" />
      </el-form-item>

      <el-form-item label="商品描述" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="5"
          :maxlength="2000"
          show-word-limit
          placeholder="请输入商品描述..."
        />
      </el-form-item>

      <el-form-item label="商品图片">
        <div class="image-uploader">
          <el-upload
            list-type="picture-card"
            :auto-upload="false"
            :show-file-list="false"
            accept="image/*"
            :on-change="handleUploadChange"
          >
            <el-icon class="upload-icon"><Plus /></el-icon>
          </el-upload>
          <div class="image-list">
            <div
              v-for="(img, idx) in form.images"
              :key="idx"
              class="image-item"
            >
              <img :src="img" :alt="`图片${idx + 1}`" />
              <div v-if="img === form.cover" class="cover-flag">封面</div>
              <div class="image-actions">
                <el-button
                  v-if="img !== form.cover"
                  size="small"
                  type="warning"
                  link
                  @click="form.cover = img"
                >设为封面</el-button>
                <el-button size="small" type="danger" link @click="handleRemove(idx)">删除</el-button>
              </div>
            </div>
          </div>
        </div>
        <div class="form-tip">最多上传 9 张，第一张默认为封面，支持 JPG/PNG，单张不超过 2M</div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleSubmit">{{ mode === 'add' ? '确定发布' : '保存修改' }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.form-tip {
  margin-left: 12px;
  font-size: 12px;
  color: #999;
}

.image-uploader {
  width: 100%;
}

.image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
}

.image-item {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #eef0f3;
  background: #fafbfc;
}

.image-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-flag {
  position: absolute;
  top: 4px;
  left: 4px;
  background: linear-gradient(135deg, #ff8c5a, #ff6b35);
  color: #fff;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
}

.image-actions {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  justify-content: center;
  gap: 4px;
  padding: 2px 0;
  opacity: 0;
  transition: opacity 0.2s;
}

.image-item:hover .image-actions {
  opacity: 1;
}

.image-actions :deep(.el-button) {
  color: #fff;
  font-size: 11px;
  padding: 0 4px;
}

.upload-icon {
  font-size: 24px;
  color: #999;
}
</style>