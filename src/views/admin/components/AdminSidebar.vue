<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

// 菜单数据（与 /admin-home/* 路由对应）
const menus = [
  { key: 'dashboards', path: '/admin-home/dashboards', label: '仪表盘', icon: 'Odometer' },
  { key: 'users', path: '/admin-home/users', label: '用户列表', icon: 'User' },
  { key: 'admins', path: '/admin-home/admins', label: '管理员管理', icon: 'Avatar' },
  {
    key: 'goods',
    label: '商品管理',
    icon: 'Goods',
    children: [
      { key: 'goods-list', path: '/admin-home/goods', label: '商品列表' },
      { key: 'goods-audit', path: '/admin-home/goods/audit', label: '商品审核' },
    ],
  },
  { key: 'categories', path: '/admin-home/categories', label: '商品分类', icon: 'Menu' },
  { key: 'refunds', path: '/admin-home/refunds', label: '退款管理', icon: 'RefreshLeft' },
  { key: 'orders', path: '/admin-home/orders', label: '订单管理', icon: 'List' },
  { key: 'review-reports', path: '/admin-home/review-reports', label: '评价举报管理', icon: 'Warning' },
  { key: 'wallet', path: '/admin-home/wallet', label: '钱包管理', icon: 'Wallet' },
  { key: 'messages', path: '/admin-home/messages', label: '消息管理', icon: 'ChatDotRound' },
]

// 商品管理默认展开
const expanded = ref(new Set(['goods']))

const toggleExpand = (key) => {
  if (expanded.value.has(key)) expanded.value.delete(key)
  else expanded.value.add(key)
}

const isActive = (item) => {
  if (item.path) return route.path === item.path || route.path.startsWith(item.path + '/')
  return item.children?.some((c) => route.path === c.path)
}

const navigate = (item) => {
  if (item.path) router.push(item.path)
}

const isChildActive = (child) => route.path === child.path
</script>

<template>
  <aside class="admin-sidebar">
    <!-- 品牌区 -->
    <div class="brand">
      <div class="brand-logo">
        <el-icon :size="20" color="#fff"><Goods /></el-icon>
      </div>
      <span class="brand-name">校园交易平台</span>
    </div>

    <!-- 菜单 -->
    <nav class="menu">
      <template v-for="item in menus" :key="item.key">
        <!-- 父菜单（含子项） -->
        <div v-if="item.children" class="menu-group">
          <div
            class="menu-item parent"
            :class="{ active: isActive(item) }"
            @click="toggleExpand(item.key)"
          >
            <el-icon class="menu-icon">
              <component :is="item.icon" />
            </el-icon>
            <span class="menu-label">{{ item.label }}</span>
            <el-icon class="menu-arrow" :class="{ open: expanded.has(item.key) }">
              <ArrowDown />
            </el-icon>
          </div>
          <div v-show="expanded.has(item.key)" class="submenu">
            <div
              v-for="child in item.children"
              :key="child.key"
              class="menu-item child"
              :class="{ active: isChildActive(child) }"
              @click="navigate(child)"
            >
              <span class="submenu-dot"></span>
              <span class="menu-label">{{ child.label }}</span>
            </div>
          </div>
        </div>

        <!-- 普通菜单 -->
        <div
          v-else
          class="menu-item"
          :class="{ active: isActive(item) }"
          @click="navigate(item)"
        >
          <el-icon class="menu-icon">
            <component :is="item.icon" />
          </el-icon>
          <span class="menu-label">{{ item.label }}</span>
        </div>
      </template>
    </nav>

    </aside>
</template>

<style scoped>
.admin-sidebar {
  width: 210px;
  flex-shrink: 0;
  background: #fff;
  border-right: 1px solid #eef0f3;
  display: flex;
  flex-direction: column;
  /* 不再写 height: 100vh —— 否则 sticky 会让 sidebar 始终占满视口，
     滚动到底时 sidebar 底部会盖住 SiteFooter。让 flex 默认的 align-items: stretch
     把 sidebar 拉到跟 .admin-layout 同高即可。 */
  position: sticky;
  top: 0;
  align-self: stretch;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 20px;
  border-bottom: 1px solid #f0f2f5;
}

.brand-logo {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.brand-name {
  font-size: 15px;
  font-weight: 700;
  color: #1f1f1f;
  letter-spacing: 0.5px;
}

.menu {
  flex: 1;
  padding: 12px 10px;
  overflow-y: auto;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 14px;
  color: #555;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.menu-item:hover {
  background: #f5f7fa;
  color: #ff6b35;
}

.menu-item.active {
  background: linear-gradient(90deg, #fff7f2 0%, #fff 100%);
  color: #ff6b35;
  font-weight: 600;
  position: relative;
}

.menu-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  background: linear-gradient(180deg, #ff8c5a, #ff6b35);
  border-radius: 0 3px 3px 0;
}

.menu-item.parent {
  justify-content: space-between;
}

.menu-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.menu-arrow {
  font-size: 12px;
  color: #c0c4cc;
  transition: transform 0.2s;
}

.menu-arrow.open {
  transform: rotate(180deg);
}

.submenu {
  margin: 4px 0 4px 12px;
  padding-left: 12px;
  border-left: 1px solid #eef0f3;
}

.menu-item.child {
  padding: 8px 12px;
  font-size: 13px;
}

.submenu-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #c0c4cc;
  flex-shrink: 0;
  transition: all 0.2s;
}

.menu-item.child:hover .submenu-dot,
.menu-item.child.active .submenu-dot {
  background: #ff6b35;
}

.menu-label {
  flex: 1;
  white-space: nowrap;
}
</style>
