<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { WarningFilled } from '@element-plus/icons-vue'

const userStore = useUserStore()
const router = useRouter()

// 仅对已登录且未通过认证的用户展示
// (管理员由后端 VerifyInterceptor 免认证,前端保持一致:管理员也展示?——管理员本身就是平台内部,这里隐藏 banner)
const show = computed(() => {
  if (!userStore.isLoggedIn) return false
  const role = userStore.userInfo?.role
  if (role === 'ADMIN') return false
  return userStore.userInfo?.verifyStatus !== 1
})

const goVerify = () => {
  router.push('/user-home/campus-verify')
}
</script>

<template>
  <Transition name="banner">
    <div v-if="show" class="verify-banner" @click="goVerify">
      <div class="banner-inner">
        <el-icon class="banner-icon"><WarningFilled /></el-icon>
        <span class="banner-text">
          你还未完成校园身份认证,完成认证后才能发布商品、下单、评价、聊天等操作。
        </span>
        <el-link type="primary" :underline="false" class="banner-link">
          立即认证 →
        </el-link>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.verify-banner {
  background: linear-gradient(90deg, #fff7e6 0%, #fff1d6 100%);
  border-bottom: 1px solid #ffe0a8;
  color: #ad6800;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}
.verify-banner:hover {
  background: linear-gradient(90deg, #fff1d6 0%, #ffe7c2 100%);
}
.banner-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 9px 24px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.banner-icon {
  font-size: 16px;
  color: #fa8c16;
  flex-shrink: 0;
}
.banner-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.banner-link {
  flex-shrink: 0;
  font-weight: 600;
}

.banner-enter-active, .banner-leave-active {
  transition: all 0.25s;
}
.banner-enter-from, .banner-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
