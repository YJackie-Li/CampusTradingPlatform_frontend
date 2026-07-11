<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Object, required: true },
  fields: {
    type: Array,
    required: true,
    // [{ key, label, type:'input'|'select', placeholder, width, options? }]
  },
})

const emit = defineEmits(['update:modelValue', 'search', 'reset'])

const form = ref({ ...props.modelValue })

watch(
  () => props.modelValue,
  (v) => (form.value = { ...v })
)

const update = () => emit('update:modelValue', { ...form.value })

const handleSearch = () => {
  emit('update:modelValue', { ...form.value })
  emit('search', { ...form.value })
}

const handleReset = () => {
  const reset = {}
  props.fields.forEach((f) => (reset[f.key] = f.type === 'select' ? '' : ''))
  form.value = reset
  emit('update:modelValue', { ...reset })
  emit('reset')
}
</script>

<template>
  <div class="page-filter-bar">
    <el-form :model="form" inline label-position="right" label-width="auto">
      <el-form-item
        v-for="f in fields"
        :key="f.key"
        :label="f.label"
      >
        <el-input
          v-if="f.type === 'input'"
          v-model="form[f.key]"
          :placeholder="f.placeholder || `请输入${f.label}`"
          clearable
          :style="{ width: f.width || '180px' }"
          @input="update"
        />
        <el-select
          v-else-if="f.type === 'select'"
          v-model="form[f.key]"
          :placeholder="f.placeholder || `请选择${f.label}`"
          clearable
          :style="{ width: f.width || '120px' }"
          @change="update"
        >
          <el-option
            v-for="opt in f.options"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item>
        <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
        <el-button :icon="RefreshLeft" @click="handleReset">重置</el-button>
        <slot name="extra" />
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.page-filter-bar {
  background: #fff;
  border-radius: 12px;
  padding: 18px 20px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.page-filter-bar :deep(.el-form-item) {
  margin-bottom: 0;
  margin-right: 18px;
}

.page-filter-bar :deep(.el-form-item__label) {
  color: #666;
  font-size: 13px;
}

.page-filter-bar :deep(.el-input__wrapper) {
  background: #f5f7fa;
  border-radius: 6px;
  box-shadow: none !important;
  height: 32px;
}

.page-filter-bar :deep(.el-input__wrapper.is-focus) {
  background: #fff;
  box-shadow: 0 0 0 1px #ff6b35 inset !important;
}

.page-filter-bar :deep(.el-select__wrapper) {
  background: #f5f7fa;
  box-shadow: none !important;
  min-height: 32px;
  border-radius: 6px;
}

.page-filter-bar :deep(.el-button--primary) {
  background: linear-gradient(135deg, #ff8c5a 0%, #ff6b35 100%) !important;
  border: none !important;
  box-shadow: 0 2px 6px rgba(255, 107, 53, 0.3) !important;
}
</style>
