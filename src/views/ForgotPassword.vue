<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { forgotPassword } from '@/api/auth'

const router = useRouter()

const form = reactive({
  username: '',
  realName: '',
  newPassword: '',
  confirmPassword: '',
})

const formRef = ref()
const submitting = ref(false)

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度 3-20', trigger: 'blur' },
  ],
  realName: [
    { required: true, message: '请输入真实姓名', trigger: 'blur' },
    { max: 30, message: '真实姓名长度 ≤ 30', trigger: 'blur' },
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度 6-20', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_r, value, cb) => {
        if (value !== form.newPassword) cb(new Error('两次输入的密码不一致'))
        else cb()
      },
      trigger: 'blur',
    },
  ],
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
    await forgotPassword({
      username: form.username.trim(),
      realName: form.realName.trim(),
      newPassword: form.newPassword,
      confirmPassword: form.confirmPassword,
    })
    ElMessage.success('密码重置成功,请使用新密码登录')
    router.push('/login')
  } catch (e) {
    // 后端业务错误已由 http 拦截器 toast，这里不再重复
  } finally {
    submitting.value = false
  }
}

const goLogin = () => router.push('/login')
</script>

<template>
  <div class="forgot-page">
    <div class="forgot-card">
      <!-- 品牌头部 -->
      <div class="brand">
        <div class="brand-logo"><span>U</span></div>
        <div>
          <div class="brand-name">校园淘物</div>
          <div class="brand-en">CAMPUS TAOWU</div>
        </div>
      </div>

      <h2 class="title">找回密码</h2>
      <p class="subtitle">通过校园身份核验后即可重置密码</p>

      <!-- 安全门提示 -->
      <div class="security-tip">
        <el-icon class="tip-icon"><Lock /></el-icon>
        <div class="tip-text">
          <div class="tip-title">重置说明</div>
          <div class="tip-content">
            系统会校验你的「用户名 + 真实姓名」是否与校园白名单匹配,
            仅当 <b>已通过校园身份认证</b> 的账号才能通过此方式重置。
            未在白名单的账号请联系管理员录入。
          </div>
        </div>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="90px"
        label-position="right"
        class="forgot-form"
      >
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="请输入登录账号" maxlength="20" clearable />
        </el-form-item>
        <el-form-item label="真实姓名" prop="realName">
          <el-input
            v-model="form.realName"
            placeholder="请输入学生证/工作证上的姓名"
            maxlength="30"
            clearable
          />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input
            v-model="form.newPassword"
            type="password"
            placeholder="6-20 位字符"
            show-password
          />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            placeholder="请再次输入新密码"
            show-password
          />
        </el-form-item>
      </el-form>

      <el-button
        type="primary"
        class="submit-btn"
        :loading="submitting"
        @click="handleSubmit"
      >
        重置密码
      </el-button>

      <div class="footer">
        想起密码了?<el-link type="primary" :underline="false" @click="goLogin">返回登录</el-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.forgot-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ff9466 0%, #ff6b35 100%);
  padding: 24px;
}

.forgot-card {
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
.subtitle { color: #999; font-size: 13px; margin: 0 0 16px; }

/* 安全门提示 */
.security-tip {
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  margin-bottom: 20px;
  background: #fff7f0;
  border: 1px solid #ffd9b8;
  border-radius: 8px;
  align-items: flex-start;
}
.tip-icon {
  color: #ff6b35;
  font-size: 18px;
  margin-top: 2px;
  flex-shrink: 0;
}
.tip-title {
  font-size: 13px;
  font-weight: 600;
  color: #b8541a;
  margin-bottom: 4px;
}
.tip-content {
  font-size: 12px;
  color: #8a4a20;
  line-height: 1.6;
}
.tip-content b {
  color: #b8541a;
  font-weight: 600;
}

.forgot-form { padding: 0; }

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
