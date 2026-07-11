<script setup>
import { ref, reactive, watch, computed } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  initial: { type: Object, default: () => ({}) },
  mode: { type: String, default: 'add' }, // 'add' | 'edit'
  // 父级候选（平铺）
  parentOptions: { type: Array, default: () => [] },
  // 排除 id（编辑时不能选自己 / 子级）
  excludeIds: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue', 'submit'])

const formRef = ref()
const form = reactive({
  id: null,
  parentId: 0,
  name: '',
  sort: 0,
  status: 1,
})

const rules = {
  name: [
    { required: true, message: '请输入分类名称', trigger: 'blur' },
    { min: 1, max: 20, message: '长度在 1-20 个字符', trigger: 'blur' },
  ],
  sort: [{ required: true, message: '请输入排序权重', trigger: 'blur' }],
}

const visible = ref(false)
watch(
  () => props.modelValue,
  (v) => {
    visible.value = v
    if (v) {
      Object.assign(form, {
        id: props.initial.id || null,
        parentId: props.initial.parentId ?? 0,
        name: props.initial.name || '',
        sort: props.initial.sort ?? 0,
        status: props.initial.status ?? 1,
      })
    }
  }
)

const handleClose = () => {
  emit('update:modelValue', false)
  formRef.value?.clearValidate()
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate((valid) => {
    if (!valid) return
    emit('submit', { ...form })
  })
}

// 排除自身和子级
const filteredOptions = computed(() => {
  return props.parentOptions.filter((o) => !props.excludeIds.includes(o.id))
})
</script>

<template>
  <el-dialog
    :model-value="visible"
    :title="mode === 'add' ? '新增顶级分类' : '编辑分类'"
    width="440px"
    :close-on-click-modal="false"
    align-center
    @close="handleClose"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="90px"
      label-position="right"
    >
      <el-form-item label="父级分类" v-if="mode === 'add'">
        <el-select v-model="form.parentId" placeholder="不选则为顶级分类" clearable style="width: 100%">
          <el-option label="顶级分类" :value="0" />
          <el-option
            v-for="opt in filteredOptions"
            :key="opt.id"
            :label="opt.name"
            :value="opt.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="分类名称" prop="name">
        <el-input v-model="form.name" placeholder="请输入分类名称" />
      </el-form-item>

      <el-form-item label="排序权重" prop="sort">
        <el-input-number v-model="form.sort" :min="0" :max="999" controls-position="right" />
      </el-form-item>

      <el-form-item label="状态" prop="status">
        <el-radio-group v-model="form.status">
          <el-radio :value="1">启用</el-radio>
          <el-radio :value="0">禁用</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleSubmit">确定</el-button>
    </template>
  </el-dialog>
</template>
