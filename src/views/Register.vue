<script setup>
import { reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { register } from '@/api/auth'
import { quickCheckVerify } from '@/api/verify'

const router = useRouter()

const form = reactive({
  username: '',
  password: '',
  confirmPassword: '',
  nickname: '',
  phone: '',
  gender: 1,
  campusId: '',
  realName: '',
})

const formRef = ref()
const submitting = ref(false)
const checkResult = ref(null)  // { match, message, personType, department }
const checkLoading = ref(false)

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度 3-20', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度 6-20', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_r, value, cb) => {
        if (value !== form.password) cb(new Error('两次输入的密码不一致'))
        else cb()
      },
      trigger: 'blur',
    },
  ],
  nickname: [
    { required: true, message: '请输入昵称', trigger: 'blur' },
    { max: 20, message: '昵称长度 ≤ 20', trigger: 'blur' },
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' },
  ],
  campusId: [
    { max: 20, message: '学号/工号长度 ≤ 20', trigger: 'blur' },
  ],
  realName: [
    { max: 30, message: '真实姓名长度 ≤ 30', trigger: 'blur' },
  ],
}

// 用户修改学号/姓名时清掉旧的反馈
watch([() => form.campusId, () => form.realName], () => {
  checkResult.value = null
})

const onCheck = async () => {
  if (!form.campusId || !form.realName) {
    checkResult.value = null
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

const handleRegister = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  submitting.value = true
  try {
    await register({
      username: form.username,
      password: form.password,
      nickname: form.nickname,
      phone: form.phone,
      gender: form.gender,
      campusId: form.campusId || undefined,
      realName: form.realName || undefined,
    })
    ElMessage.success('注册成功,请登录')
    router.push('/login')
  } catch (e) {
    ElMessage.error(e?.message || '注册失败')
  } finally {
    submitting.value = false
  }
}

const goLogin = () => router.push('/login')
</script>

<template>
  <div class="register-page">
    <div class="register-card">
      <div class="brand">
        <div class="brand-logo"><span>U</span></div>
        <div>
          <div class="brand-name">校园淘物</div>
          <div class="brand-en">CAMPUS TAOWU</div>
        </div>
      </div>

      <h2 class="title">注册新账号</h2>
      <p class="subtitle">加入校园淘物,发现身边的二手好物</p>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="80px"
        label-position="right"
        class="register-form"
      >
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="3-20 位字符" maxlength="20" />
        </el-form-item>
        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="form.nickname" placeholder="请输入昵称" maxlength="20" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="6-20 位字符"
            show-password
          />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            show-password
          />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" placeholder="11 位手机号" maxlength="11" />
        </el-form-item>
        <el-form-item label="性别" prop="gender">
          <el-radio-group v-model="form.gender">
            <el-radio :value="1">男</el-radio>
            <el-radio :value="2">女</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-divider content-position="left">校园身份认证(可选,但强烈建议完成)</el-divider>

        <el-form-item label="学号/工号" prop="campusId">
          <el-input
            v-model="form.campusId"
            placeholder="学生填学号,教职工填工号"
            maxlength="20"
            @blur="onCheck"
          />
        </el-form-item>
        <el-form-item label="真实姓名" prop="realName">
          <el-input
            v-model="form.realName"
            placeholder="请使用学生证/工作证上的姓名"
            maxlength="30"
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
        <div v-else class="check-tip hint">
          完成后才能发布商品、下单、评价等;不填也能注册,但会受限
        </div>
      </el-form>

      <el-button
        type="primary"
        class="submit-btn"
        :loading="submitting"
        @click="handleRegister"
      >
        立即注册
      </el-button>

      <div class="footer">
        已有账号?<el-link type="primary" :underline="false" @click="goLogin">返回登录</el-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.register-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ff9466 0%, #ff6b35 100%);
  padding: 24px;
}

.register-card {
  width: 100%;
  max-width: 480px;
  background: #fff;
  border-radius: 16px;
  padding: 36px 40px 28px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 24px;
}
.brand-logo {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #ff8c5a 0%, #ff6b35 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 18px;
  box-shadow: 0 2px 8px rgba(255, 107, 53, 0.3);
}
.brand-name { font-size: 16px; font-weight: 700; color: #1f1f1f; }
.brand-en { font-size: 10px; color: #999; letter-spacing: 1.5px; }

.title { font-size: 22px; font-weight: 700; color: #1f1f1f; margin: 0 0 6px; }
.subtitle { color: #999; font-size: 13px; margin: 0 0 24px; }

.register-form { padding: 0; }

.check-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: -8px 0 16px;
  padding: 8px 12px;
  font-size: 12px;
  border-radius: 6px;
  line-height: 1.4;
}
.check-tip .tip-icon { font-size: 14px; }
.check-tip.ok {
  color: #67c23a;
  background: #f0f9eb;
  border: 1px solid #e1f3d8;
}
.check-tip.err {
  color: #f56c6c;
  background: #fef0f0;
  border: 1px solid #fde2e2;
}
.check-tip.loading {
  color: #909399;
  background: #f5f7fa;
  border: 1px solid #ebeef5;
}
.check-tip.hint {
  color: #999;
  background: #f5f7fa;
  border: 1px dashed #dcdfe6;
  font-size: 11px;
}
.check-dept { margin-left: 4px; color: #888; }

.submit-btn {
  width: 100%;
  height: 44px !important;
  font-size: 15px !important;
  font-weight: 600 !important;
  letter-spacing: 2px;
  background: linear-gradient(135deg, #ff8c5a 0%, #ff6b35 100%) !important;
  border: none !important;
  border-radius: 999px !important;
  box-shadow: 0 4px 12px rgba(255, 107, 53, 0.32) !important;
  margin-top: 8px;
}
.submit-btn:hover {
  background: linear-gradient(135deg, #ff7a45 0%, #f55a25 100%) !important;
}

.footer {
  margin-top: 18px;
  text-align: center;
  color: #888;
  font-size: 13px;
}
</style>
