<script setup>
/**
 * 评价/回复举报弹窗（共享组件）。
 *
 * 用法：
 * <ReviewReportDialog
 *   v-model="visible"
 *   :review-id="r.id"
 *   :target-type="REPORT_TARGET.REVIEW_CONTENT"
 *   :target-label="'评价内容'"
 *   @success="onReportSuccess"
 * />
 *
 * 提交逻辑：
 *   复用 reviewReports.submitReviewReport({ reviewId, targetType, reason, description })
 *   - reason 必填，≤100 字（与后端 @Size(max=100) 对齐）
 *   - description 可选，≤500 字
 *   - targetType: 1=评价内容 2=回复内容
 */
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Warning } from '@element-plus/icons-vue'
import { submitReviewReport } from '@/api/reviewReports'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  reviewId: { type: Number, default: null },
  targetType: { type: Number, required: true }, // 1=评价 2=回复
  targetLabel: { type: String, default: '' }, // 顶部提示文案，如 "评价内容"
})

const emit = defineEmits(['update:modelValue', 'success'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const formRef = ref(null)
const submitting = ref(false)
const form = reactive({
  reason: '',
  description: '',
})

// 预设原因（管理员侧的 auditReason 一般也是这套；保持一致便于审计）
const presetReasons = [
  '辱骂、人身攻击',
  '虚假信息 / 误导',
  '色情低俗',
  '广告 / 引战',
  '抄袭 / 侵权',
  '其他违规',
]

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      // 每次打开重置表单
      form.reason = ''
      form.description = ''
      submitting.value = false
    }
  }
)

const rules = {
  reason: [
    { required: true, message: '请填写举报原因', trigger: 'blur' },
    { max: 100, message: '举报原因 ≤ 100 字', trigger: 'blur' },
  ],
  description: [
    { max: 500, message: '补充说明 ≤ 500 字', trigger: 'blur' },
  ],
}

const handlePreset = (text) => {
  form.reason = text
}

const submit = async () => {
  if (!props.reviewId) {
    ElMessage.error('举报参数错误：缺少评价 id')
    return
  }
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitting.value = true
    try {
      await submitReviewReport({
        reviewId: props.reviewId,
        targetType: props.targetType,
        reason: form.reason.trim(),
        description: form.description ? form.description.trim() : undefined,
      })
      ElMessage.success('举报已提交，管理员会尽快处理')
      emit('success', { reviewId: props.reviewId, targetType: props.targetType })
      visible.value = false
    } catch (e) {
      ElMessage.error(e?.message || '举报提交失败')
    } finally {
      submitting.value = false
    }
  })
}

const cancel = () => {
  visible.value = false
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="举报内容"
    width="480px"
    :close-on-click-modal="false"
    align-center
  >
    <div class="report-hint">
      <el-icon class="hint-icon"><Warning /></el-icon>
      <span>您将举报该商品的「{{ targetLabel }}」</span>
    </div>

    <el-form ref="formRef" :model="form" :rules="rules" label-width="80px" label-position="right">
      <el-form-item label="举报原因" prop="reason">
        <el-input
          v-model="form.reason"
          type="textarea"
          :rows="2"
          placeholder="请简要说明举报原因（必填，≤100 字）"
          maxlength="100"
          show-word-limit
        />
      </el-form-item>

      <el-form-item label="快速选择">
        <div class="preset-row">
          <el-tag
            v-for="r in presetReasons"
            :key="r"
            class="preset-tag"
            :type="form.reason === r ? 'danger' : 'info'"
            effect="plain"
            @click="handlePreset(r)"
          >
            {{ r }}
          </el-tag>
        </div>
      </el-form-item>

      <el-form-item label="补充说明" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="选填：补充更具体的上下文，便于管理员判断（≤500 字）"
          maxlength="500"
          show-word-limit
        />
      </el-form-item>
    </el-form>

    <div class="report-tips">
      举报仅由该评价的买家 / 卖家发起；同一内容对同一目标只能举报一次。
    </div>

    <template #footer>
      <el-button @click="cancel">取消</el-button>
      <el-button type="danger" :loading="submitting" @click="submit">提交举报</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.report-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  margin: 0 0 16px;
  background: #fff7f2;
  border: 1px dashed #ffcdb2;
  border-radius: 6px;
  font-size: 13px;
  color: #874c2a;
}
.hint-icon { color: #ff6b35; font-size: 16px; }

.preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.preset-tag {
  cursor: pointer;
  user-select: none;
  transition: all 0.15s;
}
.preset-tag:hover { transform: translateY(-1px); }

.report-tips {
  margin-top: 8px;
  padding: 8px 12px;
  background: #fafbfc;
  border-radius: 4px;
  font-size: 12px;
  color: #999;
  line-height: 1.6;
}
</style>