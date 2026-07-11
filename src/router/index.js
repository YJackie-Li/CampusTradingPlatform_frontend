import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/home',
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录' },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/Register.vue'),
    meta: { title: '注册' },
  },
  {
    path: '/forget-password',
    name: 'ForgotPassword',
    component: () => import('@/views/ForgotPassword.vue'),
    meta: { title: '找回密码' },
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
    meta: { title: '校园淘物' },
  },
  {
    // 管理员端 - 仪表盘（模块二：数据可视化）
    path: '/admin-home',
    component: () => import('@/views/admin/components/AdminLayout.vue'),
    children: [
      {
        path: '',
        redirect: '/admin-home/dashboards',
      },
      {
        path: 'dashboards',
        name: 'AdminDashboard',
        component: () => import('@/views/admin/Dashboard.vue'),
        meta: { title: '仪表盘' },
      },
      // 其它管理页面（模块三/四/五：用户 / 管理员 / 分类）
      {
        path: 'users',
        name: 'AdminUsers',
        component: () => import('@/views/admin/UsersPage.vue'),
        meta: { title: '用户列表' },
      },
      {
        path: 'admins',
        name: 'AdminAdmins',
        component: () => import('@/views/admin/AdminsPage.vue'),
        meta: { title: '管理员管理' },
      },
      {
        path: 'goods',
        name: 'AdminGoods',
        component: () => import('@/views/admin/GoodsPage.vue'),
        meta: { title: '商品列表' },
      },
      {
        path: 'goods/audit',
        name: 'AdminGoodsAudit',
        component: () => import('@/views/admin/GoodsAuditPage.vue'),
        meta: { title: '商品审核' },
      },
      {
        path: 'categories',
        name: 'AdminCategories',
        component: () => import('@/views/admin/CategoriesPage.vue'),
        meta: { title: '商品分类' },
      },
      {
        path: 'refunds',
        name: 'AdminRefunds',
        component: () => import('@/views/admin/RefundsPage.vue'),
        meta: { title: '退款管理' },
      },
      {
        path: 'wallet',
        name: 'AdminWallet',
        component: () => import('@/views/admin/WalletManagePage.vue'),
        meta: { title: '钱包管理' },
      },
      {
        path: 'review-reports',
        name: 'AdminReviewReports',
        component: () => import('@/views/admin/ReviewReportsPage.vue'),
        meta: { title: '评价举报管理' },
      },
      {
        path: 'messages',
        name: 'AdminMessages',
        component: () => import('@/views/admin/MessagesPage.vue'),
        meta: { title: '消息管理' },
      },
    ],
  },
  {
    // 用户端 - 个人中心（模块六：我的商品 / 收藏 / 订单 / 评价 / 地址）
    path: '/user-home',
    component: () => import('@/views/user/UserLayout.vue'),
    children: [
      {
        path: '',
        redirect: '/user-home/products',
      },
      {
        path: 'products',
        name: 'UserProducts',
        component: () => import('@/views/user/MyProductsPage.vue'),
        meta: { title: '我的商品' },
      },
      {
        path: 'product-detail/:id',
        name: 'UserProductDetail',
        component: () => import('@/views/user/ProductDetail.vue'),
        meta: { title: '商品详情' },
      },
      {
        path: 'create-order',
        name: 'UserCreateOrder',
        component: () => import('@/views/user/CreateOrder.vue'),
        meta: { title: '确认订单' },
      },
      {
        path: 'add-review/:id',
        name: 'UserAddReview',
        component: () => import('@/views/user/AddReview.vue'),
        meta: { title: '发表评价' },
      },
      {
        path: 'favorites',
        name: 'UserFavorites',
        component: () => import('@/views/user/Favorites.vue'),
        meta: { title: '我的收藏' },
      },
      {
        path: 'browse-history',
        name: 'UserBrowseHistory',
        component: () => import('@/views/user/BrowseHistory.vue'),
        meta: { title: '浏览历史' },
      },
      {
        path: 'orders',
        name: 'UserOrders',
        component: () => import('@/views/user/OrderCenter.vue'),
        meta: { title: '订单中心' },
      },
      {
        path: 'reviews',
        name: 'UserReviews',
        component: () => import('@/views/user/MyReviews.vue'),
        meta: { title: '我的评价' },
      },
      {
        path: 'chat',
        name: 'UserChat',
        component: () => import('@/views/user/UserChat.vue'),
        meta: { title: '消息中心' },
      },
      {
        // 兼容截图中的 URL：/user-home/my-reviews
        path: 'my-reviews',
        redirect: '/user-home/reviews',
      },
      {
        path: 'addresses',
        name: 'UserAddresses',
        component: () => import('@/views/user/AddressList.vue'),
        meta: { title: '收货地址' },
      },
      {
        path: 'campus-verify',
        name: 'UserCampusVerify',
        component: () => import('@/views/user/CampusVerify.vue'),
        meta: { title: '校园身份认证' },
      },
      {
        path: 'wallet',
        name: 'UserWallet',
        component: () => import('@/views/user/WalletPage.vue'),
        meta: { title: '我的钱包' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/home',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, _from, next) => {
  if (to.meta?.title) {
    document.title = `${to.meta.title} - 校园淘物`
  }
  next()
})

export default router
