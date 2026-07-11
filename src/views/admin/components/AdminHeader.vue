<script setup>
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

const handleLogout = () => {
  userStore.logout()
  ElMessage.success('已退出登录')
  router.push('/login')
}
</script>

<template>
  <header class="admin-header">
    <div class="header-right">
      <el-dropdown trigger="click" @command="(c) => c === 'logout' && handleLogout()">
        <div class="user-info">
          <el-avatar :size="32" :src="userStore.userInfo?.avatar">
            {{ (userStore.userInfo?.nickname || userStore.userInfo?.username || 'A').slice(0, 1) }}
          </el-avatar>
          <span class="username">{{ userStore.userInfo?.nickname || userStore.userInfo?.username || '管理员' }}</span>
          <el-icon class="arrow"><ArrowDown /></el-icon>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="profile">
              <el-icon><User /></el-icon> 个人中心
            </el-dropdown-item>
            <el-dropdown-item command="logout" divided>
              <el-icon><SwitchButton /></el-icon> 退出登录
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>
</template>

<style scoped>
.admin-header {
  height: 56px;
  background: #fff;
  border-bottom: 1px solid #eef0f3;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.2s;
}

.user-info:hover {
  background: #f5f7fa;
}

.username {
  font-size: 14px;
  color: #1f1f1f;
}

.arrow {
  font-size: 12px;
  color: #999;
}
</style>
