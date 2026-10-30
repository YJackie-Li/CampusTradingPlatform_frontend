# trading-platform-frontend

校园二手交易平台前端，基于 Vue 3 + Vite 开发。

## 项目简介

这是一个功能完善的校园二手交易平台前端应用，提供用户端和管理后台两大功能模块。支持商品浏览、在线交易、订单管理、即时通讯、钱包支付、校园认证等核心功能。

## 技术栈

- **前端框架**: Vue 3
- **构建工具**: Vite
- **状态管理**: Pinia
- **路由**: Vue Router
- **HTTP 客户端**: Axios
- **图表库**: ECharts
- **UI 组件**: Element Plus

## 项目结构

```
src/
├── api/                    # API 接口模块
│   ├── addresses.js        # 地址管理
│   ├── adminOrders.js      # 管理员订单
│   ├── admins.js           # 管理员管理
│   ├── ai.js               # AI 相关
│   ├── auth.js             # 认证授权
│   ├── categories.js       # 商品分类
│   ├── chat.js             # 即时通讯
│   ├── goods.js            # 商品管理
│   ├── http.js             # HTTP 封装
│   ├── orders.js           # 订单管理
│   ├── refunds.js          # 退款管理
│   ├── reviews.js          # 评价管理
│   ├── reviewReports.js    # 评价举报
│   ├── statistics.js       # 统计数据
│   ├── user.js             # 用户信息
│   ├── users.js            # 用户管理
│   ├── verify.js           # 认证审核
│   └── wallet.js           # 钱包管理
├── components/             # 公共组件
│   ├── BaseChart.vue       # 基础图表
│   ├── ImageViewer.vue     # 图片查看器
│   ├── ProfileModals.vue   # 个人资料弹窗
│   ├── ReviewReportDialog.vue  # 评价举报弹窗
│   ├── SiteFooter.vue      # 站点底部
│   ├── TopNavbar.vue       # 顶部导航
│   ├── VerifyBanner.vue    # 认证横幅
│   └── charts/             # 图表组件
│       ├── BarChart.vue
│       ├── LineChart.vue
│       ├── PieChart.vue
│       └── RadarChart.vue
├── router/                 # 路由配置
├── stores/                 # Pinia 状态管理
├── styles/                 # 全局样式
├── utils/                  # 工具函数
│   ├── auth-storage.js     # 认证存储
│   └── websocket.js        # WebSocket
└── views/                  # 页面视图
    ├── Home.vue            # 首页
    ├── Login.vue           # 登录
    ├── Register.vue        # 注册
    ├── ForgotPassword.vue  # 忘记密码
    ├── admin/              # 管理员页面
    │   ├── Dashboard.vue       # 仪表盘
    │   ├── AdminsPage.vue      # 管理员管理
    │   ├── CategoriesPage.vue  # 分类管理
    │   ├── GoodsAuditPage.vue  # 商品审核
    │   ├── GoodsPage.vue       # 商品管理
    │   ├── MessagesPage.vue    # 消息管理
    │   ├── OrdersPage.vue      # 订单管理
    │   ├── RefundsPage.vue     # 退款管理
    │   ├── ReviewReportsPage.vue # 评价举报
    │   ├── UsersPage.vue       # 用户管理
    │   ├── WalletManagePage.vue # 钱包管理
    │   └── components/         # 管理员组件
    └── user/               # 用户页面
        ├── AddReview.vue           # 添加评价
        ├── AddressList.vue         # 地址列表
        ├── BrowseHistory.vue       # 浏览历史
        ├── CampusVerify.vue        # 校园认证
        ├── CreateOrder.vue         # 创建订单
        ├── Favorites.vue           # 收藏夹
        ├── MyProductsPage.vue      # 我的商品
        ├── MyReviews.vue           # 我的评价
        ├── OrderCenter.vue         # 订单中心
        ├── ProductDetail.vue       # 商品详情
        ├── UserChat.vue            # 用户聊天
        ├── UserLayout.vue          # 用户布局
        ├── WalletPage.vue          # 钱包页面
        └── components/             # 用户组件
```

## 功能特性

### 用户端
- 用户注册、登录、密码找回
- 校园身份认证
- 商品浏览、搜索、收藏
- 商品发布与管理
- 订单创建、支付、查看
- 退款售后处理
- 商品评价与举报
- 即时通讯聊天
- 钱包充值与提现
- 浏览历史记录

### 管理后台
- 数据统计仪表盘
- 用户管理
- 商品审核与管理
- 订单管理
- 退款处理
- 评价举报管理
- 分类管理
- 管理员管理
- 钱包管理

## 开发环境要求

- Node.js 16+
- npm 8+

## 安装运行

```bash
# 安装依赖
npm install

# 开发模式启动
npm run dev

# 生产环境构建
npm run build

# 预览生产构建
npm run preview
```

## 推荐开发工具

- **IDE**: VS Code
- **浏览器**: Chrome/Edge (推荐使用 Vue.js devtools 插件)

## 接口配置

项目中的 API 接口地址在 `src/api/http.js` 中配置，默认配置为开发环境地址。生产环境需要根据实际情况修改。

## 许可证

本项目仅供学习交流使用。