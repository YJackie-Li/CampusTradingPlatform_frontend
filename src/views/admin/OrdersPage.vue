<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Refresh, Box } from '@element-plus/icons-vue'
import PageFilterBar from '@/views/admin/components/PageFilterBar.vue'
import {
  ORDER_STATUS,
  orderStatusText,
  orderStatusTagType,
} from '@/api/orders'
import {
  getAdminOrderPage,
  getAdminOrder,
  getAdminOrderRefund,
  getAdminOrderReview,
} from '@/api/adminOrders'

// ===== filters =====
// timeRange: el-date-picker daterange 数组 [Date|null, Date|null]
// status: '' = 全部(后端 null), 0~6 = 各状态。fetch 时再换算
const filters = reactive({
  keyword: '',
  status: '',
  timeRange: [],
  pageNum: 1,
  pageSize: 20,
})

// 喂给 PageFilterBar 的字段。日期区间自己单独放一行
const fields = [
  { key: 'keyword', label: '关键字', type: 'input', placeholder: '订单号 / 商品名 / 买家昵称 / 卖家昵称', width: '280px' },
  {
    key: 'status', label: '订单状态', type: 'select', width: '180px',
    options: [
      { value: '', label: '全部' },
      { value: 0, label: orderStatusText(ORDER_STATUS.PENDING_PAY) },
      { value: 1, label: orderStatusText(ORDER_STATUS.PENDING_DELIVER) },
      { value: 2, label: orderStatusText(ORDER_STATUS.PENDING_RECEIVE) },
      { value: 3, label: orderStatusText(ORDER_STATUS.DONE) },
      { value: 4, label: orderStatusText(ORDER_STATUS.CANCELED) },
      { value: 5, label: orderStatusText(ORDER_STATUS.REFUNDING) },
      { value: 6, label: orderStatusText(ORDER_STATUS.REFUNDED) },
    ],
  },
]

const loading = ref(false)
const list = ref([])
const total = ref(0)

// ===== fetch =====
const fetchList = async () => {
  loading.value = true
  try {
    const [start, end] = filters.timeRange || []
    // 后端 LocalDateTime 需要 yyyy-MM-dd HH:mm:ss；el-date-picker value-format 已经给出
    const params = {
      keyword: (filters.keyword || '').trim() || undefined,
      // status 是 '' 时不传（后端 eq 比较会失效，必须 nullish 才跳过）
      status: (filters.status === '' || filters.status == null) ? undefined : filters.status,
      startTime: start || undefined,
      endTime: end || undefined,
      pageNum: filters.pageNum,
      pageSize: filters.pageSize,
    }
    const res = await getAdminOrderPage(params)
    list.value = res.records || []
    total.value = res.total || 0
  } finally {
    loading.value = false
  }
}

onMounted(fetchList)

const handleSearch = () => {
  filters.pageNum = 1
  fetchList()
}
const handleReset = () => {
  // PageFilterBar 自己已经把 input/select reset 成空字符串；
  // 这里的 timeRange 不在 PageFilterBar 里，需手动清
  filters.timeRange = []
  filters.pageNum = 1
  fetchList()
}
const handleRefresh = () => {
  fetchList()
}
const handlePageChange = (p) => {
  filters.pageNum = p
  fetchList()
}
const handleSizeChange = (s) => {
  filters.pageSize = s
  filters.pageNum = 1
  fetchList()
}

// ===== format helpers =====
const short = (s) => (s ? String(s).slice(0, 16).replace('T', ' ') : '-')
const tradeLabel = (m) => ({ FACE_TO_FACE: '面交', EXPRESS: '邮递', BOTH: '面交/邮递' }[m] || '-')
const payLabel = (m) => ({ ALIPAY: '支付宝', WECHAT: '微信', BALANCE: '余额' }[m] || '未支付')
const refundStageText = (s) => ({ 0: '待卖家处理', 1: '待管理员仲裁', 2: '已结束' }[s] || '-')
const refundStageTag = (s) => ({ 0: 'warning', 1: 'danger', 2: 'info' }[s] || 'info')
const refundStatusText = (s) => ({ 0: '待处理', 1: '同意', 2: '拒绝' }[s] || '-')
const refundStatusTag = (s) => ({ 1: 'success', 2: 'danger' }[s] || 'info')

// 列表行在退款中或已退款时，给状态徽章旁再加一个退款阶段
const refundBadge = (row) => {
  if (row.status !== 5 && row.status !== 6) return null
  return row.refundStage != null
    ? { text: refundStageText(row.refundStage), type: refundStageTag(row.refundStage) }
    : null
}

// ===== 详情对话框 =====
// detailDialog 内三个字段：order / refund / review。任意一项拉取失败仅 toast，不阻止打开
const detailDialog = reactive({
  visible: false,
  loading: false,
  orderId: null,
  order: null,
  refund: null,
  review: null,
})

const openDetail = async (row) => {
  detailDialog.visible = true
  detailDialog.orderId = row.id
  detailDialog.order = null
  detailDialog.refund = null
  detailDialog.review = null
  detailDialog.loading = true
  // 并发拉 3 个接口，任一失败不影响其它展示（http.js 拦截器已 toast）
  const tasks = [
    getAdminOrder(row.id).then((d) => (detailDialog.order = d)).catch((e) => console.warn('订单详情拉取失败', e)),
    getAdminOrderRefund(row.id).then((d) => (detailDialog.refund = d)).catch((e) => console.warn('退款拉取失败', e)),
    getAdminOrderReview(row.id).then((d) => (detailDialog.review = d)).catch((e) => console.warn('评价拉取失败', e)),
  ]
  await Promise.all(tasks)
  detailDialog.loading = false
}
const closeDetail = () => {
  detailDialog.visible = false
  detailDialog.order = null
  detailDialog.refund = null
  detailDialog.review = null
  detailDialog.orderId = null
}

// 详情对话框内部使用：是否已触发某状态节点
const dOrder = computed(() => detailDialog.order)

const timelineNodes = computed(() => {
  const o = dOrder.value
  if (!o) return []
  const nodes = [
    { label: '下单', time: o.createTime, dot: 'primary' },
    { label: '付款', time: o.payTime, dot: 'success' },
    { label: '发货', time: o.deliverTime, dot: 'success' },
    { label: '收货', time: o.receiveTime, dot: 'success' },
  ]
  if (o.cancelTime && o.status === 4) {
    nodes.push({ label: '已取消', time: o.cancelTime, dot: 'info' })
  } else if (o.finishTime && o.status === 3) {
    nodes.push({ label: '订单完成', time: o.finishTime, dot: 'success' })
  } else if (o.status === 5 && o.refundStage != null) {
    nodes.push({ label: refundStageText(o.refundStage), time: o.refundAuditTime || o.payTime, dot: 'warning' })
  } else if (o.status === 6) {
    nodes.push({ label: '已退款', time: o.refundAuditTime, dot: 'info' })
  }
  return nodes.filter((n) => n.time)
})
</script>

<template>
  <div class="orders-page" v-loading="loading">
    <div class="page-title">
      <h2>订单管理</h2>
      <div class="title-actions">
        <el-button :icon="Refresh" size="small" @click="handleRefresh">刷新</el-button>
      </div>
    </div>

    <!-- 过滤区：PageFilterBar + 下单时间区间（PageFilterBar 不内建 daterange，单独放一行） -->
    <PageFilterBar v-model="filters" :fields="fields" @search="handleSearch" @reset="handleReset">
      <template #extra>
        <el-button :icon="Refresh" @click="handleRefresh">刷新</el-button>
      </template>
    </PageFilterBar>

    <div class="time-row">
      <div class="time-label">下单时间</div>
      <el-date-picker
        v-model="filters.timeRange"
        type="datetimerange"
        range-separator="至"
        start-placeholder="开始时间"
        end-placeholder="结束时间"
        value-format="YYYY-MM-DD HH:mm:ss"
        format="YYYY-MM-DD HH:mm"
        :style="{ width: '440px' }"
      />
      <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
    </div>

    <!-- 表格 -->
    <div class="data-card">
      <el-table :data="list" stripe class="orders-table" empty-text="暂无订单">
        <el-table-column label="订单" min-width="240">
          <template #default="{ row }">
            <div class="order-cell" @click="openDetail(row)">
              <img v-if="row.goodsCover" :src="row.goodsCover" class="cover" />
              <div v-else class="cover cover-empty">
                <el-icon :size="18" color="#ccc"><Box /></el-icon>
              </div>
              <div class="order-info">
                <div class="order-title">{{ row.goodsTitle || '-' }}</div>
                <div class="order-no">{{ row.orderNo }}</div>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="买家" width="120">
          <template #default="{ row }">
            <span>{{ row.buyerNickname || '-' }}</span>
          </template>
        </el-table-column>

        <el-table-column label="卖家" width="120">
          <template #default="{ row }">
            <span>{{ row.sellerNickname || '-' }}</span>
          </template>
        </el-table-column>

        <el-table-column label="金额" width="110">
          <template #default="{ row }">
            <span class="amount">¥{{ row.totalAmount }}</span>
          </template>
        </el-table-column>

        <el-table-column label="交易方式" width="100">
          <template #default="{ row }">
            <el-tag size="small" type="info" effect="plain">{{ tradeLabel(row.tradeMethod) }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column label="支付方式" width="100">
          <template #default="{ row }">
            <span class="muted">{{ payLabel(row.payMethod) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="170">
          <template #default="{ row }">
            <el-tag :type="orderStatusTagType(row.status)" size="small" effect="light">
              {{ orderStatusText(row.status) }}
            </el-tag>
            <el-tag
              v-if="refundBadge(row)"
              :type="refundBadge(row).type"
              size="small"
              effect="plain"
              style="margin-left: 4px;"
            >
              {{ refundBadge(row).text }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="下单时间" width="150">
          <template #default="{ row }">
            <span class="time">{{ short(row.createTime) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openDetail(row)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 分页 -->
    <div v-if="total > 0" class="pagination">
      <span class="total">共 {{ total }} 条</span>
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

    <el-empty
      v-if="!loading && list.length === 0"
      description="暂无订单记录"
      :image-size="100"
      style="margin-top: 40px;"
    />

    <!-- ============= 详情对话框 ============= -->
    <el-dialog
      v-model="detailDialog.visible"
      title="订单详情"
      width="780px"
      align-center
      :close-on-click-modal="false"
      @close="closeDetail"
    >
      <div v-loading="detailDialog.loading" class="detail-body">
        <!-- 订单不存在 -->
        <el-empty
          v-if="!detailDialog.loading && !dOrder"
          description="未找到订单"
          :image-size="80"
        />

        <!-- ===== 基本信息 ===== -->
        <template v-if="dOrder">
          <div class="section-card">
            <div class="section-title">基本信息</div>
            <div class="info-grid">
              <div class="info-row">
                <span class="label">订单号</span>
                <span class="value">{{ dOrder.orderNo }}</span>
              </div>
              <div class="info-row">
                <span class="label">买家</span>
                <span class="value">{{ dOrder.buyerNickname }} <span class="muted-inline">(ID: {{ dOrder.buyerId }})</span></span>
              </div>
              <div class="info-row">
                <span class="label">卖家</span>
                <span class="value">{{ dOrder.sellerNickname }} <span class="muted-inline">(ID: {{ dOrder.sellerId }})</span></span>
              </div>
              <div class="info-row info-full">
                <span class="label">商品</span>
                <span class="value">
                  <span class="goods-inline">
                    <img v-if="dOrder.goodsCover" :src="dOrder.goodsCover" class="cover-mini" />
                    <span>{{ dOrder.goodsTitle }}</span>
                  </span>
                </span>
              </div>
              <div class="info-row">
                <span class="label">单价 × 数量</span>
                <span class="value">¥{{ dOrder.price }} × {{ dOrder.quantity }}</span>
              </div>
              <div class="info-row">
                <span class="label">运费 / 实付</span>
                <span class="value">¥{{ dOrder.freight }} / <span class="amount">¥{{ dOrder.totalAmount }}</span></span>
              </div>
              <div class="info-row">
                <span class="label">交易方式</span>
                <span class="value">{{ tradeLabel(dOrder.tradeMethod) }}</span>
              </div>
              <div class="info-row">
                <span class="label">支付方式</span>
                <span class="value">{{ payLabel(dOrder.payMethod) }}</span>
              </div>
              <div class="info-row info-full" v-if="dOrder.addressText">
                <span class="label">收货地址</span>
                <span class="value">{{ dOrder.addressText }}</span>
              </div>
              <div class="info-row info-full" v-if="dOrder.remark">
                <span class="label">买家留言</span>
                <span class="value">{{ dOrder.remark }}</span>
              </div>
              <div class="info-row">
                <span class="label">状态</span>
                <span class="value">
                  <el-tag :type="orderStatusTagType(dOrder.status)" size="small" effect="light">
                    {{ orderStatusText(dOrder.status) }}
                  </el-tag>
                  <el-tag
                    v-if="(dOrder.status === 5 || dOrder.status === 6) && dOrder.refundStage != null"
                    :type="refundStageTag(dOrder.refundStage)"
                    size="small"
                    effect="plain"
                    style="margin-left: 6px;"
                  >
                    {{ refundStageText(dOrder.refundStage) }}
                  </el-tag>
                </span>
              </div>
              <div class="info-row" v-if="dOrder.expireTime">
                <span class="label">支付截止</span>
                <span class="value muted-inline">{{ short(dOrder.expireTime) }}</span>
              </div>
            </div>
          </div>

          <!-- ===== 状态时间线 ===== -->
          <div class="section-card">
            <div class="section-title">状态时间线</div>
            <el-timeline v-if="timelineNodes.length > 0">
              <el-timeline-item
                v-for="(n, i) in timelineNodes"
                :key="i"
                :timestamp="short(n.time)"
                :type="n.dot"
                size="normal"
              >
                {{ n.label }}
              </el-timeline-item>
            </el-timeline>
            <div v-else class="muted">暂无时间线节点</div>
          </div>

          <!-- ===== 退款信息 ===== -->
          <div v-if="detailDialog.refund || (dOrder.refundStage != null)" class="section-card">
            <div class="section-title">退款信息</div>
            <div v-if="detailDialog.refund">
              <div class="info-row">
                <span class="label">阶段</span>
                <span class="value">
                  <el-tag :type="refundStageTag(detailDialog.refund.stage)" size="small" effect="light">
                    {{ refundStageText(detailDialog.refund.stage) }}
                  </el-tag>
                  <el-tag
                    v-if="detailDialog.refund.stage === 2"
                    :type="refundStatusTag(detailDialog.refund.status)"
                    size="small"
                    effect="plain"
                    style="margin-left: 6px;"
                  >
                    {{ refundStatusText(detailDialog.refund.status) }}
                  </el-tag>
                </span>
              </div>
              <div class="detail-block">
                <div class="block-label">买家退款原因</div>
                <div class="block-content">{{ detailDialog.refund.reason || '-' }}</div>
              </div>
              <div v-if="detailDialog.refund.description" class="detail-block">
                <div class="block-label">补充说明</div>
                <div class="block-content">{{ detailDialog.refund.description }}</div>
              </div>
              <div
                v-if="detailDialog.refund.stage === 2 && detailDialog.refund.auditRemark"
                class="detail-block"
              >
                <div class="block-label">
                  裁决备注
                  <span v-if="detailDialog.refund.auditTime" class="block-time">
                    {{ short(detailDialog.refund.auditTime) }}
                  </span>
                </div>
                <div
                  class="block-content"
                  :class="dOrder.refundAuditByRole === 'ADMIN' ? 'admin' : 'seller'"
                >
                  {{ detailDialog.refund.auditRemark }}
                </div>
              </div>
              <div class="info-row" v-if="dOrder.refundAuditByNickname">
                <span class="label">裁决人</span>
                <span class="value">
                  {{ dOrder.refundAuditByNickname }}
                  <el-tag
                    :type="dOrder.refundAuditByRole === 'ADMIN' ? 'danger' : 'warning'"
                    size="small"
                    effect="plain"
                    style="margin-left: 6px;"
                  >
                    {{ dOrder.refundAuditByRole === 'ADMIN' ? '管理员' : '卖家' }}
                  </el-tag>
                </span>
              </div>
            </div>
            <div v-else class="muted">该订单状态涉及退款，但暂无详细退款记录</div>
          </div>

          <!-- ===== 评价信息 ===== -->
          <div v-if="detailDialog.review" class="section-card">
            <div class="section-title">评价信息</div>

            <!-- 买家→卖家 -->
            <template v-if="detailDialog.review.rating != null">
              <div class="detail-block">
                <div class="block-label">
                  <span class="reviewer">买家 {{ detailDialog.review.reviewerNickname }}</span>
                  <span class="block-time">对卖家</span>
                  <el-rate
                    v-model="detailDialog.review.rating"
                    disabled
                    :max="5"
                    show-score
                    score-template="{value}"
                    style="margin-left: 8px;"
                  />
                </div>
                <div class="block-content">{{ detailDialog.review.content || '(仅评分，无内容)' }}</div>
                <!-- 卖家回复 -->
                <div v-if="detailDialog.review.replyContent" class="reply-cell">
                  <div class="reply-label">
                    卖家回复
                    <span v-if="detailDialog.review.replyTime" class="block-time">
                      {{ short(detailDialog.review.replyTime) }}
                    </span>
                  </div>
                  <div class="block-content seller">{{ detailDialog.review.replyContent }}</div>
                </div>
              </div>
            </template>

            <!-- 卖家→买家 -->
            <template v-if="detailDialog.review.sellerRating != null">
              <div class="detail-block">
                <div class="block-label">
                  <span class="reviewer">卖家 {{ detailDialog.review.sellerNickname }}</span>
                  <span class="block-time">对买家</span>
                  <el-rate
                    v-model="detailDialog.review.sellerRating"
                    disabled
                    :max="5"
                    show-score
                    score-template="{value}"
                    style="margin-left: 8px;"
                  />
                </div>
                <div class="block-content">{{ detailDialog.review.sellerRatingContent || '(仅评分，无内容)' }}</div>
              </div>
            </template>
          </div>
        </template>
      </div>
      <template #footer>
        <el-button @click="closeDetail">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.orders-page { min-height: 100%; }

.page-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.page-title h2 {
  font-size: 18px;
  font-weight: 600;
  color: #1f1f1f;
  margin: 0;
}

/* 时间筛选条：单独放在 PageFilterBar 下面 */
.time-row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fff;
  border-radius: 12px;
  padding: 14px 20px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}
.time-label {
  font-size: 13px;
  color: #666;
}

/* ===== 表格卡 ===== */
.data-card {
  background: #fff;
  border-radius: 12px;
  padding: 8px 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}
.orders-table :deep(.el-table__cell) { padding: 10px 0; }

.order-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}
.cover {
  width: 44px;
  height: 44px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
  background: #f5f7fa;
}
.cover-empty {
  display: flex;
  align-items: center;
  justify-content: center;
}
.order-info { min-width: 0; }
.order-title {
  font-size: 13px;
  color: #1f1f1f;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}
.order-no {
  font-size: 11px;
  color: #999;
  margin-top: 2px;
}

.amount {
  color: #ff6b35;
  font-weight: 600;
}
.muted { color: #aaa; font-size: 12px; }
.muted-inline { color: #888; font-size: 12px; font-weight: normal; }
.time { font-size: 12px; color: #666; }

/* ===== 分页 ===== */
.pagination {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-top: 18px;
  gap: 16px;
}
.total { font-size: 13px; color: #666; }
.pagination :deep(.el-pager li.is-active) {
  background: linear-gradient(135deg, #ff8c5a, #ff6b35) !important;
  color: #fff !important;
}

/* ===== 详情对话框 ===== */
.detail-body { font-size: 14px; }

/* 分区卡片 */
.section-card {
  background: #fafbfc;
  border: 1px solid #f0f2f5;
  border-radius: 8px;
  padding: 16px 18px;
  margin-top: 14px;
}
.section-card:first-child { margin-top: 0; }
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #1f1f1f;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eef0f3;
}

/* info-row 网格 */
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 24px;
}
.info-row {
  display: flex;
  padding: 6px 0;
  align-items: flex-start;
}
.info-row.info-full { grid-column: 1 / -1; }
.info-row .label {
  width: 92px;
  color: #888;
  flex-shrink: 0;
  font-size: 13px;
  padding-top: 2px;
}
.info-row .value {
  flex: 1;
  color: #1f1f1f;
  font-size: 13px;
  word-break: break-all;
}
.goods-inline {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.cover-mini {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  object-fit: cover;
  background: #f5f7fa;
}

/* ===== 弹窗里的卡片内容 ===== */
.detail-block { margin-top: 10px; }
.block-label {
  font-size: 12px;
  color: #888;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.block-label .reviewer {
  color: #1f1f1f;
  font-weight: 600;
}
.block-time {
  color: #bbb;
  font-size: 11px;
  font-weight: normal;
}
.block-content {
  font-size: 13px;
  color: #1f1f1f;
  line-height: 1.7;
  background: #fff;
  border: 1px solid #f0f2f5;
  border-radius: 6px;
  padding: 10px 12px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 220px;
  overflow-y: auto;
}
.block-content.seller {
  background: #fff7e6;
  border-color: #ffe7ba;
  color: #ad6800;
}
.block-content.admin {
  background: #f0f9ff;
  border-color: #bae0ff;
  color: #0050b3;
}

/* 卖家回复嵌套在买家评价里 */
.reply-cell { margin-top: 8px; }
.reply-label {
  font-size: 12px;
  color: #f59e0b;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 1100px) {
  .info-grid { grid-template-columns: 1fr; }
}
</style>
