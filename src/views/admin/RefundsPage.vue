<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Bell, ChatLineRound, Box, Van, StarFilled } from '@element-plus/icons-vue'
import {
  getAdminRefundPage,
  auditAdminRefund,
  getAdminRefundCounts,
  refundStageText,
  refundStageTagType,
  refundStatusText,
  refundStatusTagType,
  REFUND_STAGE,
} from '@/api/refunds'

const router = useRouter()

// ===== tabs =====
// - 0: 待卖家处理（管理员只看不操作）
// - 1: 待管理员仲裁（核心 tab，管理员在这里做最终裁决）
// - 2: 已结束（历史记录）
const activeTab = ref('1') // 默认落在「待管理员仲裁」
const tabOptions = [
  { key: '1', label: '待管理员仲裁', stage: 1, status: 0 },
  { key: '0', label: '待卖家处理', stage: 0, status: 0 },
  { key: 'done', label: '已结束', stage: 2, status: null },
]

// ===== 查询条件 =====
const filters = reactive({
  keyword: '',
  pageNum: 1,
  pageSize: 10,
})

const loading = ref(false)
const list = ref([])
const total = ref(0)
const counts = reactive({ pendingSeller: 0, pendingAdmin: 0, total: 0 })

const currentTab = computed(
  () => tabOptions.find((t) => t.key === activeTab.value) || tabOptions[0]
)

const fetchCounts = async () => {
  try {
    const c = await getAdminRefundCounts()
    Object.assign(counts, c)
  } catch (e) {
    // 计数失败不阻塞主流程
    console.warn('加载退款计数失败', e)
  }
}

const fetchList = async () => {
  loading.value = true
  try {
    const tab = currentTab.value
    const res = await getAdminRefundPage({
      stage: tab.stage,
      status: tab.status,
      pageNum: filters.pageNum,
      pageSize: filters.pageSize,
    })
    list.value = res.records
    total.value = res.total
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchCounts()
  fetchList()
})

watch(activeTab, () => {
  filters.pageNum = 1
  fetchList()
})

const handleSearch = () => {
  filters.pageNum = 1
  fetchList()
}
const handleRefresh = () => {
  fetchCounts()
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

// 卖家剩余处理时间（仅 stage=0 显示）
const sellerRemainingHours = (row) => {
  if (row.stage !== 0 || !row.sellerDeadline) return null
  const ms = new Date(row.sellerDeadline).getTime() - Date.now()
  if (ms <= 0) return 0
  return Math.floor(ms / 3600000)
}

// ===== 管理员仲裁弹窗 =====
const auditDialog = reactive({
  visible: false,
  refund: null,
  decision: 'approve', // 'approve' | 'reject'
  remark: '',
  submitting: false,
})
const openAuditDialog = (row) => {
  auditDialog.refund = row
  auditDialog.decision = 'approve'
  auditDialog.remark = ''
  auditDialog.visible = true
}
const submitAudit = async () => {
  const dlg = auditDialog
  if (dlg.decision === 'reject' && !dlg.remark.trim()) {
    ElMessage.warning('拒绝时必须填写备注')
    return
  }
  dlg.submitting = true
  try {
    await auditAdminRefund(dlg.refund.id, {
      status: dlg.decision === 'approve' ? 1 : 2,
      auditRemark: dlg.remark.trim() || (dlg.decision === 'approve' ? '管理员同意退款' : ''),
    })
    ElMessage.success(dlg.decision === 'approve' ? '已同意退款' : '已拒绝退款')
    dlg.visible = false
    fetchCounts()
    fetchList()
  } catch (e) {
    ElMessage.error(e?.message || '操作失败')
  } finally {
    dlg.submitting = false
  }
}

// 跳到订单详情（如果项目里有）
const goOrder = (row) => {
  // 当前项目里没有 admin 端的订单详情页，先简单跳到用户端的订单中心
  router.push(`/user-home/orders?focus=${row.orderId}`)
}

// ===== 退款详情弹窗（只读，展示完整原因/备注）=====
const detailDialog = reactive({
  visible: false,
  refund: null,
})
const openDetailDialog = (row) => {
  detailDialog.refund = row
  detailDialog.visible = true
}
// 从详情弹窗直接跳到仲裁弹窗（关掉详情，开仲裁）
const goAuditFromDetail = () => {
  const target = detailDialog.refund
  detailDialog.visible = false
  if (target) openAuditDialog(target)
}

// 简短时间
const timeShort = (s) => (s ? s.slice(0, 16) : '-')

// tradeMethod 标签
const tradeMethodLabel = (m) =>
  ({ FACE_TO_FACE: '自提', EXPRESS: '邮递', BOTH: '两者皆可' }[m] || '-')

// 退款次数标签颜色：1=绿色（安全） 2=橙色（警戒） 3=红色（已达上限）
const historyTagType = (n) => {
  if (n == null) return 'info'
  if (n >= 3) return 'danger'
  if (n >= 2) return 'warning'
  return 'success'
}

// 跳到仪表盘
const goDashboard = () => router.push('/admin-home/dashboards')
</script>

<template>
  <div class="refunds-page" v-loading="loading">
    <div class="page-title">
      <h2>退款管理</h2>
      <div class="title-actions">
        <el-button :icon="Refresh" size="small" @click="handleRefresh">刷新</el-button>
      </div>
    </div>

    <!-- 概览三块 -->
    <div class="summary-row">
      <div class="summary-card summary-danger">
        <div class="summary-icon"><el-icon :size="22"><Bell /></el-icon></div>
        <div class="summary-body">
          <div class="summary-value">{{ counts.pendingAdmin }}</div>
          <div class="summary-label">待管理员仲裁</div>
        </div>
      </div>
      <div class="summary-card summary-warning">
        <div class="summary-icon"><el-icon :size="22"><ChatLineRound /></el-icon></div>
        <div class="summary-body">
          <div class="summary-value">{{ counts.pendingSeller }}</div>
          <div class="summary-label">待卖家处理</div>
        </div>
      </div>
      <div class="summary-card summary-info">
        <div class="summary-icon"><el-icon :size="22"><Box /></el-icon></div>
        <div class="summary-body">
          <div class="summary-value">{{ counts.total }}</div>
          <div class="summary-label">退款记录总数</div>
        </div>
      </div>
    </div>

    <!-- tabs -->
    <div class="tabs-bar">
      <div
        v-for="t in tabOptions"
        :key="t.key"
        class="tab"
        :class="{ active: activeTab === t.key }"
        @click="activeTab = t.key"
      >
        {{ t.label }}
        <span class="tab-count">
          {{
            t.key === '1' ? counts.pendingAdmin
            : t.key === '0' ? counts.pendingSeller
            : counts.total - counts.pendingSeller - counts.pendingAdmin
          }}
        </span>
      </div>
    </div>

    <!-- 搜索 -->
    <div class="search-bar">
      <el-input
        v-model="filters.keyword"
        placeholder="搜索订单号 / 商品名 / 买家昵称"
        clearable
        @keyup.enter="handleSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-button type="primary" @click="handleSearch">搜索</el-button>
    </div>

    <!-- 表格 -->
    <el-table
      :data="list"
      stripe
      class="refund-table"
      empty-text="暂无记录"
    >
      <el-table-column label="订单" min-width="200">
        <template #default="{ row }">
          <div class="order-cell" @click="goOrder(row)">
            <img v-if="row.goodsCover" :src="row.goodsCover" class="cover" />
            <div v-else class="cover cover-empty">
              <el-icon :size="18" color="#ccc"><Box /></el-icon>
            </div>
            <div class="order-info">
              <div class="order-title">{{ row.goodsTitle || '-' }}</div>
              <div class="order-no">{{ row.orderNo || `#${row.orderId}` }}</div>
            </div>
          </div>
        </template>
      </el-table-column>

      <el-table-column label="买家" width="120">
        <template #default="{ row }">
          <div class="user-cell">
            <span class="user-name">{{ row.applicantNickname || '-' }}</span>
          </div>
        </template>
      </el-table-column>

      <el-table-column label="卖家" width="120">
        <template #default="{ row }">
          <span>{{ row.sellerNickname || '-' }}</span>
        </template>
      </el-table-column>

      <el-table-column label="退款金额" width="100">
        <template #default="{ row }">
          <span class="amount">¥{{ row.totalAmount }}</span>
        </template>
      </el-table-column>

      <el-table-column label="退款原因" min-width="180">
        <template #default="{ row }">
          <div class="reason-cell">
            <div class="reason-text">{{ row.reason }}</div>
            <div v-if="row.description" class="reason-desc">{{ row.description }}</div>
            <!-- 有内容就允许点击查看详情 -->
            <div
              v-if="row.reason || row.description"
              class="cell-link"
              @click="openDetailDialog(row)"
            >查看详情</div>
          </div>
        </template>
      </el-table-column>

      <el-table-column label="历史次数" width="100">
        <template #default="{ row }">
          <div class="count-cell">
            <el-tag
              :type="historyTagType(row.refundCountForBuyerAndGoods)"
              size="small"
              effect="plain"
            >
              {{ row.refundCountForBuyerAndGoods ?? '-' }} / 3
            </el-tag>
            <div
              v-if="(row.refundCountForBuyerAndGoods ?? 0) >= 3"
              class="count-warn"
            >已达上限</div>
          </div>
        </template>
      </el-table-column>

      <el-table-column label="阶段" width="180">
        <template #default="{ row }">
          <el-tag :type="refundStageTagType(row.stage)" size="small" effect="light">
            {{ refundStageText(row.stage) }}
          </el-tag>
          <!-- 卖家剩余处理时间 -->
          <div v-if="row.stage === 0 && sellerRemainingHours(row) !== null" class="deadline">
            卖家还剩
            <span :class="{ 'deadline-urgent': sellerRemainingHours(row) < 6 }">
              {{ sellerRemainingHours(row) }}h
            </span>
            处理
          </div>
          <!-- 卖家拒绝后给的备注：长内容也支持点击查看详情 -->
          <div v-if="row.stage === 1 && row.auditRemark" class="seller-reject">
            卖家备注：{{ row.auditRemark }}
            <span class="cell-link" @click="openDetailDialog(row)">查看详情</span>
          </div>
        </template>
      </el-table-column>

      <el-table-column label="申请时间" width="150">
        <template #default="{ row }">
          <span class="time">{{ timeShort(row.createTime) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <!-- 只有待管理员仲裁的可以操作 -->
          <el-button
            v-if="row.stage === 1 && row.status === 0"
            type="primary"
            size="small"
            round
            @click="openAuditDialog(row)"
          >处理</el-button>
          <!-- 已结束展示裁决结果 -->
          <div v-else-if="row.stage === 2" class="final-result">
            <el-tag :type="refundStatusTagType(row.status)" size="small" effect="plain">
              {{ refundStatusText(row.status) }}
            </el-tag>
            <div v-if="row.auditTime" class="final-time">
              {{ timeShort(row.auditTime) }}
            </div>
          </div>
          <span v-else class="muted">待卖家处理</span>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div v-if="total > 0" class="pagination">
      <span class="total">共 {{ total }} 条</span>
      <el-pagination
        v-model:current-page="filters.pageNum"
        v-model:page-size="filters.pageSize"
        :page-sizes="[10, 20, 50]"
        :total="total"
        layout="sizes, prev, pager, next, jumper"
        background
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>

    <el-empty
      v-if="!loading && list.length === 0"
      description="当前 tab 暂无退款记录"
      :image-size="100"
      style="margin-top: 40px;"
    >
      <el-button @click="goDashboard">返回仪表盘</el-button>
    </el-empty>

    <!-- 退款详情弹窗（只读：展示完整原因/备注，不支持裁决） -->
    <el-dialog
      v-model="detailDialog.visible"
      title="退款详情"
      width="560px"
      align-center
    >
      <div v-if="detailDialog.refund" class="detail-body">
        <!-- 顶部：订单 + 商品 -->
        <div class="detail-goods">
          <img v-if="detailDialog.refund.goodsCover" :src="detailDialog.refund.goodsCover" class="detail-cover" />
          <div v-else class="detail-cover detail-cover-empty">
            <el-icon :size="24" color="#ccc"><Box /></el-icon>
          </div>
          <div class="detail-goods-info">
            <div class="detail-goods-title">{{ detailDialog.refund.goodsTitle }}</div>
            <div class="detail-meta">
              <span>订单号：{{ detailDialog.refund.orderNo || `#${detailDialog.refund.orderId}` }}</span>
              <span class="dot">·</span>
              <span>买家：{{ detailDialog.refund.applicantNickname }}</span>
              <span class="dot">·</span>
              <span>卖家：{{ detailDialog.refund.sellerNickname }}</span>
            </div>
            <div class="detail-meta">
              <span>退款金额：</span>
              <span class="amount">¥{{ detailDialog.refund.totalAmount }}</span>
              <span class="dot">·</span>
              <el-tag :type="refundStageTagType(detailDialog.refund.stage)" size="small" effect="light">
                {{ refundStageText(detailDialog.refund.stage) }}
              </el-tag>
              <el-tag
                v-if="detailDialog.refund.stage === 2"
                :type="refundStatusTagType(detailDialog.refund.status)"
                size="small"
                effect="plain"
                style="margin-left: 4px;"
              >
                {{ refundStatusText(detailDialog.refund.status) }}
              </el-tag>
            </div>
          </div>
        </div>

        <el-divider />

        <!-- 买家原因（完整展示，不截断） -->
        <div class="detail-block">
          <div class="block-label">买家退款原因</div>
          <div class="block-content">{{ detailDialog.refund.reason || '-' }}</div>
        </div>
        <div v-if="detailDialog.refund.description" class="detail-block">
          <div class="block-label">买家补充说明</div>
          <div class="block-content">{{ detailDialog.refund.description }}</div>
        </div>

        <!-- 卖家处理记录（stage=1 / 2 才有） -->
        <div v-if="detailDialog.refund.auditRemark" class="detail-block">
          <div class="block-label">
            卖家备注
            <span v-if="detailDialog.refund.auditTime" class="block-time">
              {{ timeShort(detailDialog.refund.auditTime) }}
            </span>
          </div>
          <div class="block-content seller">{{ detailDialog.refund.auditRemark }}</div>
        </div>

        <!-- 管理员裁决记录（stage=2 才有，且是管理员裁决的） -->
        <div v-if="detailDialog.refund.stage === 2 && detailDialog.refund.auditBy" class="detail-block">
          <div class="block-label">
            管理员裁决
            <span v-if="detailDialog.refund.auditTime" class="block-time">
              {{ timeShort(detailDialog.refund.auditTime) }}
            </span>
          </div>
          <div class="block-content admin">{{ detailDialog.refund.auditRemark || '(无备注)' }}</div>
        </div>

        <div class="detail-foot">
          申请时间：{{ timeShort(detailDialog.refund.createTime) }}
        </div>
      </div>
      <template #footer>
        <el-button @click="detailDialog.visible = false">关闭</el-button>
        <!-- 待仲裁时给一个快捷入口跳到仲裁弹窗 -->
        <el-button
          v-if="detailDialog.refund && detailDialog.refund.stage === 1 && detailDialog.refund.status === 0"
          type="primary"
          @click="goAuditFromDetail"
        >去处理 →</el-button>
      </template>
    </el-dialog>

    <!-- 管理员仲裁弹窗 -->
    <el-dialog
      v-model="auditDialog.visible"
      title="退款仲裁"
      width="520px"
      align-center
      :close-on-click-modal="false"
    >
      <div v-if="auditDialog.refund" class="audit-body">
        <div class="info-row">
          <span class="label">订单号</span>
          <span class="value">{{ auditDialog.refund.orderNo || `#${auditDialog.refund.orderId}` }}</span>
        </div>
        <div class="info-row">
          <span class="label">商品</span>
          <span class="value">{{ auditDialog.refund.goodsTitle }}</span>
        </div>
        <div class="info-row">
          <span class="label">买家</span>
          <span class="value">{{ auditDialog.refund.applicantNickname }}</span>
        </div>
        <div class="info-row">
          <span class="label">卖家</span>
          <span class="value">{{ auditDialog.refund.sellerNickname }}</span>
        </div>
        <div class="info-row">
          <span class="label">退款金额</span>
          <span class="value danger">¥{{ auditDialog.refund.totalAmount }}</span>
        </div>
        <div class="info-row">
          <span class="label">买家原因</span>
          <span class="value">{{ auditDialog.refund.reason }}</span>
        </div>
        <div v-if="auditDialog.refund.description" class="info-row">
          <span class="label">补充说明</span>
          <span class="value">{{ auditDialog.refund.description }}</span>
        </div>
        <div v-if="auditDialog.refund.auditRemark" class="info-row">
          <span class="label">卖家备注</span>
          <span class="value seller">{{ auditDialog.refund.auditRemark }}</span>
        </div>

        <el-divider />

        <el-radio-group v-model="auditDialog.decision" class="decision-group">
          <el-radio-button value="approve">同意退款（支持买家）</el-radio-button>
          <el-radio-button value="reject">拒绝退款（维持卖家）</el-radio-button>
        </el-radio-group>

        <el-input
          v-model="auditDialog.remark"
          type="textarea"
          :rows="3"
          :maxlength="200"
          show-word-limit
          :placeholder="auditDialog.decision === 'reject' ? '请填写拒绝理由（必填）' : '可填写备注（选填）'"
          style="margin-top: 14px"
        />
        <div class="hint">
          同意：订单置为「已退款」，恢复库存<br />
          拒绝：订单回退到「待发货/待收货/已完成」
        </div>
      </div>
      <template #footer>
        <el-button @click="auditDialog.visible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="auditDialog.submitting"
          @click="submitAudit"
        >确认裁决</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.refunds-page { min-height: 100%; }

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

/* ===== 概览 ===== */
.summary-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}
.summary-card {
  background: #fff;
  border-radius: 12px;
  padding: 18px 22px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  transition: all 0.25s;
  border-left: 3px solid var(--accent);
}
.summary-card:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,0.08); }
.summary-danger { --accent: #ef4444; }
.summary-warning { --accent: #f59e0b; }
.summary-info { --accent: #3b82f6; }
.summary-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
}
.summary-value {
  font-size: 22px;
  font-weight: 700;
  color: #1f1f1f;
  line-height: 1.2;
}
.summary-label {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

/* ===== tabs ===== */
.tabs-bar {
  display: flex;
  gap: 4px;
  padding: 0 4px;
  margin-bottom: 14px;
  border-bottom: 1px solid #f0f2f5;
}
.tab {
  padding: 10px 18px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  position: relative;
  user-select: none;
  transition: color 0.2s;
}
.tab:hover { color: #ff6b35; }
.tab.active { color: #1f1f1f; font-weight: 600; }
.tab.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 18px;
  right: 18px;
  height: 2px;
  background: linear-gradient(90deg, #ff8c5a, #ff6b35);
  border-radius: 2px;
}
.tab-count {
  display: inline-block;
  min-width: 18px;
  padding: 0 6px;
  margin-left: 4px;
  font-size: 11px;
  background: #f5f7fa;
  color: #888;
  border-radius: 9px;
  text-align: center;
  line-height: 18px;
}
.tab.active .tab-count {
  background: linear-gradient(90deg, #ff8c5a, #ff6b35);
  color: #fff;
}

/* ===== 搜索 ===== */
.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border-radius: 999px;
  padding: 6px 6px 6px 16px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  max-width: 460px;
}
.search-bar :deep(.el-input__wrapper) { box-shadow: none !important; }

/* ===== 表格 ===== */
.refund-table {
  background: #fff;
  border-radius: 12px;
  padding: 8px 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}
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
  max-width: 180px;
}
.order-no { font-size: 11px; color: #999; margin-top: 2px; }

.user-cell { font-size: 13px; }
.user-name { color: #1f1f1f; }

.amount {
  color: #ff6b35;
  font-weight: 600;
}

.reason-cell { line-height: 1.4; }
.reason-text { font-size: 13px; color: #1f1f1f; }
.reason-desc {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
}

.deadline {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}
.deadline-urgent { color: #ef4444; font-weight: 600; }

/* 历史次数列 */
.count-cell { line-height: 1.4; }
.count-warn {
  font-size: 11px;
  color: #ef4444;
  margin-top: 4px;
}

.seller-reject {
  font-size: 11px;
  color: #888;
  margin-top: 4px;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
}

/* 单元格内可点击的小链接：用于"查看详情" */
.cell-link {
  display: inline-block;
  margin-top: 4px;
  font-size: 11px;
  color: #ff6b35;
  cursor: pointer;
  user-select: none;
}
.cell-link:hover {
  text-decoration: underline;
  color: #ff8c5a;
}

.time { font-size: 12px; color: #666; }
.final-result { line-height: 1.4; }
.final-time { font-size: 11px; color: #aaa; margin-top: 2px; }
.muted { color: #aaa; font-size: 12px; }

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

/* ===== 弹窗 ===== */
.audit-body { font-size: 14px; }
.audit-body .info-row {
  display: flex;
  padding: 7px 0;
  border-bottom: 1px dashed #f0f2f5;
}
.audit-body .info-row .label {
  width: 80px;
  color: #888;
  flex-shrink: 0;
}
.audit-body .info-row .value { flex: 1; color: #1f1f1f; word-break: break-all; }
.audit-body .info-row .value.danger { color: #ff4d4f; font-weight: 600; }
.audit-body .info-row .value.seller { color: #f59e0b; }
.decision-group { display: flex; flex-wrap: wrap; gap: 8px; }
.decision-group :deep(.el-radio-button__inner) { width: 200px; }
.hint {
  font-size: 12px;
  color: #999;
  margin-top: 8px;
  line-height: 1.6;
}

/* ===== 详情弹窗 ===== */
.detail-body { font-size: 14px; }
.detail-goods {
  display: flex;
  gap: 12px;
  align-items: center;
}
.detail-cover {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  object-fit: cover;
  background: #f5f7fa;
  flex-shrink: 0;
}
.detail-cover-empty {
  display: flex;
  align-items: center;
  justify-content: center;
}
.detail-goods-info { flex: 1; min-width: 0; }
.detail-goods-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f1f1f;
  margin-bottom: 6px;
  word-break: break-all;
}
.detail-meta {
  font-size: 12px;
  color: #888;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 2px;
}
.detail-meta .dot { color: #ddd; }
.detail-meta .amount { color: #ff6b35; font-weight: 600; font-size: 13px; }
.detail-block { margin-top: 14px; }
.block-label {
  font-size: 12px;
  color: #888;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.block-time { color: #bbb; font-size: 11px; }
.block-content {
  font-size: 13px;
  color: #1f1f1f;
  line-height: 1.7;
  background: #fafbfc;
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
.detail-foot {
  margin-top: 16px;
  padding-top: 10px;
  border-top: 1px dashed #f0f2f5;
  font-size: 12px;
  color: #aaa;
  text-align: right;
}

@media (max-width: 1100px) {
  .summary-row { grid-template-columns: 1fr; }
  .decision-group :deep(.el-radio-button__inner) { width: 160px; }
}
</style>
