<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, CreditCard, ChatLineRound, Van, Box, StarFilled, Warning } from '@element-plus/icons-vue'
import {
  getOrderPage,
  payOrder,
  cancelOrder,
  deliverOrder,
  receiveOrder,
  refundOrder,
  auditRefundOrder,
  getOrderRefund,
  orderStatusText,
  orderStatusTagType,
  canRefund,
} from '@/api/orders'
import { getReviewByOrder, replyReview, createSellerRating } from '@/api/reviews'
import {
  submitReviewReport,
  listReviewReports,
  reportTargetText,
  reportStatusText,
  reportStatusTagType,
  REPORT_TARGET,
} from '@/api/reviewReports'
import PayOrderDialog from './components/PayOrderDialog.vue'
import MoneyFlowBadge from './components/MoneyFlowBadge.vue'

const route = useRoute()
const router = useRouter()

const role = ref('buy') // 'buy' | 'sell'

const tabs = computed(() => {
  const all = { key: 'all', label: '全部' }
  const list = [all]
  const codes = [0, 1, 2, 3, 4, 5, 6]
  const labels = {
    0: '待付款',
    1: '待发货',
    2: '待收货',
    3: '已完成',
    4: '已取消',
    5: '退款中',
    6: '已退款',
  }
  codes.forEach((c) => list.push({ key: c, label: labels[c] }))
  // 买家视角：待评价（已完成但未评价）
  if (role.value === 'buy') {
    list.push({ key: 'pending_review', label: '待评价' })
  }
  // 卖家视角：待回复（已评价但未回复）
  if (role.value === 'sell') {
    list.push({ key: 'pending_reply', label: '待回复' })
  }
  return list
})

const filters = reactive({
  status: 'all',
  keyword: '',
  orderDesc: true, // true=下单时间倒序(新→旧),false=正序(旧→新)
  pageNum: 1,
  pageSize: 10,
})

// 用于在客户端分页展示已过滤的列表（与上面 tabCounts 的全量拉取分开）
const displayedList = ref([])

const loading = ref(false)
const list = ref([])
const total = ref(0)
const tabCounts = reactive({}) // 各 tab 计数

const fetchList = async () => {
  loading.value = true
  try {
    // 清空旧计数（避免 role 切换时残留 pending_review / pending_reply）
    for (const k of Object.keys(tabCounts)) delete tabCounts[k]
    // 一次拉取当前 role 下的所有订单，客户端按状态分组算 tab 计数
    const res = await getOrderPage({
      role: role.value,
      keyword: filters.keyword,
      pageNum: 1,
      pageSize: 1000,
      orderDesc: filters.orderDesc,
    })
    const all = res.records
    tabCounts['all'] = all.length
    for (const s of [0, 1, 2, 3, 4, 5, 6]) {
      tabCounts[s] = all.filter((o) => Number(o.status) === s).length
    }
    // 待评价：买家视角，状态=3 且未评价
    if (role.value === 'buy') {
      tabCounts['pending_review'] = all.filter(
        (o) => Number(o.status) === 3 && !o.reviewed
      ).length
    } else {
      tabCounts['pending_review'] = 0
    }
    // 待回复：卖家视角，状态=3 且已评价 且 评价未回复
    // mockReviews 是闭包引用，需要异步查；这里用简化的判断：已评价则视为待回复
    if (role.value === 'sell') {
      const reviewedOrders = all.filter((o) => Number(o.status) === 3 && o.reviewed)
      tabCounts['pending_reply'] = reviewedOrders.length
    } else {
      tabCounts['pending_reply'] = 0
    }

    // 关键字过滤 + 状态过滤
    // 关键字同时匹配 订单编号 与 商品名称（用户输入即模糊匹配）
    let filtered = all
    if (filters.keyword) {
      const kw = String(filters.keyword).trim().toLowerCase()
      if (kw) {
        filtered = filtered.filter(
          (o) =>
            o.orderNo.toLowerCase().includes(kw) ||
            (o.goodsTitle || '').toLowerCase().includes(kw)
        )
      }
    }
    if (filters.status !== 'all') {
      if (filters.status === 'pending_review') {
        filtered = filtered.filter((o) => Number(o.status) === 3 && !o.reviewed)
      } else if (filters.status === 'pending_reply') {
        filtered = filtered.filter((o) => Number(o.status) === 3 && o.reviewed)
      } else {
        filtered = filtered.filter((o) => Number(o.status) === Number(filters.status))
      }
    }
    list.value = filtered
    total.value = filtered.length

    // 客户端分页：按 pageNum/pageSize 切出当前页展示
    applyPage()
  } finally {
    loading.value = false
  }
}

// 按当前 pageNum/pageSize 切出展示用的列表
const applyPage = () => {
  const start = (filters.pageNum - 1) * filters.pageSize
  displayedList.value = list.value.slice(start, start + filters.pageSize)
}

const handlePageChange = (p) => {
  filters.pageNum = p
  applyPage()
}
const handleSizeChange = (s) => {
  filters.pageSize = s
  filters.pageNum = 1
  applyPage()
}

onMounted(async () => {
  startTickTimer()
  await fetchList()
  // 如果带 focus（来自创建订单成功），滚动到该订单
  if (route.query.focus) {
    const focusId = Number(route.query.focus)
    setTimeout(() => {
      const el = document.getElementById(`order-${focusId}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.classList.add('order-focus')
      setTimeout(() => el?.classList.remove('order-focus'), 1800)
    }, 300)
    // 如果带 autoPay（来自创建订单成功），直接弹起支付框
    if (route.query.autoPay === '1') {
      const target = list.value.find((o) => o.id === focusId && Number(o.status) === 0)
      if (target) {
        payDialog.value = { visible: true, order: target, method: 'ALIPAY' }
      }
    }
  }
})

onBeforeUnmount(() => {
  stopTickTimer()
})

watch(
  () => role.value,
  () => {
    filters.status = 'all'
    filters.pageNum = 1
    fetchList()
  }
)
watch(
  () => filters.status,
  () => {
    filters.pageNum = 1
    fetchList()
  }
)

const handleSearch = () => {
  filters.pageNum = 1
  fetchList()
}
const handleSortChange = () => {
  filters.pageNum = 1
  fetchList()
}

const tabLabel = (k) => {
  if (k === 'all') return '全部'
  if (k === 'pending_review') return '待评价'
  if (k === 'pending_reply') return '待回复'
  return orderStatusText(Number(k))
}
const tabCount = (k) => tabCounts[k] ?? 0

// 操作：买家视角
const handlePay = async (row) => {
  // 打开支付方式弹窗
  payDialog.value = { visible: true, order: row, method: 'ALIPAY' }
}
const handleCancel = async (row) => {
  await ElMessageBox.confirm(`确定要取消订单「${row.orderNo.slice(-6)}」吗？`, '取消订单', {
    type: 'warning',
  })
  await cancelOrder(row.id)
  ElMessage.success('订单已取消')
  fetchList()
}
const handleReceive = async (row) => {
  try {
    await ElMessageBox.confirm('请确认已收到商品，确定收货吗？', '确认收货', {
      type: 'success',
      confirmButtonText: '确定收货',
      cancelButtonText: '再等等',
    })
  } catch {
    return
  }
  await receiveOrder(row.id)
  ElMessage.success('已确认收货')
  fetchList()
}
const handleRefund = async (row) => {
  try {
    const { value } = await ElMessageBox.prompt('请输入退款原因', '申请退款', {
      inputPlaceholder: '请描述退款原因',
      confirmButtonText: '提交申请',
      cancelButtonText: '取消',
    })
    await refundOrder(row.id, { reason: value })
    ElMessage.success('退款申请已提交')
    fetchList()
  } catch {}
}

// 操作：卖家视角
const handleDeliver = async (row) => {
  try {
    await ElMessageBox.confirm('确定已发货吗？', '确认发货', {
      type: 'success',
      confirmButtonText: '确认发货',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  await deliverOrder(row.id)
  ElMessage.success('已发货')
  fetchList()
}

// 支付弹窗（v3 支付升级：余额/支付宝/微信三选项由 PayOrderDialog 内部管理）
const payDialog = ref({ visible: false, order: null })

// 支付成功的回调（PayOrderDialog 触发）
const handlePaid = () => {
  fetchList()
}

// ===== 待付款倒计时 =====
// v2：优先用后端返回的 expireTime（权威锁单截止时间，由 OrderService.createOrder 写入）
// 历史老订单 expireTime 为 null，回退到 create_time + 30min 兜底
const UNPAID_TIMEOUT_MINUTES = 30
const UNPAID_TIMEOUT_MS = UNPAID_TIMEOUT_MINUTES * 60 * 1000
// 用一个秒级 tick 驱动倒计时刷新（避免每个订单各自起 timer，N 个订单 = N 个 timer）
const nowTick = ref(Date.now())
let _tickTimer = null
const startTickTimer = () => {
  if (_tickTimer) return
  _tickTimer = setInterval(() => {
    nowTick.value = Date.now()
  }, 1000)
}
const stopTickTimer = () => {
  if (_tickTimer) {
    clearInterval(_tickTimer)
    _tickTimer = null
  }
}
// 解析订单的真实截止时间戳：expireTime 优先，否则 create_time + 30min
const expireTimestampOf = (o) => {
  if (!o) return null
  if (o.expireTime) {
    const t = new Date(o.expireTime).getTime()
    if (!Number.isNaN(t)) return t
  }
  if (o.createTime) {
    return new Date(o.createTime).getTime() + UNPAID_TIMEOUT_MS
  }
  return null
}
// 剩余毫秒数（≤0 表示已过期）
const remainingMs = (o) => {
  if (!o || o.status !== 0) return null
  const expireAt = expireTimestampOf(o)
  if (expireAt == null) return null
  return expireAt - nowTick.value
}
const isExpired = (o) => {
  const left = remainingMs(o)
  return left !== null && left <= 0
}
const formatCountdown = (o) => {
  const left = remainingMs(o)
  if (left === null) return ''
  if (left <= 0) return '已超时'
  const totalSec = Math.floor(left / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n) => String(n).padStart(2, '0')
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
}
// ===== 剩余退款次数徽标 =====
// 买家视角下，对所有订单展示"还剩 N/3 次退款"——
// 让买家在任何状态下都能直观看到自己的退款机会储备。
// 后端只在 role=buy 时填充 remainingRefundTimes，卖家侧永远不会显示。
const MAX_REFUND_TIMES = 3
const remainingRefundBadge = (o) => {
  if (!o) return null
  const r = o.remainingRefundTimes
  if (r === null || r === undefined) return null
  if (r <= 0) {
    return { kind: 'empty', text: '退款次数已用完' }
  }
  return {
    kind: 'ok',
    text: `还剩 ${r}/${MAX_REFUND_TIMES} 次退款`,
  }
}

// ===== 卖家处理退款倒计时 =====
// 仅在买家视角、status=5 且 refundStage=0 时生效。
// 后端在 applyRefund 时写入 seller_deadline（默认 now + 48h），
// 调度器超时未处理时会升级到管理员；前端用 nowTick 驱动秒级倒计时展示。
const sellerDeadlineMs = (o) => {
  if (!o || o.status !== 5) return null
  if (o.refundStage !== 0) return null
  if (!o.sellerDeadline) return null
  // 后端返回 "yyyy-MM-dd HH:mm:ss"，new Date 解析为本地时间
  const dl = new Date(o.sellerDeadline).getTime()
  if (Number.isNaN(dl)) return null
  return dl - nowTick.value
}
const sellerDeadlineExpired = (o) => {
  const left = sellerDeadlineMs(o)
  return left !== null && left <= 0
}
const formatSellerDeadline = (o) => {
  const left = sellerDeadlineMs(o)
  if (left === null) return ''
  if (left <= 0) return '已超时,等待系统升级'
  const totalSec = Math.floor(left / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n) => String(n).padStart(2, '0')
  if (d > 0) return `${d}天${pad(h)}:${pad(m)}:${pad(s)}`
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
}

// ===== 退款最终裁决结果 =====
// 退款进入 stage=2（已结束）后，把"谁裁决的 / 同意还是拒绝 / 备注 / 时间"
// 一次性展示给买家和卖家，让双方都能看到完整闭环。
//
// 后端 OrderVO 在 stage=2 时填充 refundAuditRemark / refundAuditTime /
// refundAuditByRole（ADMIN / SELLER） / refundAuditByNickname；
// 前端根据 refundStatus（1-同意 2-拒绝）渲染不同颜色和文案。
const refundFinalBlock = (o) => {
  if (!o) return null
  if (o.refundStage !== 2) return null
  // 后端在 stage=2 时一定会回填这四个字段之一（status=1 或 2），
  // 这里再做一层防御，避免旧数据把整个块渲染成空壳。
  const approved = Number(o.refundStatus) === 1
  const role = o.refundAuditByRole // 'ADMIN' | 'SELLER' | undefined
  const actorLabel = role === 'ADMIN' ? '管理员' : role === 'SELLER' ? '卖家' : '处理人'
  const nickname = o.refundAuditByNickname || ''
  const verdictText = approved ? '同意退款' : '拒绝退款'
  const verdictKind = approved ? 'success' : 'danger'
  return {
    approved,
    role,
    actorLabel,
    nickname,
    actorDisplay: nickname ? `${actorLabel} ${nickname}` : actorLabel,
    verdictText,
    verdictKind,
    remark: o.refundAuditRemark || '',
    time: o.refundAuditTime || '',
  }
}

// 买家/卖家通用的最终结果文案：站在用户视角说"对我方"如何
const refundVerdictForViewer = (o) => {
  const blk = refundFinalBlock(o)
  if (!blk) return ''
  // role=buy 时：同意 = 买家胜诉；拒绝 = 卖家胜诉
  // role=sell 时：反过来
  if (role.value === 'buy') {
    return blk.approved ? '买家胜诉，订单已退款' : '买家败诉，订单已恢复原状态'
  }
  return blk.approved ? '卖家败诉，订单已退款' : '卖家胜诉，订单已恢复原状态'
}

// 卖家处理超时后,本地先于调度器感知;触发一次刷新把 stage=1 拉回来
let _refundEscalateFetchTriggered = false
// 待付款订单过期:本地先于调度器感知;触发一次刷新把已取消订单(status=4)拉回来
let _expiredFetchTriggered = false
watch(nowTick, (t) => {
  if (role.value !== 'buy' || !list.value?.length) return
  const has = list.value.some(
    (o) => o.status === 5 && o.refundStage === 0 && o.sellerDeadline
  )
  if (!has) return
  const expired = list.value.some((o) => {
    if (o.status !== 5 || o.refundStage !== 0 || !o.sellerDeadline) return false
    return new Date(o.sellerDeadline).getTime() - t <= 0
  })
  if (expired && !_refundEscalateFetchTriggered) {
    _refundEscalateFetchTriggered = true
    fetchList().finally(() => {
      setTimeout(() => (_refundEscalateFetchTriggered = false), 5000)
    })
  }
})
watch(nowTick, (t) => {
  if (!list.value?.length) return
  const hasAnyPending = list.value.some((o) => Number(o.status) === 0)
  if (!hasAnyPending) return
  // 任一待付款订单过期时拉一次
  const anyExpired = list.value.some((o) => {
    if (Number(o.status) !== 0) return false
    const expireAt = expireTimestampOf(o)
    return expireAt != null && t >= expireAt
  })
  if (anyExpired && !_expiredFetchTriggered) {
    _expiredFetchTriggered = true
    fetchList().finally(() => {
      // 列表刷新后允许再次触发（处理用户跨过整点的场景）
      setTimeout(() => (_expiredFetchTriggered = false), 5000)
    })
  }
})
const submitPay = async () => {
  // 已废弃:v3 支付升级后,支付逻辑下沉到 PayOrderDialog 组件内
  // 此处保留空函数以防旧引用,正常流程不会进入
  console.warn('[OrderCenter] submitPay 已废弃,支付流程在 PayOrderDialog 内完成')
}

// 跳转评价
const goReview = (row) => {
  router.push(`/user-home/add-review/${row.id}`)
}

// 跳详情
const goProduct = (row) => {
  router.push(`/user-home/product-detail/${row.goodsId}`)
}

// 顶部 role 切换
const switchRole = (r) => (role.value = r)

const tradeMethodLabel = (m) =>
  ({ FACE_TO_FACE: '自提', EXPRESS: '邮递', BOTH: '两者皆可' }[m] || '-')

// 时间格式化（简短版）
const timeShort = (s) => (s ? s.slice(5, 16) : '')

// 操作按钮（按角色 + 状态）
const actionButtons = (row) => {
  const btns = []
  if (role.value === 'buy') {
    if (row.status === 0) {
      // 倒计时归零时禁用"立即支付"，避免点击后被后端拒绝
      const payDisabled = isExpired(row)
      btns.push({
        key: 'pay',
        label: payDisabled ? '已超时' : '立即支付',
        type: 'primary',
        ghost: false,
        disabled: payDisabled,
      })
      btns.push({ key: 'cancel', label: '取消订单', type: '', ghost: true })
    }
    if (row.status === 2) {
      btns.push({ key: 'receive', label: '确认收货', type: 'primary', ghost: false })
    }
    if (canRefund(row)) {
      // 同一商品同一买家最多 3 次退款；用完时按钮变灰提示
      const remaining = row.remainingRefundTimes
      if (remaining !== null && remaining !== undefined && remaining <= 0) {
        btns.push({
          key: 'refund',
          label: '退款次数已用完',
          type: 'info',
          ghost: true,
          disabled: true,
          tip: '该商品的 3 次退款机会已用完',
        })
      } else {
        const tip = remaining !== null && remaining !== undefined && remaining <= 1
          ? `本商品还剩 ${remaining} 次退款机会`
          : ''
        btns.push({
          key: 'refund',
          label: '申请退款',
          type: 'danger',
          ghost: true,
          disabled: false,
          tip,
        })
      }
    }
    if (row.status === 3 && !row.reviewed) {
      btns.push({ key: 'review', label: '去评价', type: 'primary', ghost: false })
    }
    // v4 升级：任一侧有评分都能进弹窗查看，否则买家永远看不到卖家给自己打的分
    if (row.status === 3 && (row.reviewed || row.sellerReviewed)) {
      btns.push({ key: 'review-view', label: '查看评价', type: '', ghost: true })
    }
  } else {
    if (row.status === 1) {
      btns.push({ key: 'deliver', label: '立即发货', type: 'primary', ghost: false })
    }
    if (row.status === 5) {
      // 仅在 stage=0（待卖家）时才出现处理按钮
      // stage=1 表示卖家已拒绝，订单已升级到管理员；卖家再点也无效
      if (row.refundStage === 0 || row.refundStage == null) {
        btns.push({ key: 'refund-audit', label: '处理退款', type: 'warning', ghost: false })
      } else if (row.refundStage === 1) {
        btns.push({ key: 'refund-pending', label: '已升级管理员', type: 'info', ghost: true, disabled: true })
      }
    }
    // 卖家视角下的评价入口（v4 升级后对称化）：
    //   - "查看评价"：任一侧有评分都能点（看双区展示）
    //   - "评价买家"：自己还没给买家打分时单独一个主操作按钮
    // 两个按钮可以共存：买家先评 → 卖家既能看买家的话，又能给自己打分；卖家先评 → 至少能查看自己写的内容。
    if (row.status === 3) {
      if (row.reviewed || row.sellerReviewed) {
        btns.push({ key: 'review-view', label: '查看评价', type: '', ghost: true })
      }
      if (!row.sellerReviewed) {
        btns.push({ key: 'rate-buyer', label: '评价买家', type: 'primary', ghost: false })
      }
    }
  }
  return btns
}

const handleAction = (btn, row) => {
  if (btn.disabled) return
  switch (btn.key) {
    case 'pay': return handlePay(row)
    case 'cancel': return handleCancel(row)
    case 'receive': return handleReceive(row)
    case 'refund': return handleRefund(row)
    case 'review': return goReview(row)
    case 'deliver': return handleDeliver(row)
    case 'refund-audit': return openRefundAuditDialog(row)
    case 'refund-pending': return ElMessage.info('已升级到管理员仲裁，等待管理员处理')
    case 'rate-buyer': return openSellerRatingDialog(row)
    case 'review-view': return openReviewDialog(row)
  }
}

// ===== 卖家处理退款弹窗 =====
const refundAuditDialog = reactive({
  visible: false,
  order: null,
  refund: null,
  decision: 'approve', // 'approve' | 'reject'
  remark: '',
  submitting: false,
})
const openRefundAuditDialog = async (order) => {
  refundAuditDialog.order = order
  refundAuditDialog.decision = 'approve'
  refundAuditDialog.remark = ''
  refundAuditDialog.refund = null
  refundAuditDialog.visible = true
  try {
    refundAuditDialog.refund = await getOrderRefund(order.id)
  } catch (e) {
    ElMessage.error(e?.message || '加载退款详情失败')
  }
}
const submitRefundAudit = async () => {
  const dlg = refundAuditDialog
  if (!dlg.refund?.id) {
    ElMessage.warning('退款记录未加载完成')
    return
  }
  if (dlg.decision === 'reject' && !dlg.remark.trim()) {
    ElMessage.warning('拒绝时必须填写备注')
    return
  }
  dlg.submitting = true
  try {
    await auditRefundOrder(dlg.refund.id, {
      status: dlg.decision === 'approve' ? 1 : 2,
      auditRemark: dlg.remark.trim() || (dlg.decision === 'approve' ? '同意退款' : ''),
    })
    ElMessage.success(dlg.decision === 'approve' ? '已同意退款' : '已拒绝退款')
    dlg.visible = false
    fetchList()
  } catch (e) {
    ElMessage.error(e?.message || '操作失败')
  } finally {
    dlg.submitting = false
  }
}

// ===== 评价弹窗（查看 / 卖家回复）=====
const reviewDialog = ref({
  visible: false,
  order: null,
  review: null, // mock reviews 记录
  replyText: '',
  canReply: false, // 卖家视角且未回复
  loading: false,
})

const openReviewDialog = async (row) => {
  reviewDialog.value.visible = true
  reviewDialog.value.order = row
  reviewDialog.value.loading = true
  reviewReports.value = []
  try {
    const res = await getReviewByOrder(row.id)
    reviewDialog.value.review = res
    const isSellerView = role.value === 'sell'
    const noReplyYet = !res?.reply
    reviewDialog.value.canReply = isSellerView && noReplyYet
    reviewDialog.value.replyText = ''
  } finally {
    reviewDialog.value.loading = false
  }
  // 评价加载完后再拉一次举报列表（举报是独立接口，避免阻塞弹窗）
  refreshReviewReports()
}

const replyLen = computed(() => reviewDialog.value.replyText?.length || 0)

// 弹窗标题：根据"哪一边已评" + 当前观众视角动态显示，
// 避免买家侧出现"我对买家的评价"这种从卖家第一人称写出的文案。
// - 双方都评：双方评价（足够直观，不分主谓）
// - 仅卖家评：role=sell → "我对买家的评价" / role=buy → "卖家给我的评价"
// - 仅买家评或都未评：商品评价（默认）
const reviewDialogTitle = computed(() => {
  const order = reviewDialog.value.order
  const review = reviewDialog.value.review
  const goodsTitle = order?.goodsTitle || '商品'
  if (!review) return `商品评价 · ${goodsTitle}`
  const b = hasBuyerReview(review)
  const s = hasSellerRating(review)
  if (b && s) return `双方评价 · ${goodsTitle}`
  if (s) {
    return role.value === 'sell'
      ? `我对买家的评价 · ${goodsTitle}`
      : `卖家给我的评价 · ${goodsTitle}`
  }
  return `商品评价 · ${goodsTitle}`
})

// "我对买家的评价" section 内的 tag 也走同样的视角切换，避免同一段 UI 出现自相矛盾的主谓
const sellerRatingSectionTag = computed(() =>
  role.value === 'sell' ? '我对买家的评价' : '卖家给我的评价'
)

// ===== 卖家评价买家弹窗（v4 升级）=====
// 与 reviewDialog(查看/回复) 分开独立维护：评分控件 + 简短评语即可，
// 避免在已有 review-dialog 里塞两套关注点不同的 UI。
const sellerRatingDialog = ref({
  visible: false,
  order: null,
  rating: 5,
  content: '',
  submitting: false,
})
const openSellerRatingDialog = (row) => {
  sellerRatingDialog.value.order = row
  sellerRatingDialog.value.rating = 5
  sellerRatingDialog.value.content = ''
  sellerRatingDialog.value.submitting = false
  sellerRatingDialog.value.visible = true
}
const sellerRatingLen = computed(
  () => sellerRatingDialog.value.content?.length || 0
)
const submitSellerRating = async () => {
  const dlg = sellerRatingDialog.value
  if (!dlg.order?.id) {
    ElMessage.warning('订单信息缺失')
    return
  }
  const r = Number(dlg.rating)
  if (!r || r < 1 || r > 5) {
    ElMessage.warning('请先打分（1-5 星）')
    return
  }
  if (dlg.content && dlg.content.length > 500) {
    ElMessage.warning('评价内容不超过 500 字')
    return
  }
  dlg.submitting = true
  try {
    await createSellerRating({
      orderId: dlg.order.id,
      rating: r,
      content: dlg.content.trim() || undefined,
    })
    ElMessage.success('已评价买家')
    dlg.visible = false
    fetchList()
  } catch (e) {
    ElMessage.error(e?.message || '提交失败')
  } finally {
    dlg.submitting = false
  }
}

const submitReply = async () => {
  const text = reviewDialog.value.replyText.trim()
  if (!text) {
    ElMessage.warning('请输入回复内容')
    return
  }
  if (text.length > 500) {
    ElMessage.warning('回复不能超过 500 字')
    return
  }
  // ⚠️ 修复：replyReview 第一个参数必须是 review.id，之前误传成 order.id
  await replyReview(reviewDialog.value.review.id, text)
  // 刷新弹窗内的 review（按订单号查询即可）
  const res = await getReviewByOrder(reviewDialog.value.order.id)
  reviewDialog.value.review = res
  reviewDialog.value.canReply = false
  reviewDialog.value.replyText = ''
  ElMessage.success('回复成功')
  // 回复后回复内容可能变化，重新拉一次举报列表
  await refreshReviewReports()
}

// ===== 评价举报 =====
// 一条评价下最多两条举报：1=评价内容(由卖家发起) 2=回复内容(由买家发起)。
// 双方在弹窗里都能看到对方提交的举报 + 管理员的最终裁决。
const reviewReports = ref([]) // 弹窗内展示的举报列表
const reviewReportsLoading = ref(false)

// 后端约定 status=2 表示"删除"(确认违规)，与 reviewReports.js 中的常量保持一致
const REPORT_STATUS_DELETED = 2

// 当前用户能举报的"目标"：
// - 买家视角：可以举报"回复内容"（target=2），但仅在已有回复时显示
// - 卖家视角：可以举报"评价内容"（target=1）
// 已举报过的目标不再显示举报按钮。
const reportTargetForViewer = (review) => {
  if (!review) return []
  const r = role.value
  const out = []
  if (r === 'buy' && review.reply) {
    out.push({
      key: REPORT_TARGET.REPLY_CONTENT,
      targetType: REPORT_TARGET.REPLY_CONTENT,
      label: '举报回复',
      disabled: reviewReports.value.some(
        (x) => x.targetType === REPORT_TARGET.REPLY_CONTENT && x.status === 0
      ),
      alreadyDone: reviewReports.value.some(
        (x) => x.targetType === REPORT_TARGET.REPLY_CONTENT
      ),
    })
  }
  if (r === 'sell' && review.content) {
    out.push({
      key: REPORT_TARGET.REVIEW_CONTENT,
      targetType: REPORT_TARGET.REVIEW_CONTENT,
      label: '举报评价',
      disabled: reviewReports.value.some(
        (x) => x.targetType === REPORT_TARGET.REVIEW_CONTENT && x.status === 0
      ),
      alreadyDone: reviewReports.value.some(
        (x) => x.targetType === REPORT_TARGET.REVIEW_CONTENT
      ),
    })
  }
  return out
}

// 把"目标"是否在管理员"删除"裁决里被处理过 —— 用于把该段内容置灰
const isReviewContentRemoved = (review) => {
  if (!review) return false
  if (review.auditStatus === 2) return true
  return reviewReports.value.some(
    (x) => x.targetType === REPORT_TARGET.REVIEW_CONTENT
      && x.status === REPORT_STATUS_DELETED
  )
}
const isReplyContentRemoved = (review) => {
  if (!review) return false
  if (!review.reply) return true
  return reviewReports.value.some(
    (x) => x.targetType === REPORT_TARGET.REPLY_CONTENT
      && x.status === REPORT_STATUS_DELETED
  )
}

// 双方独立评价标记（v4 升级）：
// - rating 非空 → 买家已打分（买家侧显示入口）
// - sellerRating 非空 → 卖家已打分（卖家侧显示入口）
// 用 helper 封装让模板里 v-if/render 都走同一处判定，避免散写泄露到模板里。
const hasBuyerReview = (review) => review != null && review.rating != null
const hasSellerRating = (review) => review != null && review.sellerRating != null

// "我方视角"的举报展示：
// - 评价 / 回复内容被管理员删除 → 显示「[此内容已被管理员删除]」
// - 对方对我方内容发起的举报 + 管理员裁决（保留/删除）→ 展示出来
const refreshReviewReports = async () => {
  const dlg = reviewDialog.value
  if (!dlg.review?.id) {
    reviewReports.value = []
    return
  }
  reviewReportsLoading.value = true
  try {
    const list = await listReviewReports(dlg.review.id)
    reviewReports.value = Array.isArray(list) ? list : []
  } catch (e) {
    // 列表拉取失败不阻塞弹窗
    console.warn('加载举报列表失败', e)
    reviewReports.value = []
  } finally {
    reviewReportsLoading.value = false
  }
}

// 打开"提交举报"弹窗
const reportDialog = reactive({
  visible: false,
  targetType: null,
  targetLabel: '',
  reason: '',
  description: '',
  submitting: false,
})
const openReportDialog = (target) => {
  if (target.disabled || target.alreadyDone) {
    if (target.alreadyDone) {
      ElMessage.info(`你已${target.label.slice(2)}过该内容，请等待管理员处理`)
    }
    return
  }
  reportDialog.targetType = target.targetType
  reportDialog.targetLabel = target.label
  reportDialog.reason = ''
  reportDialog.description = ''
  reportDialog.submitting = false
  reportDialog.visible = true
}
const submitReport = async () => {
  const reason = reportDialog.reason.trim()
  if (!reason) {
    ElMessage.warning('请填写举报原因')
    return
  }
  if (reason.length > 100) {
    ElMessage.warning('举报原因不超过 100 字')
    return
  }
  const dlg = reviewDialog.value
  if (!dlg.review?.id) return
  reportDialog.submitting = true
  try {
    await submitReviewReport({
      reviewId: dlg.review.id,
      targetType: reportDialog.targetType,
      reason,
      description: reportDialog.description.trim() || undefined,
    })
    ElMessage.success('举报已提交，等待管理员处理')
    reportDialog.visible = false
    await refreshReviewReports()
    // 重新拉一下评价详情（管理员可能已经处理过 — 极端情况下 content/auditStatus 也会变）
    try {
      const fresh = await getReviewByOrder(dlg.order.id)
      dlg.review = fresh
    } catch {}
  } catch (e) {
    ElMessage.error(e?.message || '提交失败')
  } finally {
    reportDialog.submitting = false
  }
}
</script>

<template>
  <div class="order-center-page">
    <!-- role 切换 -->
    <div class="role-bar">
      <div class="role-switch">
        <span
          class="role-pill"
          :class="{ active: role === 'buy' }"
          @click="switchRole('buy')"
        >我的购买</span>
        <span
          class="role-pill"
          :class="{ active: role === 'sell' }"
          @click="switchRole('sell')"
        >我的出售</span>
      </div>
    </div>

    <!-- 状态 tabs -->
    <div class="status-tabs">
      <div
        v-for="t in tabs"
        :key="t.key"
        class="tab"
        :class="{ active: filters.status === t.key }"
        @click="filters.status = t.key"
      >
        {{ tabLabel(t.key) }} ({{ tabCount(t.key) }})
      </div>
    </div>

    <!-- 搜索：订单编号 / 商品名称 + 时间排序（同一行） -->
    <div class="search-bar">
      <el-input
        v-model="filters.keyword"
        placeholder="搜索订单编号 / 商品名称"
        clearable
        class="search-input"
        @keyup.enter="handleSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-button type="primary" class="search-btn" @click="handleSearch">搜索</el-button>
      <span class="sort-label">时间排序：</span>
      <el-radio-group v-model="filters.orderDesc" size="small" @change="handleSortChange">
        <el-radio-button :value="true">倒序</el-radio-button>
        <el-radio-button :value="false">正序</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 订单列表 -->
    <div v-loading="loading" class="order-list">
      <div
        v-for="o in displayedList"
        :key="o.id"
        :id="`order-${o.id}`"
        class="order-card"
      >
        <div class="order-head">
          <span class="order-no">订单编号：{{ o.orderNo }}</span>
          <div class="order-head-right">
            <!-- 待付款倒计时：仅在买家视角 + status=0 时显示 -->
            <span
              v-if="role === 'buy' && o.status === 0"
              class="countdown"
              :class="{ 'countdown-expired': isExpired(o) }"
            >
              <el-icon :size="13"><CreditCard /></el-icon>
              <template v-if="isExpired(o)">
                支付超时，请重新下单
              </template>
              <template v-else>
                支付剩余 <span class="countdown-time">{{ formatCountdown(o) }}</span>
              </template>
            </span>
            <!-- 剩余退款次数：买家视角下单头位置醒目展示 -->
            <span
              v-if="role === 'buy' && remainingRefundBadge(o)"
              class="refund-quota"
              :class="{ 'refund-quota-empty': remainingRefundBadge(o).kind === 'empty' }"
            >
              {{ remainingRefundBadge(o).text }}
            </span>
            <el-tag :type="orderStatusTagType(o.status)" effect="light" size="small">
              {{ orderStatusText(o.status) }}
            </el-tag>
            <!-- v3 支付升级:资金状态徽标 -->
            <MoneyFlowBadge :status="o.status" :receive-time="o.receiveTime" />
          </div>
        </div>
        <div class="order-body">
          <!-- 只有图片区域（封面 / 占位图）点击才跳商品详情，
               其它区域（订单详情、按钮）不再误触发跳转 -->
          <div class="order-cover-wrap" @click="goProduct(o)" title="查看商品详情">
            <img v-if="o.goodsCover" :src="o.goodsCover" class="order-cover" alt="cover" />
            <div v-else class="order-cover order-cover-empty">
              <el-icon :size="22" color="#bbb"><Box /></el-icon>
            </div>
          </div>
          <div class="order-main">
            <div class="order-title">{{ o.goodsTitle }}</div>
            <div class="order-meta">
              <el-icon :size="12"><Van v-if="o.tradeMethod === 'EXPRESS'" /><Box v-else /></el-icon>
              <span>{{ tradeMethodLabel(o.tradeMethod) }}</span>
              <span class="meta-dot">·</span>
              <span class="seller-tag">卖家：{{ o.sellerNickname }}</span>
              <span v-if="role === 'buy'" class="meta-dot">·</span>
              <span v-if="role === 'buy'">买家：{{ o.buyerNickname }}</span>
            </div>
            <div v-if="o.status !== 0 && (o.payTime || o.deliverTime || o.receiveTime || o.finishTime || o.cancelTime)" class="order-times">
              <span v-if="o.payTime">支付：{{ timeShort(o.payTime) }}</span>
              <span v-if="o.deliverTime">发货：{{ timeShort(o.deliverTime) }}</span>
              <span v-if="o.receiveTime">收货：{{ timeShort(o.receiveTime) }}</span>
              <span v-if="o.finishTime">完成：{{ timeShort(o.finishTime) }}</span>
              <span v-if="o.cancelTime">取消：{{ timeShort(o.cancelTime) }}</span>
            </div>
            <!-- 订单详情（买卖双方都可见）：买家备注 / 收货方式 / 收货地址 + 运费（仅邮递时） -->
            <div class="order-extra">
              <div v-if="o.remark" class="extra-line">
                <span class="extra-label">买家备注：</span>
                <span class="extra-value">{{ o.remark }}</span>
              </div>
              <div class="extra-line">
                <span class="extra-label">收货方式：</span>
                <span class="extra-value">{{ tradeMethodLabel(o.tradeMethod) }}</span>
              </div>
              <template v-if="o.tradeMethod === 'EXPRESS'">
                <div v-if="o.addressText" class="extra-line">
                  <span class="extra-label">收货地址：</span>
                  <span class="extra-value extra-value-address">{{ o.addressText }}</span>
                </div>
                <div v-if="o.freight != null" class="extra-line">
                  <span class="extra-label">运费：</span>
                  <span class="extra-value">¥{{ Number(o.freight) }}</span>
                </div>
              </template>
            </div>
            <!-- 退款中：根据 stage 显示不同提示 -->
            <div
              v-if="o.status === 5"
              class="refund-hint"
              :class="{
                'refund-hint-warn': o.refundStage === 1,
                'refund-hint-info': o.refundStage !== 1,
                'refund-hint-urgent': o.refundStage === 0 && sellerDeadlineExpired(o),
              }"
            >
              <template v-if="o.refundStage === 1">
                <el-icon :size="12"><Bell /></el-icon>
                卖家已拒绝退款，已升级到管理员仲裁
              </template>
              <template v-else-if="o.sellerDeadline">
                <el-icon :size="12"><ChatLineRound /></el-icon>
                <span v-if="sellerDeadlineExpired(o)">
                  卖家超时未处理，等待系统升级管理员
                </span>
                <span v-else>
                  等待卖家处理，还剩 <span class="refund-countdown-time">{{ formatSellerDeadline(o) }}</span>
                </span>
              </template>
              <template v-else>
                <el-icon :size="12"><ChatLineRound /></el-icon>
                等待卖家处理退款申请
              </template>
            </div>
            <!-- 退款已结束：无论订单当前 status 是 5/6 还是被回退到 1/2/3，
                 只要 refundStage=2 都要把最终裁决结果展示给买家和卖家 -->
            <div
              v-if="refundFinalBlock(o)"
              class="refund-result"
              :class="`refund-result-${refundFinalBlock(o).verdictKind}`"
            >
              <div class="refund-result-head">
                <el-tag
                  :type="refundFinalBlock(o).verdictKind === 'success' ? 'success' : 'danger'"
                  size="small"
                  effect="plain"
                >
                  {{ refundFinalBlock(o).verdictText }}
                </el-tag>
                <span class="refund-result-actor">
                  {{ refundFinalBlock(o).actorDisplay }} 裁决
                </span>
                <span v-if="refundFinalBlock(o).time" class="refund-result-time">
                  {{ timeShort(refundFinalBlock(o).time) }}
                </span>
              </div>
              <div class="refund-result-verdict">
                {{ refundVerdictForViewer(o) }}
              </div>
              <div v-if="refundFinalBlock(o).remark" class="refund-result-remark">
                <span class="refund-result-remark-label">裁决理由</span>
                <span class="refund-result-remark-text">{{ refundFinalBlock(o).remark }}</span>
              </div>
            </div>
          </div>
          <div class="order-price">
            <div class="price">¥{{ o.price }}</div>
            <div class="qty">× {{ o.quantity }}</div>
          </div>
          <div class="order-actions">
            <el-tooltip
              v-for="b in actionButtons(o)"
              :key="b.key"
              :content="b.tip || ''"
              :disabled="!b.tip"
              placement="top"
            >
              <el-button
                :type="b.type"
                :plain="b.ghost"
                :disabled="b.disabled"
                size="small"
                round
                class="action-btn"
                @click.stop="handleAction(b, o)"
              >
                {{ b.label }}
              </el-button>
            </el-tooltip>
          </div>
        </div>
      </div>

      <el-empty v-if="!loading && list.length === 0" description="暂无订单" />

      <!-- 分页 -->
      <div v-if="total > 0" class="pagination">
        <span class="total">共 {{ total }} 条订单</span>
        <el-pagination
          v-model:current-page="filters.pageNum"
          v-model:page-size="filters.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="sizes, prev, pager, next, jumper"
          background
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </div>

    <!-- 支付方式弹窗：v3 支付升级,余额/支付宝/微信三选项在 PayOrderDialog 内 -->
    <PayOrderDialog v-model="payDialog" @paid="handlePaid" />

    <!-- 评价详情 / 卖家回复弹窗 -->
    <el-dialog
      v-model="reviewDialog.visible"
      :title="reviewDialogTitle"
      width="600px"
      align-center
      :show-close="true"
      :close-on-click-modal="false"
    >
      <div v-if="reviewDialog.loading" class="loading-inline">加载中...</div>
      <template v-else-if="reviewDialog.review">
        <!-- ============== 买家→卖家评价（仅当 rating 非空时展示）============== -->
        <section v-if="hasBuyerReview(reviewDialog.review)" class="rv-section">
          <div class="reviewer-row">
            <el-avatar :size="32" :src="reviewDialog.review.reviewerAvatar">
              {{ (reviewDialog.review.reviewerNickname || 'U').slice(0, 1).toUpperCase() }}
            </el-avatar>
            <span class="reviewer-name">{{ reviewDialog.review.reviewerNickname }}</span>
            <span class="reviewer-stars">
              <el-icon v-for="i in 5" :key="i" :color="i <= reviewDialog.review.rating ? '#ffb300' : '#e4e7ed'">
                <StarFilled />
              </el-icon>
            </span>
            <span class="reviewer-time">{{ (reviewDialog.review.createTime || '').slice(0, 10) }}</span>
          </div>
          <!-- 评价内容：被管理员删除则置灰提示 -->
          <div
            v-if="isReviewContentRemoved(reviewDialog.review)"
            class="review-content review-content-removed"
          >
            [此评价内容已被管理员删除]
          </div>
          <div v-else class="review-content">{{ reviewDialog.review.content }}</div>
          <div
            v-if="!isReviewContentRemoved(reviewDialog.review) && reviewDialog.review.images?.length"
            class="review-imgs"
          >
            <div
              v-for="(img, idx) in reviewDialog.review.images"
              :key="idx"
              class="review-img"
              :style="{ backgroundImage: `url(${img})` }"
            ></div>
          </div>

          <!-- 卖家回复区 -->
          <template v-if="reviewDialog.review.reply">
            <div v-if="isReplyContentRemoved(reviewDialog.review)" class="reply-block reply-removed">
              <div class="reply-tag">卖家回复</div>
              <div class="reply-text reply-text-removed">[此回复内容已被管理员删除]</div>
            </div>
            <div v-else class="reply-block reply-done">
              <div class="reply-tag">卖家回复</div>
              <div class="reply-text">{{ reviewDialog.review.reply.content }}</div>
              <div class="reply-time">{{ (reviewDialog.review.reply.createTime || '').slice(0, 16) }}</div>
            </div>
          </template>

          <!-- 卖家待回复：回复输入框 -->
          <div v-else-if="reviewDialog.canReply" class="reply-block reply-form">
            <el-input
              v-model="reviewDialog.replyText"
              type="textarea"
              :rows="3"
              :maxlength="500"
              show-word-limit
              placeholder="感谢亲的留言！"
            />
            <div class="reply-actions">
              <el-button type="primary" size="small" @click="submitReply">回复</el-button>
            </div>
          </div>
        </section>

        <!-- ============== 卖家→买家评价（仅当 sellerRating 非空时展示）============== -->
        <section v-if="hasSellerRating(reviewDialog.review)" class="rv-section rv-section-seller">
          <div class="section-tag section-tag-seller">{{ sellerRatingSectionTag }}</div>
          <div class="reviewer-row">
            <el-avatar :size="32">
              {{ (reviewDialog.order?.buyerNickname || '买').slice(0, 1) }}
            </el-avatar>
            <span class="reviewer-name">{{ reviewDialog.order?.buyerNickname || '买家' }}</span>
            <span class="reviewer-stars">
              <el-icon v-for="i in 5" :key="i" :color="i <= reviewDialog.review.sellerRating ? '#ffb300' : '#e4e7ed'">
                <StarFilled />
              </el-icon>
            </span>
            <span class="reviewer-time">{{ (reviewDialog.review.sellerRatingTime || '').slice(0, 10) }}</span>
          </div>
          <div class="review-content seller-rating-content">
            {{ reviewDialog.review.sellerRatingContent || '(仅打分)' }}
          </div>
        </section>

        <!-- 举报与仲裁结果展示区（双方都能看到全部举报 + 管理员裁决）-->
        <div v-if="reviewReports.length" class="review-reports">
          <div class="review-reports-title">
            <el-icon :size="14"><Warning /></el-icon>
            举报与仲裁记录
          </div>
          <div
            v-for="rep in reviewReports"
            :key="rep.id"
            class="review-report-item"
            :class="{
              'report-pending': rep.status === 0,
              'report-kept': rep.status === 1,
              'report-deleted': rep.status === 2,
            }"
          >
            <!-- 头部：举报人（匿名化） + 目标 + 状态 -->
            <div class="report-head">
              <span class="report-actor">
                <!--
                  隐私策略：评价作者可看到"我这条评价被举报了"，但不应知道是谁举报的。
                  后端 listByReview 对普通用户视角下统一清空 reporterNickname / reporterRole，
                  前端这里固定显示"举报人"，不再渲染昵称。
                -->
                <span class="report-actor-name">举报人</span>
              </span>
              <el-tag
                :type="rep.targetType === 1 ? 'primary' : 'warning'"
                size="small"
                effect="light"
              >{{ reportTargetText(rep.targetType) }}</el-tag>
              <el-tag :type="reportStatusTagType(rep.status)" size="small" effect="plain">
                {{ reportStatusText(rep.status) }}
              </el-tag>
            </div>
            <!-- 举报原因 + 补充说明 -->
            <div class="report-reason">举报原因：{{ rep.reason }}</div>
            <div v-if="rep.description" class="report-desc">补充说明：{{ rep.description }}</div>
            <div class="report-time">提交时间：{{ (rep.createTime || '').slice(0, 16) }}</div>

            <!-- 管理员仲裁结果（status != 0 时）-->
            <div v-if="rep.status !== 0" class="report-arbitration">
              <div class="arbitration-line">
                <el-tag
                  :type="rep.status === 1 ? 'info' : 'danger'"
                  size="small"
                  effect="plain"
                >
                  管理员裁决：{{ rep.status === 1 ? '保留（驳回举报）' : '删除违规内容' }}
                </el-tag>
                <span v-if="rep.auditTime" class="arbitration-time">
                  {{ (rep.auditTime || '').slice(0, 16) }}
                </span>
              </div>
              <div v-if="rep.auditAdminNickname" class="arbitration-by">
                裁决人：{{ rep.auditAdminNickname }}
              </div>
              <div v-if="rep.auditRemark" class="arbitration-remark">
                <span class="arbitration-remark-label">裁决理由</span>
                <span class="arbitration-remark-text">{{ rep.auditRemark }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 举报按钮：仅在有买家评价内容可被举报时显示（卖家侧评价内容暂不接入举报流程）-->
        <div
          v-if="hasBuyerReview(reviewDialog.review) && reportTargetForViewer(reviewDialog.review).length"
          class="review-actions-row"
        >
          <span class="review-actions-label">对内容有异议？</span>
          <el-button
            v-for="t in reportTargetForViewer(reviewDialog.review)"
            :key="t.key"
            :type="t.alreadyDone ? 'info' : 'danger'"
            :plain="true"
            size="small"
            round
            :disabled="t.disabled"
            @click="openReportDialog(t)"
          >{{ t.label }}{{ t.alreadyDone ? '（已提交）' : '' }}</el-button>
        </div>
      </template>
      <template v-else class="empty-tip">该订单暂无评价</template>
    </el-dialog>

    <!-- 卖家评价买家弹窗（v4 升级：独立于 review-dialog）-->
    <el-dialog
      v-model="sellerRatingDialog.visible"
      :title="sellerRatingDialog.order ? `评价买家 · ${sellerRatingDialog.order.goodsTitle}` : '评价买家'"
      width="460px"
      align-center
      :show-close="true"
      :close-on-click-modal="false"
    >
      <div v-if="sellerRatingDialog.order" class="rate-buyer-form">
        <div class="rate-buyer-tip">
          卖家给买家打分无需等待买家先评，提交后会即时展示在商品详情页的双重口碑里。
        </div>
        <div class="info-row">
          <span class="label">订单号</span>
          <span class="value">{{ sellerRatingDialog.order.orderNo }}</span>
        </div>
        <div class="info-row">
          <span class="label">买家</span>
          <span class="value">{{ sellerRatingDialog.order.buyerNickname }}</span>
        </div>
        <div class="info-row" style="align-items: center;">
          <span class="label">打分<span class="required">*</span></span>
          <el-rate
            v-model="sellerRatingDialog.rating"
            :max="5"
            show-text
            :texts="['失望', '不满', '一般', '满意', '超赞']"
          />
        </div>
        <el-input
          v-model="sellerRatingDialog.content"
          type="textarea"
          :rows="3"
          :maxlength="500"
          show-word-limit
          placeholder="简单评价买家（选填，不超过 500 字）"
        />
      </div>
      <template #footer>
        <el-button @click="sellerRatingDialog.visible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="sellerRatingDialog.submitting"
          @click="submitSellerRating"
        >提交评价</el-button>
      </template>
    </el-dialog>

    <!-- 提交举报弹窗 -->
    <el-dialog
      v-model="reportDialog.visible"
      :title="reportDialog.targetLabel || '提交举报'"
      width="460px"
      align-center
      :close-on-click-modal="false"
    >
      <div class="report-form">
        <div class="report-form-tip">
          提交后将由管理员仲裁，裁决结果会展示给双方。请如实填写举报原因。
        </div>
        <div class="info-row">
          <span class="label">举报目标</span>
          <span class="value">
            <el-tag
              :type="reportDialog.targetType === 1 ? 'primary' : 'warning'"
              size="small"
              effect="light"
            >{{ reportTargetText(reportDialog.targetType) }}</el-tag>
          </span>
        </div>
        <div class="info-row">
          <span class="label">举报原因<span class="required">*</span></span>
        </div>
        <el-input
          v-model="reportDialog.reason"
          type="textarea"
          :rows="2"
          :maxlength="100"
          show-word-limit
          placeholder="请简要说明举报原因（必填，不超过 100 字）"
        />
        <div class="info-row" style="margin-top: 10px;">
          <span class="label">补充说明</span>
        </div>
        <el-input
          v-model="reportDialog.description"
          type="textarea"
          :rows="3"
          :maxlength="500"
          show-word-limit
          placeholder="可补充详细情况（选填）"
        />
      </div>
      <template #footer>
        <el-button @click="reportDialog.visible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="reportDialog.submitting"
          @click="submitReport"
        >提交举报</el-button>
      </template>
    </el-dialog>

    <!-- 卖家处理退款 -->
    <el-dialog
      v-model="refundAuditDialog.visible"
      title="处理退款申请"
      width="480px"
      :close-on-click-modal="false"
      align-center
    >
      <div v-if="refundAuditDialog.order" class="refund-audit-body">
        <div class="info-row">
          <span class="label">订单号</span>
          <span class="value">{{ refundAuditDialog.order.orderNo }}</span>
        </div>
        <div class="info-row">
          <span class="label">商品</span>
          <span class="value">{{ refundAuditDialog.order.goodsTitle }}</span>
        </div>
        <div class="info-row">
          <span class="label">买家</span>
          <span class="value">{{ refundAuditDialog.order.buyerNickname }}</span>
        </div>
        <div class="info-row" v-if="refundAuditDialog.refund">
          <span class="label">退款原因</span>
          <span class="value">{{ refundAuditDialog.refund.reason || '-' }}</span>
        </div>
        <div class="info-row" v-if="refundAuditDialog.refund?.description">
          <span class="label">补充说明</span>
          <span class="value">{{ refundAuditDialog.refund.description }}</span>
        </div>
        <div class="info-row">
          <span class="label">退款金额</span>
          <span class="value danger">¥{{ refundAuditDialog.order.totalAmount }}</span>
        </div>

        <el-divider />

        <el-radio-group v-model="refundAuditDialog.decision" class="decision-group">
          <el-radio-button value="approve">同意退款</el-radio-button>
          <el-radio-button value="reject">拒绝退款</el-radio-button>
        </el-radio-group>

        <el-input
          v-model="refundAuditDialog.remark"
          type="textarea"
          :rows="3"
          :maxlength="200"
          show-word-limit
          :placeholder="refundAuditDialog.decision === 'reject' ? '请填写拒绝理由（必填）' : '可填写备注（选填）'"
          style="margin-top: 14px"
        />
      </div>
      <template #footer>
        <el-button @click="refundAuditDialog.visible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="refundAuditDialog.submitting"
          @click="submitRefundAudit"
        >确认提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.refund-audit-body { font-size: 14px; }
.refund-audit-body .info-row {
  display: flex;
  padding: 8px 0;
  border-bottom: 1px dashed #f0f2f5;
}
.refund-audit-body .info-row .label {
  width: 80px;
  color: #888;
  flex-shrink: 0;
}
.refund-audit-body .info-row .value { flex: 1; color: #1f1f1f; word-break: break-all; }
.refund-audit-body .info-row .value.danger { color: #ff4d4f; font-weight: 600; }
.decision-group { display: flex; }
.decision-group :deep(.el-radio-button__inner) { width: 130px; }

.order-center-page { min-height: 100%; }

/* ===== role ===== */
.role-bar {
  display: flex;
  justify-content: center;
  margin-bottom: 18px;
}
.role-switch {
  display: inline-flex;
  background: #fff;
  border-radius: 999px;
  padding: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}
.role-pill {
  padding: 8px 28px;
  border-radius: 999px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}
.role-pill:hover { color: #ff6b35; }
.role-pill.active {
  background: #1f1f1f;
  color: #fff;
}

/* ===== status tabs ===== */
.status-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0 4px;
  margin-bottom: 16px;
  border-bottom: 1px solid #f0f2f5;
}
.tab {
  padding: 10px 16px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  position: relative;
  transition: color 0.2s;
  user-select: none;
}
.tab:hover { color: #ff6b35; }
.tab.active { color: #1f1f1f; font-weight: 600; }
.tab.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 16px;
  right: 16px;
  height: 2px;
  background: linear-gradient(90deg, #ff8c5a 0%, #ff6b35 100%);
  border-radius: 2px;
}

/* ===== search ===== */
.search-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border-radius: 999px;
  padding: 6px 6px 6px 16px;
  margin-bottom: 18px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  flex-wrap: wrap;
}
.search-input { flex: 1; min-width: 220px; }
.search-input :deep(.el-input__wrapper) { box-shadow: none !important; }
.search-bar .sort-label {
  font-size: 13px;
  color: #555;
  font-weight: 500;
  white-space: nowrap;
}
.search-btn {
  border-radius: 999px !important;
  background: #1f1f1f !important;
  border-color: #1f1f1f !important;
}

/* ===== order cards ===== */
.order-list { display: flex; flex-direction: column; gap: 14px; }
.order-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px 22px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.2s;
}
.order-card:hover { box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); }
.order-card.order-focus {
  box-shadow: 0 0 0 2px #ff8c5a, 0 4px 16px rgba(255, 107, 53, 0.18);
}

.order-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px dashed #f0f2f5;
  margin-bottom: 14px;
}
.order-head-right {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.order-no {
  font-size: 12px;
  color: #999;
}
.countdown {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #ff6b35;
  background: #fff5f0;
  border: 1px solid #ffd5b8;
  border-radius: 999px;
  padding: 2px 10px;
  line-height: 1.4;
}
.countdown-time {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.5px;
}
.countdown-expired {
  color: #999;
  background: #f5f5f5;
  border-color: #e4e7ed;
}

/* 剩余退款次数徽标：买家视角下单头右侧醒目展示 */
.refund-quota {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  color: #ff6b35;
  background: #fff5f0;
  border: 1px solid #ffd5b8;
  border-radius: 999px;
  padding: 2px 10px;
  line-height: 1.4;
  font-weight: 500;
  white-space: nowrap;
}
.refund-quota-empty {
  color: #999;
  background: #f5f5f5;
  border-color: #e4e7ed;
  font-weight: 400;
}

.order-body {
  display: grid;
  grid-template-columns: 80px 1fr auto auto;
  gap: 14px;
  align-items: center;
}
/* 图片区域：只有这块点击才跳商品详情（避免订单详情/按钮误触发） */
.order-cover-wrap {
  width: 80px;
  height: 80px;
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  transition: opacity 0.15s;
}
.order-cover-wrap:hover { opacity: 0.85; }
.order-cover-wrap:active { opacity: 0.7; }
.order-cover {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  object-fit: cover;
  background: #f5f7fa;
  display: block;
}
.order-cover-empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.order-main { min-width: 0; }
.order-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f1f1f;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.order-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #888;
  margin-bottom: 6px;
}
.seller-tag {
  background: #f5f7fa;
  padding: 1px 6px;
  border-radius: 4px;
}
.meta-dot { margin: 0 4px; color: #ccc; }
.order-times {
  font-size: 11px;
  color: #aaa;
  display: flex;
  gap: 10px;
}
/* 订单详情：买家备注 / 收货方式 / 收货地址 / 运费 */
.order-extra {
  margin-top: 8px;
  padding: 8px 10px;
  background: #fafbfc;
  border-radius: 6px;
  font-size: 12px;
  color: #555;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.extra-line { display: flex; gap: 6px; align-items: baseline; line-height: 1.5; }
.extra-label { color: #999; flex-shrink: 0; }
.extra-value { color: #1f1f1f; word-break: break-word; }
.extra-value-address { line-height: 1.5; }
.refund-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  margin-top: 6px;
  line-height: 1.4;
}
.refund-hint-info {
  color: #f59e0b;
  background: #fff7e6;
  border: 1px solid #ffe7ba;
}
.refund-hint-warn {
  color: #ef4444;
  background: #fef0f0;
  border: 1px solid #fbc4c4;
}
.refund-hint-urgent {
  color: #ef4444;
  background: #fff1f0;
  border: 1px solid #ffa39e;
  animation: refundPulse 1.6s ease-in-out infinite;
}
.refund-countdown-time {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.5px;
  margin-left: 2px;
}
@keyframes refundPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

/* 退款最终裁决结果块：stage=2 时展示给买家和卖家 */
.refund-result {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
  background: #fafbfc;
  max-width: 540px;
}
.refund-result-success {
  background: #f0fff4;
  border-color: #b7eb8f;
}
.refund-result-danger {
  background: #fff1f0;
  border-color: #ffa39e;
}
.refund-result-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
}
.refund-result-actor {
  color: #1f1f1f;
  font-weight: 600;
}
.refund-result-time {
  color: #aaa;
  font-size: 11px;
  margin-left: auto;
}
.refund-result-verdict {
  font-size: 12px;
  color: #555;
  line-height: 1.6;
}
.refund-result-remark {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 12px;
  line-height: 1.6;
}
.refund-result-remark-label {
  flex-shrink: 0;
  color: #888;
  font-weight: 500;
}
.refund-result-remark-text {
  color: #1f1f1f;
  white-space: pre-wrap;
  word-break: break-all;
}

.order-price {
  text-align: right;
  font-weight: 600;
}
.order-price .price { color: #ff6b35; font-size: 18px; }
.order-price .qty { font-size: 12px; color: #888; margin-top: 2px; }

.order-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 110px;
}
/* 让 el-tooltip 包裹的 el-button 在 column flex 里独占一行并撑满宽度 */
.order-actions :deep(.el-tooltip) {
  display: block;
  width: 100%;
}
.action-btn {
  width: 100% !important;
  margin-left: 0 !important;
}

/* ===== 分页 ===== */
.pagination {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-top: 20px;
  gap: 16px;
}
.total { font-size: 13px; color: #666; }
.pagination :deep(.el-pager li.is-active) {
  background: linear-gradient(135deg, #ff8c5a 0%, #ff6b35 100%) !important;
  color: #fff !important;
}

/* ===== 支付弹窗 ===== */
.pay-list { display: flex; flex-direction: column; gap: 10px; }
.pay-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border: 1.5px solid #e4e7ed;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.pay-item:hover { border-color: #ff8c5a; }
.pay-item.active {
  border-color: #ff6b35;
  background: linear-gradient(135deg, #fff5f0 0%, #ffe8db 100%);
}
.pay-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  flex-shrink: 0;
}
.pay-icon-wechat { background: #07c160; }
.pay-icon-alipay { background: #1677ff; }
.pay-label { flex: 1; font-size: 14px; color: #1f1f1f; }
.pay-check {
  position: absolute;
  right: 14px;
  color: #ff6b35;
  font-weight: 600;
}

/* ===== 评价弹窗 ===== */
.loading-inline { text-align: center; color: #999; padding: 30px 0; }
.empty-tip { color: #999; text-align: center; padding: 20px 0; }

.reviewer-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.reviewer-name { font-weight: 600; color: #1f1f1f; }
.reviewer-stars { display: inline-flex; gap: 2px; margin-left: 4px; }
.reviewer-stars :deep(.el-icon) { font-size: 16px; }

.review-content {
  font-size: 14px;
  line-height: 1.7;
  color: #555;
  margin-bottom: 12px;
  padding: 10px 14px;
  background: #fafbfc;
  border-radius: 8px;
}

/* ===== v4 升级：评价弹窗双区展示 ===== */
/* 双方各占一块 section，section 间隔 14px，
   顶部一个橙色 tag 区分"我对买家的评价" */
.rv-section { margin-bottom: 14px; }
.rv-section:last-of-type { margin-bottom: 0; }
.rv-section-seller {
  margin-top: 6px;
  padding-top: 14px;
  border-top: 1px dashed #f0f2f5;
}
.section-tag {
  display: inline-block;
  padding: 1px 8px;
  font-size: 11px;
  border-radius: 4px;
  margin-bottom: 8px;
  font-weight: 500;
}
.section-tag-seller {
  background: #fff5f0;
  color: #ff6b35;
  border: 1px solid #ffd5b8;
}
/* 卖家的评价内容用更浅一点的橙底，与买家评价形成视觉差 */
.seller-rating-content {
  background: linear-gradient(135deg, #fff5f0 0%, #ffe8db 100%);
  border: 1px solid #ffd5b8;
}
/* reviewer-row 末尾追加了一个时间戳（评价日期），靠右 */
.reviewer-time {
  margin-left: auto;
  font-size: 11px;
  color: #999;
}
.review-imgs { display: flex; gap: 6px; margin-bottom: 14px; }
.review-img {
  width: 56px;
  height: 56px;
  border-radius: 6px;
  background-color: #f0f2f5;
  background-size: cover;
  background-position: center;
}

.reply-block {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 8px;
  background: #fafbfc;
}
.reply-done { border-left: 3px solid #ff6b35; }
.reply-tag {
  display: inline-block;
  padding: 1px 8px;
  background: linear-gradient(135deg, #ff8c5a 0%, #ff6b35 100%);
  color: #fff;
  font-size: 11px;
  border-radius: 4px;
  margin-bottom: 8px;
}
.reply-text {
  font-size: 13px;
  color: #555;
  line-height: 1.7;
  margin-bottom: 6px;
  white-space: pre-wrap;
}
.reply-time { font-size: 11px; color: #aaa; }
.reply-form { background: #fff; border: 1px solid #e4e7ed; }
.reply-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

/* ===== 评价被管理员删除（置灰）===== */
.review-content-removed,
.reply-text-removed {
  color: #aaa;
  font-style: italic;
  background: #f5f5f5 !important;
  border: 1px dashed #d9d9d9;
}
.reply-removed { background: #fafafa; border-left: 3px dashed #d9d9d9; }

/* ===== 举报与仲裁记录 ===== */
.review-reports {
  margin-top: 14px;
  padding: 10px 12px;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 8px;
}
.review-reports-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #ad6800;
  margin-bottom: 8px;
}
.review-report-item {
  background: #fff;
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 8px;
  border: 1px solid #f0f2f5;
  font-size: 12px;
  line-height: 1.6;
}
.review-report-item:last-child { margin-bottom: 0; }
.report-pending { border-left: 3px solid #f59e0b; }
.report-kept { border-left: 3px solid #3b82f6; }
.report-deleted { border-left: 3px solid #ef4444; }
.report-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}
.report-actor {
  color: #555;
  font-weight: 500;
}
.report-actor-name {
  color: #1f1f1f;
  font-weight: 600;
  margin-left: 2px;
}
.report-reason {
  color: #1f1f1f;
  word-break: break-all;
}
.report-desc {
  color: #888;
  word-break: break-all;
}
.report-time {
  color: #aaa;
  font-size: 11px;
  margin-top: 2px;
}
.report-arbitration {
  margin-top: 8px;
  padding: 8px 10px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.6;
}
.arbitration-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.arbitration-time {
  color: #aaa;
  font-size: 11px;
  margin-left: auto;
}
.arbitration-by {
  font-size: 11px;
  color: #888;
  margin-top: 2px;
}
.arbitration-remark {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  margin-top: 6px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 4px;
  padding: 6px 8px;
}
.arbitration-remark-label {
  flex-shrink: 0;
  color: #888;
  font-weight: 500;
}
.arbitration-remark-text {
  color: #1f1f1f;
  white-space: pre-wrap;
  word-break: break-all;
}

/* ===== 举报按钮行 ===== */
.review-actions-row {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed #f0f2f5;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
}
.review-actions-label { color: #888; }

/* ===== 提交举报弹窗 ===== */
.report-form { font-size: 14px; }
.report-form-tip {
  font-size: 12px;
  color: #ad6800;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 4px;
  padding: 8px 10px;
  margin-bottom: 14px;
  line-height: 1.6;
}
.report-form .info-row {
  display: flex;
  align-items: center;
  padding: 4px 0;
  font-size: 13px;
}
.report-form .info-row .label {
  width: 80px;
  color: #555;
  flex-shrink: 0;
}
.report-form .info-row .value { flex: 1; color: #1f1f1f; }
.report-form .required { color: #ff4d4f; margin-left: 2px; }

/* ===== 卖家评价买家弹窗 ===== */
.rate-buyer-form { font-size: 14px; }
.rate-buyer-tip {
  font-size: 12px;
  color: #ad6800;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 4px;
  padding: 8px 10px;
  margin-bottom: 14px;
  line-height: 1.6;
}
.rate-buyer-form .info-row {
  display: flex;
  align-items: center;
  padding: 6px 0;
  font-size: 13px;
}
.rate-buyer-form .info-row .label {
  width: 64px;
  color: #888;
  flex-shrink: 0;
}
.rate-buyer-form .info-row .value {
  flex: 1;
  color: #1f1f1f;
  word-break: break-all;
}
.rate-buyer-form .required { color: #ff4d4f; margin-left: 2px; }
</style>