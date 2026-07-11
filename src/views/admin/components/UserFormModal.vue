<script setup>
import { ref, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  initial: { type: Object, default: () => ({}) },
  // 'add' | 'edit'
  mode: { type: String, default: 'add' },
})

const emit = defineEmits(['update:modelValue', 'submit'])

const formRef = ref()
const form = reactive({
  id: null,
  username: '',
  nickname: '',
  phone: '',
  gender: 1,
  status: 1,
  avatar: '',
})

const rules = {
  username: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    { min: 3, max: 20, message: '长度在 3-20 个字符', trigger: 'blur' },
  ],
  nickname: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 20, message: '长度在 2-20 个字符', trigger: 'blur' },
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' },
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
        username: props.initial.username || '',
        nickname: props.initial.nickname || '',
        phone: props.initial.phone || '',
        gender: props.initial.gender ?? 1,
        status: props.initial.status ?? 1,
        avatar: props.initial.avatar || '',
      })
    }
  }
)

const handleClose = () => {
  emit('update:modelValue', false)
  formRef.value?.resetFields()
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate((valid) => {
    if (!valid) return
    emit('submit', { ...form })
  })
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    :title="mode === 'add' ? '新增用户' : '编辑用户'"
    width="480px"
    :close-on-click-modal="false"
    align-center
    @close="handleClose"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="80px"
      label-position="right"
    >
      <el-form-item label="账号" prop="username">
        <el-input
          v-model="form.username"
          :disabled="mode === 'edit'"
          placeholder="请输入账号"
        />
      </el-form-item>
      <el-form-item label="用户名" prop="nickname">
        <el-input v-model="form.nickname" placeholder="请输入用户名" />
      </el-form-item>
      <el-form-item label="手机号" prop="phone">
        <el-input v-model="form.phone" placeholder="请输入手机号" maxlength="11" />
      </el-form-item>
      <el-form-item label="性别" prop="gender">
        <el-radio-group v-model="form.gender">
          <el-radio :value="1">男</el-radio>
          <el-radio :value="2">女</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-radio-group v-model="form.status">
          <el-radio :value="1">正常</el-radio>
          <el-radio :value="0">封号</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleSubmit">确定</el-button>
    </template>
  </el-dialog>
</template>
