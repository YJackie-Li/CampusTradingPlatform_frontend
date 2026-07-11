<script setup>
import { reactive, ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import {
  quickCheckVerify,
  submitVerify,
  getVerifyStatus,
  verifyStatusText,
  verifyStatusTagType,
  personTypeText,
  VERIFY_STATUS,
} from '@/api/verify'
import {
  Postcard,
  CircleCheckFilled,
  CircleCloseFilled,
  WarningFilled,
  Loading,
} from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()

const form = reactive({
  campusId: '',
  realName: '',
})
const checkResult = ref(null)
const checkLoading = ref(false)
const submitting = ref(false)
const status = ref(null)  // VerifyStatusVO

const isVerified = computed(() => status.value?.verifyStatus === 1)

const rules = {
  campusId: [
    { required: true, message: '请输入学号/工号', trigger: 'blur' },
    { min: 4, max: 20, message: '长度 4-20', trigger: 'blur' },
  ],
  realName: [
    { required: true, message: '请输入真实姓名', trigger: 'blur' },
    { min: 2, max: 30, message: '长度 2-30', trigger: 'blur' },
  ],
}

const formRef = ref()

const fetchStatus = async () => {
  try {
    status.value = await getVerifyStatus()
    // 已通过则把信息同步到表单(展示用)
    if (isVerified.value && status.value.campusId) {
      form.campusId = status.value.campusId
      form.realName = status.value.realName
    }
  } catch (e) {
    ElMessage.error(e?.message || '获取认证状态失败')
  }
}

const onCheck = async () => {
  if (!form.campusId || !form.realName) {
    checkResult.value = null
    return
  }
  if (isVerified.value) {
    // 已通过,跳过实时校验
    return
  }
  checkLoading.value = true
  try {
    checkResult.value = await quickCheckVerify({
      campusId: form.campusId,
      realName: form.realName,
    })
  } catch (e) {
    checkResult.value = { match: false, message: e?.message || '校验失败' }
  } finally {
    checkLoading.value = false
  }
}

watch([() => form.campusId, () => form.realName], () => {
  if (!isVerified.value) checkResult.value = null
})

const onSubmit = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  // 先校验一次
  if (!checkResult.value || !checkResult.value.match) {
    await onCheck()
    if (!checkResult.value?.match) {
      ElMessage.warning(checkResult.value?.message || '请先确认学号/姓名匹配白名单')
      return
    }
  }
  submitting.value = true
  try {
    const res = await submitVerify({
      campusId: form.campusId,
      realName: form.realName,
    })
    status.value = res
    ElMessage.success('校园身份认证已通过')
    // 刷新 Pinia store 里的 userInfo
    try { await userStore.fetchProfile() } catch { /* ignore */ }
  } catch (e) {
    ElMessage.error(e?.message || '认证失败')
  } finally {
    submitting.value = false
  }
}

onMounted(fetchStatus)
</script>

<template>
  <div class="campus-verify-page">
    <div class="page-header">
      <h2 class="title">校园身份认证</h2>
      <p class="subtitle">通过认证后即可发布商品、下单、评价、聊天等操作</p>
    </div>

    <!-- 状态卡 -->
    <div v-if="status" class="status-card" :class="isVerified ? 'ok' : 'pending'">
      <el-icon class="status-icon">
        <CircleCheckFilled v-if="isVerified" />
        <WarningFilled v-else />
      </el-icon>
      <div class="status-body">
        <div class="status-title">
          <el-tag :type="verifyStatusTagType(status.verifyStatus)" effect="plain" size="small">
            {{ verifyStatusText(status.verifyStatus) }}
          </el-tag>
          <span v-if="isVerified" class="status-extra">
            {{ personTypeText(status.personType) }}
            <span v-if="status.department"> · {{ status.department }}</span>
          </span>
        </div>
        <div v-if="isVerified" class="status-meta">
          已绑定账号: {{ form.campusId }} · {{ form.realName }}
          <span v-if="status.verifyTime"> · 认证时间:{{ status.verifyTime?.slice(0, 16) }}</span>
        </div>
        <div v-else-if="status.verifyStatus === 2" class="status-meta err">
          认证被驳回,请联系管理员或重新提交
        </div>
        <div v-else class="status-meta">
          请填写学号/工号和真实姓名以完成认证
        </div>
      </div>
    </div>

    <!-- 表单卡 -->
    <div class="form-card">
      <h3 class="form-title">提交认证</h3>
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
        class="verify-form"
      >
        <el-form-item label="学号/工号" prop="campusId">
          <el-input
            v-model="form.campusId"
            placeholder="学生填学号,教职工填工号"
            maxlength="20"
            :disabled="isVerified"
            @blur="onCheck"
          />
        </el-form-item>
        <el-form-item label="真实姓名" prop="realName">
          <el-input
            v-model="form.realName"
            placeholder="请使用学生证/工作证上的姓名"
            maxlength="30"
            :disabled="isVerified"
            @blur="onCheck"
          />
        </el-form-item>

        <div v-if="checkResult" :class="['check-tip', checkResult.match ? 'ok' : 'err']">
          <el-icon class="tip-icon">
            <component :is="checkResult.match ? 'CircleCheckFilled' : 'CircleCloseFilled'" />
          </el-icon>
          <span>{{ checkResult.message }}</span>
          <span v-if="checkResult.match && checkResult.department" class="check-dept">
            ({{ checkResult.department }})
          </span>
        </div>
        <div v-else-if="checkLoading" class="check-tip loading">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>正在校验白名单...</span>
        </div>
        <div v-else-if="!isVerified" class="check-tip hint">
          系统会与校内人员白名单比对,匹配后自动通过
        </div>
      </el-form>

      <!-- 按钮放表单外,避免 el-form :disabled 透传给按钮 -->
      <div class="form-actions">
        <el-button
          v-if="!isVerified"
          type="primary"
          :loading="submitting"
          :disabled="!checkResult?.match"
          @click="onSubmit"
        >
          提交认证
        </el-button>
        <el-button @click="router.back()">返回</el-button>
      </div>
    </div>

    <div class="info-card">
      <h4>认证说明</h4>
      <ul>
        <li>本平台仅对校内师生开放,认证信息由学校提供</li>
        <li>学号/工号 + 真实姓名 须与白名单完全一致</li>
        <li>一个学号/工号只能绑定一个账号</li>
        <li>如有疑问,请联系系统管理员</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.campus-verify-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 8px 0 32px;
}

.page-header {
  margin-bottom: 18px;
}
.title {
  font-size: 20px;
  font-weight: 700;
  color: #1f1f1f;
  margin: 0 0 4px;
}
.subtitle {
  font-size: 13px;
  color: #888;
  margin: 0;
}

.status-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  margin-bottom: 16px;
  border-left: 4px solid #f59e0b;
}
.status-card.ok { border-left-color: #67c23a; }
.status-icon {
  font-size: 32px;
  color: #f59e0b;
}
.status-card.ok .status-icon { color: #67c23a; }
.status-body { flex: 1; min-width: 0; }
.status-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #1f1f1f;
}
.status-extra {
  font-weight: 400;
  color: #555;
  font-size: 13px;
}
.status-meta {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
}
.status-meta.err { color: #f56c6c; }

.form-card {
  background: #fff;
  border-radius: 10px;
  padding: 20px 24px 24px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  margin-bottom: 16px;
}
.form-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f1f1f;
  margin: 0 0 12px;
}
.verify-form { padding: 0; }

.form-actions {
  display: flex;
  gap: 12px;
  padding-left: 100px;  /* 对齐 label-width */
  margin-top: 8px;
}

.check-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: -4px 0 12px;
  padding: 8px 12px;
  font-size: 12px;
  border-radius: 6px;
  line-height: 1.4;
}
.check-tip .tip-icon { font-size: 14px; }
.check-tip.ok { color: #67c23a; background: #f0f9eb; border: 1px solid #e1f3d8; }
.check-tip.err { color: #f56c6c; background: #fef0f0; border: 1px solid #fde2e2; }
.check-tip.loading { color: #909399; background: #f5f7fa; border: 1px solid #ebeef5; }
.check-tip.hint { color: #999; background: #f5f7fa; border: 1px dashed #dcdfe6; font-size: 11px; }
.check-dept { margin-left: 4px; color: #888; }

.info-card {
  background: #f5f7fa;
  border-radius: 10px;
  padding: 16px 20px;
  font-size: 13px;
  color: #666;
}
.info-card h4 { margin: 0 0 8px; font-size: 13px; color: #333; }
.info-card ul { margin: 0; padding-left: 20px; line-height: 1.9; }
</style>
