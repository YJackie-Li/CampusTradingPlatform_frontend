<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { login as loginApi } from '@/api/auth'

const router = useRouter()
const userStore = useUserStore()

// 当前登录角色
const activeRole = ref('user') // user-普通用户 / admin-管理员

// 表单数据
const loginForm = reactive({
  username: '',
  password: '',
})

// 表单校验规则
const rules = {
  username: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    { min: 3, max: 20, message: '账号长度在 3-20 个字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度在 6-20 个字符', trigger: 'blur' },
  ],
}

const loginFormRef = ref()
const loading = ref(false)

// 切换登录角色
const switchRole = (role) => {
  activeRole.value = role
  loginForm.username = ''
  loginForm.password = ''
}

// 提交登录
const handleLogin = async () => {
  if (!loginFormRef.value) return
  await loginFormRef.value.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      const data = await loginApi({
        username: loginForm.username,
        password: loginForm.password,
        // 后端以表内 role 为准，这里传过去只是让后端校验登录身份与所选 tab 一致
        role: activeRole.value === 'admin' ? 'ADMIN' : 'USER',
      })
      // data 形如 { token, userInfo } —— 后端 Result.data
      userStore.login(data)
      ElMessage.success('登录成功')
      // 管理员进入后台仪表盘，普通用户进入首页
      router.push(activeRole.value === 'admin' ? '/admin-home/dashboards' : '/home')
    } catch (e) {
      // 业务错误已由 http 拦截器 toast，这里不再重复提示
      console.error('login failed:', e)
    } finally {
      loading.value = false
    }
  })
}

// 跳转到注册
const goToRegister = () => {
  router.push('/register')
}

// 跳转到忘记密码
const goToForgot = () => {
  router.push('/forget-password')
}
</script>

<template>
  <div class="login-page">
    <!-- 左侧品牌区 -->
    <div class="login-brand">
      <!-- 品牌头部：logo + 名称 -->
      <div class="brand-header">
        <div class="brand-logo">
          <el-icon :size="22" color="#fff">
            <ShoppingBag />
          </el-icon>
        </div>
        <span class="brand-name">校园淘物</span>
      </div>

      <!-- 中心文案 -->
      <div class="brand-content">
        <h1 class="brand-title">
          <span>淘你所想</span>
          <span>换你所爱</span>
        </h1>
        <ul class="brand-features">
          <li><span class="dot">·</span>校园二手交易</li>
          <li><span class="dot">·</span>真实身份认证</li>
          <li><span class="dot">·</span>海量好物任你挑</li>
        </ul>
      </div>

      <!-- 装饰插画（CSS 模拟 3D 静物） -->
      <div class="brand-illustration">
        <!-- 橙色切片装饰 -->
        <div class="orange-slice orange-slice-1"></div>
        <div class="orange-slice orange-slice-2"></div>
        <div class="orange-slice orange-slice-3"></div>
        <!-- 雏菊装饰 -->
        <div class="daisy daisy-1">
          <div class="daisy-petal"></div>
          <div class="daisy-petal"></div>
          <div class="daisy-petal"></div>
          <div class="daisy-petal"></div>
          <div class="daisy-petal"></div>
          <div class="daisy-petal"></div>
          <div class="daisy-center"></div>
        </div>
        <div class="daisy daisy-2">
          <div class="daisy-petal"></div>
          <div class="daisy-petal"></div>
          <div class="daisy-petal"></div>
          <div class="daisy-petal"></div>
          <div class="daisy-petal"></div>
          <div class="daisy-petal"></div>
          <div class="daisy-center"></div>
        </div>
        <!-- 平台底座 -->
        <div class="stone-platform"></div>
        <!-- 散落的小圆点 -->
        <span class="spark spark-1"></span>
        <span class="spark spark-2"></span>
        <span class="spark spark-3"></span>
        <span class="spark spark-4"></span>
        <span class="spark spark-5"></span>
      </div>
    </div>

    <!-- 右侧表单区 -->
    <div class="login-form-wrap">
      <div class="login-form-inner">
        <h2 class="form-title">欢迎回来</h2>
        <p class="form-subtitle">登录您的账号，开启校园淘物之旅</p>

        <!-- 角色切换 tabs -->
        <div class="role-tabs">
          <button
            type="button"
            class="role-tab"
            :class="{ active: activeRole === 'user' }"
            @click="switchRole('user')"
          >
            普通用户
          </button>
          <button
            type="button"
            class="role-tab"
            :class="{ active: activeRole === 'admin' }"
            @click="switchRole('admin')"
          >
            管理员
          </button>
        </div>

        <!-- 登录表单 -->
        <el-form
          ref="loginFormRef"
          :model="loginForm"
          :rules="rules"
          class="login-form"
          size="large"
          @keyup.enter="handleLogin"
        >
          <el-form-item prop="username">
            <el-input
              v-model="loginForm.username"
              placeholder="请输入账号"
              clearable
            >
              <template #prefix>
                <el-icon class="input-icon"><User /></el-icon>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item prop="password">
            <el-input
              v-model="loginForm.password"
              type="password"
              placeholder="请输入密码"
              show-password
              clearable
            >
              <template #prefix>
                <el-icon class="input-icon"><Lock /></el-icon>
              </template>
            </el-input>
          </el-form-item>

          <div class="form-options">
            <!-- 记住登录勾选框无后端支持,已撤掉 -->
            <a href="javascript:;" class="forgot-link" @click="goToForgot">忘记密码？</a>
          </div>

          <el-button
            type="primary"
            class="login-btn"
            :loading="loading"
            @click="handleLogin"
          >
            立即登录
          </el-button>

          <div class="form-footer">
            <span>还没有账号？</span>
            <a href="javascript:;" class="register-link" @click="goToRegister">立即注册</a>
          </div>
        </el-form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  width: 100%;
  height: 100vh;
  background: #fff;
  overflow: hidden;
}

/* ============== 左侧品牌区 ============== */
.login-brand {
  position: relative;
  flex: 1.1;
  background: linear-gradient(160deg, #ff9466 0%, #ff6b35 55%, #ff8551 100%);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 48px 60px;
}

.brand-header {
  position: relative;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-logo {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
}

.brand-name {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  letter-spacing: 1px;
}

.brand-content {
  position: relative;
  z-index: 4;
  margin-top: auto;
  margin-bottom: 40px;
  padding-left: 24px;
}

.brand-title {
  display: flex;
  flex-direction: column;
  font-size: 44px;
  font-weight: 700;
  color: #fff;
  line-height: 1.35;
  letter-spacing: 4px;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
}

.brand-features {
  margin-top: 28px;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 22px;
  color: rgba(255, 255, 255, 0.95);
  font-size: 15px;
  letter-spacing: 1px;
}

.brand-features li {
  display: flex;
  align-items: center;
  gap: 4px;
}

.brand-features .dot {
  font-weight: 700;
  margin-right: 4px;
}

/* ============== 装饰插画 ============== */
.brand-illustration {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}

/* 橙色切片 */
.orange-slice {
  position: absolute;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: radial-gradient(
    circle at 50% 50%,
    #ffd6a8 0%,
    #ffb066 30%,
    #ff8a3d 60%,
    #ff6b1a 100%
  );
  box-shadow:
    inset 0 -10px 20px rgba(216, 78, 0, 0.35),
    inset 0 10px 20px rgba(255, 255, 255, 0.3),
    0 12px 30px rgba(190, 60, 0, 0.3);
}

.orange-slice::before,
.orange-slice::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
}

.orange-slice::before {
  background: repeating-conic-gradient(
    from 0deg,
    transparent 0deg 30deg,
    rgba(216, 78, 0, 0.18) 30deg 60deg
  );
}

.orange-slice-1 {
  width: 110px;
  height: 110px;
  bottom: 18%;
  left: 22%;
  transform: rotate(-15deg);
}

.orange-slice-2 {
  width: 80px;
  height: 80px;
  bottom: 12%;
  left: 42%;
  transform: rotate(35deg);
  opacity: 0.92;
}

.orange-slice-3 {
  width: 95px;
  height: 95px;
  bottom: 22%;
  right: 18%;
  transform: rotate(-25deg);
}

/* 平台底座 */
.stone-platform {
  position: absolute;
  bottom: 6%;
  left: 8%;
  right: 8%;
  height: 90px;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.18) 0%,
    rgba(255, 255, 255, 0.05) 100%
  );
  border-radius: 50% 50% 35% 35% / 80% 80% 20% 20%;
  filter: blur(6px);
}

/* 雏菊 */
.daisy {
  position: absolute;
  width: 90px;
  height: 90px;
}

.daisy-petal {
  position: absolute;
  width: 24px;
  height: 38px;
  background: linear-gradient(180deg, #ffffff 0%, #ffe4ec 100%);
  border-radius: 50% 50% 50% 50% / 70% 70% 30% 30%;
  top: 50%;
  left: 50%;
  transform-origin: 50% 100%;
  box-shadow: 0 2px 4px rgba(255, 180, 200, 0.4);
}

.daisy-petal:nth-child(1) { transform: translate(-50%, -100%) rotate(0deg); }
.daisy-petal:nth-child(2) { transform: translate(-50%, -100%) rotate(60deg); }
.daisy-petal:nth-child(3) { transform: translate(-50%, -100%) rotate(120deg); }
.daisy-petal:nth-child(4) { transform: translate(-50%, -100%) rotate(180deg); }
.daisy-petal:nth-child(5) { transform: translate(-50%, -100%) rotate(240deg); }
.daisy-petal:nth-child(6) { transform: translate(-50%, -100%) rotate(300deg); }

.daisy-center {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #ffd56b 0%, #f5a623 70%, #d87f1e 100%);
  transform: translate(-50%, -50%);
  box-shadow: inset 0 2px 4px rgba(150, 80, 0, 0.3);
}

.daisy-1 {
  top: 22%;
  right: 16%;
  transform: rotate(-20deg) scale(1);
}

.daisy-2 {
  top: 40%;
  right: 8%;
  transform: rotate(15deg) scale(0.7);
  opacity: 0.85;
}

/* 散落的小圆点 */
.spark {
  position: absolute;
  width: 6px;
  height: 6px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.8);
}

.spark-1 { top: 30%; left: 18%; }
.spark-2 { top: 55%; left: 12%; width: 4px; height: 4px; }
.spark-3 { top: 70%; right: 30%; width: 5px; height: 5px; }
.spark-4 { top: 18%; right: 35%; }
.spark-5 { top: 45%; right: 18%; width: 4px; height: 4px; }

/* ============== 右侧表单区 ============== */
.login-form-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  padding: 40px;
}

.login-form-inner {
  width: 100%;
  max-width: 400px;
}

.form-title {
  font-size: 32px;
  font-weight: 700;
  color: #1f1f1f;
  letter-spacing: 1px;
  margin-bottom: 10px;
}

.form-subtitle {
  font-size: 14px;
  color: #999;
  margin-bottom: 32px;
  letter-spacing: 0.5px;
}

/* 角色切换 tabs */
.role-tabs {
  display: inline-flex;
  background: #f5f5f5;
  border-radius: 999px;
  padding: 4px;
  margin-bottom: 28px;
}

.role-tab {
  border: none;
  background: transparent;
  padding: 8px 24px;
  font-size: 14px;
  color: #666;
  border-radius: 999px;
  transition: all 0.25s ease;
  letter-spacing: 0.5px;
}

.role-tab.active {
  background: linear-gradient(135deg, #ff6b35 0%, #e85a25 100%);
  color: #fff;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(255, 107, 53, 0.35);
}

/* 表单 */
.login-form {
  width: 100%;
}

.login-form :deep(.el-input__wrapper) {
  background: #f5f7fa;
  border-radius: 10px;
  padding: 4px 12px;
  box-shadow: none !important;
  height: 46px;
  transition: all 0.25s ease;
}

.login-form :deep(.el-input__wrapper:hover) {
  background: #eef1f5;
}

.login-form :deep(.el-input__wrapper.is-focus) {
  background: #fff;
  box-shadow: 0 0 0 1px #ff6b35 inset !important;
}

.login-form :deep(.el-input__inner) {
  height: 38px;
  font-size: 14px;
  color: #333;
}

.login-form :deep(.el-input__inner::placeholder) {
  color: #b5b5b5;
}

.input-icon {
  font-size: 16px;
  color: #999;
  margin-right: 4px;
}

.login-form :deep(.el-form-item) {
  margin-bottom: 18px;
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 6px 0 22px;
  font-size: 13px;
}

.form-options :deep(.el-checkbox__label) {
  color: #666;
  font-size: 13px;
}

.forgot-link {
  color: #ff6b35;
  transition: opacity 0.2s;
}

.forgot-link:hover {
  opacity: 0.75;
}

.login-btn {
  width: 100%;
  height: 46px;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 4px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #ff8c5a 0%, #ff6b35 100%) !important;
  box-shadow: 0 4px 14px rgba(255, 107, 53, 0.35) !important;
  transition: all 0.25s ease;
}

.login-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(255, 107, 53, 0.45) !important;
}

.login-btn:active {
  transform: translateY(0);
}

.form-footer {
  text-align: center;
  margin-top: 20px;
  font-size: 13px;
  color: #999;
}

.register-link {
  color: #ff6b35;
  font-weight: 500;
  margin-left: 4px;
  transition: opacity 0.2s;
}

.register-link:hover {
  opacity: 0.75;
}
</style>
