<script setup>
import { ref, computed, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { Search, HomeFilled, Goods, Star, List, ChatLineRound, ChatDotRound, Location, SwitchButton, User, Lock, Postcard, CircleCheckFilled, Wallet, Clock } from '@element-plus/icons-vue'
import { getUnreadCount, onMessagePush } from '@/api/chat'
import ProfileModals from '@/components/ProfileModals.vue'
import VerifyBanner from '@/components/VerifyBanner.vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

// 个人信息 / 修改密码弹窗引用
const profileModalsRef = ref()

// 未读消息总数（驱动消息中心徽标）
const unreadCount = ref(0)
let pollTimer = null
let unsubscribePush = null

const refreshUnread = async () => {
  try {
    const res = await getUnreadCount()
    unreadCount.value = res?.total ?? 0
  } catch {
    /* ignore */
  }
}

const startPolling = () => {
  if (pollTimer) return
  refreshUnread()
  pollTimer = setInterval(refreshUnread, 10000)
  unsubscribePush = onMessagePush(handlePush)
}

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (unsubscribePush) {
    unsubscribePush()
    unsubscribePush = null
  }
  unreadCount.value = 0
}

const handlePush = () => refreshUnread()

// 登录态切换时启停轮询 —— 游客态不该请求需要登录的接口
watch(
  () => userStore.isLoggedIn,
  (v) => (v ? startPolling() : stopPolling()),
  { immediate: true },
)

onBeforeUnmount(() => stopPolling())

const goChat = () => {
  if (!userStore.isLoggedIn) {
    ElMessage.warning('请先登录')
    router.push('/login')
    return
  }
  router.push('/user-home/chat')
}

const tabs = [
  { key: 'home', label: '首页', icon: HomeFilled, path: '/home' },
  { key: 'products', label: '我的商品', icon: Goods, path: '/user-home/products' },
  { key: 'favorites', label: '我的收藏', icon: Star, path: '/user-home/favorites' },
  { key: 'browse', label: '浏览历史', icon: Clock, path: '/user-home/browse-history' },
  { key: 'orders', label: '订单中心', icon: List, path: '/user-home/orders' },
  { key: 'reviews', label: '我的评价', icon: ChatLineRound, path: '/user-home/reviews' },
  { key: 'wallet', label: '我的钱包', icon: Wallet, path: '/user-home/wallet' },
  { key: 'addresses', label: '收货地址', icon: Location, path: '/user-home/addresses' },
]

// 当前激活 tab
const activeKey = computed(() => {
  if (route.path === '/home') return 'home'
  for (const t of tabs) {
    if (t.path === '/user-home/products' && route.path.startsWith('/user-home/products')) return 'products'
    if (route.path === t.path) return t.key
  }
  return ''
})

const handleTabClick = (t) => {
  if (t.key !== 'home' && !userStore.isLoggedIn) {
    ElMessage.warning('请先登录')
    router.push('/login')
    return
  }
  router.push(t.path)
}

// 搜索：空内容或去掉之前的关键字再次点击 → 视为搜索全部商品（不带 keyword）
const searchKeyword = ref('')
const handleSearch = () => {
  const kw = searchKeyword.value.trim()
  if (!kw) {
    // 空搜索：跳转首页但不携带 keyword，等价于“搜索全部”
    router.push({ path: '/home' })
    return
  }
  router.push({ path: '/home', query: { keyword: kw } })
}

// 用户菜单
const isLoggedIn = computed(() => userStore.isLoggedIn)
const userInfo = computed(() => userStore.userInfo || {})

const handleLogout = () => {
  userStore.logout()
  ElMessage.success('已退出登录')
  router.push('/login')
}

// 个人信息 / 修改密码触发（透传给 ProfileModals）
const openProfile = () => profileModalsRef.value?.openProfileModal()
const openPassword = () => profileModalsRef.value?.openPasswordModal()
</script>

<template>
  <div class="top-navbar">
    <!-- 顶部 bar：Logo + 搜索 + 操作区 -->
    <div class="top-bar">
      <div class="top-inner">
        <div class="brand" @click="router.push('/home')">
          <div class="brand-logo"><span>U</span></div>
          <div class="brand-text">
            <div class="brand-name">校园淘物</div>
            <div class="brand-en">CAMPUS TAOWU</div>
          </div>
        </div>

        <div class="search-box">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索商品、分类..."
            clearable
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button type="primary" class="search-btn" @click="handleSearch">搜索</el-button>
        </div>

        <div class="top-actions">
          <div class="msg-link" @click="goChat">
            <el-icon><ChatDotRound /></el-icon>
            <span>消息中心</span>
            <span v-if="unreadCount > 0" class="msg-dot">
              {{ unreadCount > 99 ? '99+' : unreadCount }}
            </span>
          </div>
          <template v-if="!isLoggedIn">
            <el-button round class="login-btn-text" @click="router.push('/login')">登录</el-button>
            <el-button type="warning" round @click="router.push('/register')">注册</el-button>
          </template>
          <template v-else>
            <el-dropdown trigger="click" @command="(c) => c === 'logout' && handleLogout()">
              <div class="user-info">
                <el-avatar :size="32" :src="userInfo.avatar">
                  {{ (userInfo.nickname || userInfo.username || 'U').slice(0, 1) }}
                </el-avatar>
                <span class="username">{{ userInfo.nickname || userInfo.username || '用户' }}</span>
                <el-icon class="arrow"><ArrowDown /></el-icon>
              </div>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="router.push('/home')">
                    <el-icon><HomeFilled /></el-icon> 回到首页
                  </el-dropdown-item>
                  <el-dropdown-item @click="router.push('/user-home/products')">
                    <el-icon><Goods /></el-icon> 我的商品
                  </el-dropdown-item>
                  <el-dropdown-item @click="openProfile">
                    <el-icon><User /></el-icon> 修改个人信息
                  </el-dropdown-item>
                  <el-dropdown-item @click="openPassword">
                    <el-icon><Lock /></el-icon> 修改密码
                  </el-dropdown-item>
                  <el-dropdown-item @click="router.push('/user-home/campus-verify')">
                    <el-icon><Postcard /></el-icon>
                    校园身份认证
                    <el-tag
                      v-if="userInfo.verifyStatus !== 1"
                      size="small"
                      type="warning"
                      effect="plain"
                      style="margin-left: 4px;"
                    >未认证</el-tag>
                    <el-icon
                      v-else
                      class="verify-ok-icon"
                      color="#67c23a"
                    ><CircleCheckFilled /></el-icon>
                  </el-dropdown-item>
                  <el-dropdown-item command="logout" divided>
                    <el-icon><SwitchButton /></el-icon> 退出登录
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </div>
      </div>
    </div>

    <!-- Tab 导航 -->
    <nav class="tab-nav">
      <div class="tab-inner">
        <div
          v-for="t in tabs"
          :key="t.key"
          class="tab"
          :class="{ active: activeKey === t.key }"
          @click="handleTabClick(t)"
        >
          <el-icon class="tab-icon"><component :is="t.icon" /></el-icon>
          <span>{{ t.label }}</span>
        </div>
      </div>
    </nav>

    <!-- 校园身份认证 banner(全局,TopNavbar 范围内) -->
    <VerifyBanner />

    <!-- 个人信息 / 修改密码弹窗（始终挂在根节点，触发由 dropdown 控制） -->
    <ProfileModals ref="profileModalsRef" />
  </div>
</template>

<style scoped>
.top-navbar {
  background: #fff;
  border-bottom: 1px solid #eef0f3;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

/* ========== 顶部 bar ========== */
.top-bar {
  border-bottom: 1px solid #f0f2f5;
}

.top-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 14px 24px;
  display: grid;
  /* 三栏：左 1fr（品牌）| 中 minmax(0,1fr)（搜索框）| 右 auto（操作区）
     中间列给到真实可用宽度，搜索框 width:100% 才能真的撑满；
     右列改为 auto，让操作区紧贴最右（与下方商品右边缘对齐） */
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 24px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  cursor: pointer;
  user-select: none;
  justify-self: start; /* 贴左 */
}

.brand-logo {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: linear-gradient(135deg, #ff8c5a 0%, #ff6b35 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 18px;
  box-shadow: 0 2px 8px rgba(255, 107, 53, 0.3);
  transition: transform 0.2s;
}

.brand:hover .brand-logo {
  transform: rotate(-5deg) scale(1.05);
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.brand-name {
  font-size: 16px;
  font-weight: 700;
  color: #1f1f1f;
  letter-spacing: 0.5px;
}

.brand-en {
  font-size: 10px;
  color: #999;
  letter-spacing: 1.5px;
  margin-top: 2px;
}

.search-box {
  width: 100%;
  max-width: 760px; /* 拉长：让中间区域更饱满 */
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  justify-self: center; /* 在中间列里水平居中 */
}

.search-box :deep(.el-input) {
  flex: 1; /* 让输入框填满 .search-box 剩余空间 */
  min-width: 0;
}

.search-box :deep(.el-input__wrapper) {
  border-radius: 999px;
  padding: 4px 14px;
  background: #f5f7fa;
  box-shadow: none;
}

.search-box :deep(.el-input__wrapper.is-focus) {
  background: #fff;
  box-shadow: 0 0 0 2px rgba(255, 107, 53, 0.15) !important;
}

.search-btn {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 0 22px;
  background: linear-gradient(135deg, #ff8c5a 0%, #ff6b35 100%);
  border: none;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
  justify-self: end; /* 贴右：与下方商品右边缘对齐 */
}

.msg-link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #555;
  font-size: 14px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
  transition: all 0.2s;
  white-space: nowrap;
}

.msg-link:hover {
  background: #f5f7fa;
  color: #ff6b35;
}

.msg-dot {
  position: absolute;
  top: 2px;
  right: 0;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: #ff4d4f;
  color: #fff;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid #fff;
  line-height: 1;
}

.login-btn-text {
  color: #1f1f1f;
  border: 1px solid #e4e7ed;
  padding: 4px 18px;
  height: 32px;
  font-size: 13px;
}

.login-btn-text:hover {
  border-color: #ff6b35;
  color: #ff6b35;
}

.top-actions :deep(.el-button--warning) {
  background: linear-gradient(135deg, #ff8c5a 0%, #ff6b35 100%) !important;
  border: none !important;
  color: #fff !important;
  padding: 4px 18px;
  height: 32px;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(255, 107, 53, 0.3);
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

.user-info:hover { background: #f5f7fa; }

.username {
  font-size: 14px;
  color: #1f1f1f;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arrow { font-size: 12px; color: #999; }
.verify-ok-icon { margin-left: 4px; font-size: 14px; }

/* ========== Tab 导航 ========== */
.tab-nav {
  background: #fff;
}

.tab-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
}

.tab-inner::-webkit-scrollbar { display: none; }

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 18px;
  font-size: 14px;
  color: #555;
  cursor: pointer;
  border-radius: 10px 10px 0 0;
  position: relative;
  transition: all 0.2s;
  user-select: none;
  white-space: nowrap;
  flex-shrink: 0;
}

.tab:hover {
  color: #ff6b35;
  background: #fff7f2;
}

.tab.active {
  background: linear-gradient(135deg, #1f1f1f 0%, #2c2c2c 100%);
  color: #fff;
  font-weight: 600;
}

.tab-icon { font-size: 16px; }

/* ========== 响应式 ========== */
@media (max-width: 960px) {
  .top-inner {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 12px;
    padding: 12px 16px;
  }
  .search-box {
    max-width: none;
  }
  .tab-inner {
    padding: 0 16px;
  }
  .tab {
    padding: 10px 14px;
    font-size: 13px;
  }
}

@media (max-width: 640px) {
  .msg-link span { display: none; }
  .msg-link { padding: 6px; }
  .login-btn-text { display: none; }
  .username { display: none; }
}
</style>