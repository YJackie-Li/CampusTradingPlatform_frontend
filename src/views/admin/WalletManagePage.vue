<script setup>
import { ref, onMounted } from 'vue'
import { Refresh, Wallet } from '@element-plus/icons-vue'
import {
  adminGetPlatform,
  adminListTransactions,
  adminListPlatformTransactions,
  txTypeText,
  platformTxTypeText,
} from '@/api/wallet'

const platform = ref({ balance: 0, updateTime: null })
const loading = ref(false)

const txList = ref([])
const txTotal = ref(0)
const txPage = ref(1)
const txPageSize = ref(20)
const txFilterUserId = ref('')
const txFilterOrderId = ref('')
const txFilterType = ref(null)

// 平台账户流水(独立分页与过滤,与下方"全局流水"互不影响)
const platTxList = ref([])
const platTxTotal = ref(0)
const platTxPage = ref(1)
const platTxPageSize = ref(20)
const platTxFilterType = ref(null)
const platLoading = ref(false)

const formatMoney = (v) =>
  Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const loadPlatform = async () => {
  try {
    const res = await adminGetPlatform()
    platform.value = res || { balance: 0, updateTime: null }
  } catch (e) {
    // ignore
  }
}

const loadTransactions = async () => {
  loading.value = true
  try {
    const res = await adminListTransactions({
      pageNum: txPage.value,
      pageSize: txPageSize.value,
      userId: txFilterUserId.value || undefined,
      orderId: txFilterOrderId.value || undefined,
      type: txFilterType.value || undefined,
    })
    txList.value = res?.records || []
    txTotal.value = res?.total || 0
  } finally {
    loading.value = false
  }
}

const loadPlatformTransactions = async () => {
  platLoading.value = true
  try {
    const res = await adminListPlatformTransactions({
      pageNum: platTxPage.value,
      pageSize: platTxPageSize.value,
      type: platTxFilterType.value || undefined,
    })
    platTxList.value = res?.records || []
    platTxTotal.value = res?.total || 0
  } finally {
    platLoading.value = false
  }
}

onMounted(() => {
  loadPlatform()
  loadTransactions()
  loadPlatformTransactions()
})

const refresh = () => {
  loadPlatform()
  loadTransactions()
  loadPlatformTransactions()
}

const handlePageChange = (p) => {
  txPage.value = p
  loadTransactions()
}

const onFilterChange = () => {
  txPage.value = 1
  loadTransactions()
}

const handlePlatPageChange = (p) => {
  platTxPage.value = p
  loadPlatformTransactions()
}

const onPlatFilterChange = () => {
  platTxPage.value = 1
  loadPlatformTransactions()
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">钱包管理</h2>
    </div>

    <el-alert
      title="本页面仅查看:平台账户余额 + 全局流水。充值/提现走用户钱包页的支付宝沙箱,平台抽成按 yml 配置自动扣除(卖家结算 5%,提现 1%)。"
      type="info"
      :closable="false"
      show-icon
      class="tip-alert"
    />

    <!-- 平台账户 -->
    <div class="data-card">
      <div class="section-header">
        <span class="section-title">
          <el-icon :size="18" color="#ff6b35"><Wallet /></el-icon>
          平台账户
        </span>
        <el-button :icon="Refresh" size="small" @click="loadPlatform">刷新</el-button>
      </div>
      <div class="balance-row">
        <div class="balance-main">
          <span class="balance-label">钱包余额</span>
          <span class="balance-value">¥ {{ formatMoney(platform.balance) }}</span>
        </div>
        <div class="balance-time">
          最后更新: {{ platform.updateTime || '-' }}
        </div>
      </div>
    </div>

    <!-- 平台账户流水 -->
    <div class="data-card">
      <div class="section-header">
        <span class="section-title">平台账户流水</span>
        <el-button :icon="Refresh" size="small" @click="loadPlatformTransactions">刷新</el-button>
      </div>
      <div class="filter-bar">
        <el-select
          v-model="platTxFilterType"
          placeholder="流水类型"
          clearable
          size="small"
          style="width: 180px;"
          @change="onPlatFilterChange"
        >
          <el-option label="资金入托管" value="ESCROW_IN" />
          <el-option label="打款给卖家" value="ESCROW_OUT" />
          <el-option label="退款出账" value="REFUND_OUT" />
          <el-option label="收手续费" value="COMMISSION_IN" />
        </el-select>
      </div>

      <el-table
        v-loading="platLoading"
        :data="platTxList"
        stripe
        style="width: 100%"
        :header-cell-style="{ background: '#fafbfc', color: '#1f1f1f' }"
      >
        <el-table-column prop="id" label="ID" min-width="60" align="center" />
        <el-table-column label="类型" min-width="120" align="center">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ platformTxTypeText(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="orderId" label="订单ID" min-width="80" align="center">
          <template #default="{ row }">{{ row.orderId || '-' }}</template>
        </el-table-column>
        <el-table-column label="金额" min-width="120" align="right">
          <template #default="{ row }">
            <span :class="row.direction === 1 ? 'amount-in' : 'amount-out'">
              {{ row.direction === 1 ? '+' : '-' }}¥{{ formatMoney(row.amount) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="平台余额(变动后)" min-width="160" align="right">
          <template #default="{ row }">¥{{ formatMoney(row.balanceAfter) }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="说明" min-width="240" align="left" show-overflow-tooltip />
        <el-table-column prop="createTime" label="时间" min-width="160" align="center" />
        <template #empty>
          <el-empty description="暂无流水" />
        </template>
      </el-table>

      <div class="pagination">
        <span class="total">共 {{ platTxTotal }} 条</span>
        <el-pagination
          v-model:current-page="platTxPage"
          :page-size="platTxPageSize"
          :total="platTxTotal"
          layout="prev, pager, next, jumper"
          background
          @current-change="handlePlatPageChange"
        />
      </div>
    </div>

    <!-- 流水 -->
    <div class="data-card">
      <div class="section-header">
        <span class="section-title">全局流水</span>
        <el-button :icon="Refresh" size="small" @click="loadTransactions">刷新</el-button>
      </div>
      <div class="filter-bar">
        <el-input
          v-model.number="txFilterUserId"
          placeholder="用户 ID"
          clearable
          size="small"
          style="width: 140px;"
          @change="onFilterChange"
        />
        <el-input
          v-model.number="txFilterOrderId"
          placeholder="订单 ID"
          clearable
          size="small"
          style="width: 140px;"
          @change="onFilterChange"
        />
        <el-select
          v-model="txFilterType"
          placeholder="类型"
          clearable
          size="small"
          style="width: 140px;"
          @change="onFilterChange"
        >
          <el-option label="充值" :value="1" />
          <el-option label="提现" :value="2" />
          <el-option label="支付" :value="3" />
        </el-select>
      </div>

      <el-table
        v-loading="loading"
        :data="txList"
        stripe
        style="width: 100%"
        :header-cell-style="{ background: '#fafbfc', color: '#1f1f1f' }"
      >
        <el-table-column prop="id" label="ID" min-width="60" align="center" />
        <el-table-column prop="userId" label="用户ID" min-width="80" align="center" />
        <el-table-column prop="orderId" label="订单ID" min-width="80" align="center" />
        <el-table-column prop="refundId" label="退款ID" min-width="80" align="center" />
        <el-table-column label="类型" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ txTypeText(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="金额" min-width="120" align="right">
          <template #default="{ row }">
            <span :class="row.direction === 1 ? 'amount-in' : 'amount-out'">
              {{ row.direction === 1 ? '+' : '-' }}¥{{ formatMoney(row.amount) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="钱包余额(变动后)" min-width="160" align="right">
          <template #default="{ row }">¥{{ formatMoney(row.balanceAfter) }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="说明" min-width="200" align="left" show-overflow-tooltip />
        <el-table-column prop="createTime" label="时间" min-width="160" align="center" />
        <template #empty>
          <el-empty description="暂无流水" />
        </template>
      </el-table>

      <div class="pagination">
        <span class="total">共 {{ txTotal }} 条</span>
        <el-pagination
          v-model:current-page="txPage"
          :page-size="txPageSize"
          :total="txTotal"
          layout="prev, pager, next, jumper"
          background
          @current-change="handlePageChange"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-container { min-height: 100%; }
.page-header { margin-bottom: 16px; }
.page-title { font-size: 18px; font-weight: 600; color: #1f1f1f; margin: 0; }
.tip-alert { margin-bottom: 12px; border-radius: 8px; }
.tip-alert :deep(.el-alert__title) { font-size: 13px; color: #666; }

.data-card {
  background: #fff;
  border-radius: 12px;
  padding: 18px 20px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  margin-bottom: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}
.section-title { font-size: 15px; font-weight: 600; color: #1f1f1f; display: inline-flex; align-items: center; gap: 6px; }

.balance-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #fff7f2 0%, #ffe9d9 100%);
  border-radius: 8px;
  border: 1px solid #ffe0cc;
}
.balance-label { display: block; color: #666; font-size: 13px; }
.balance-value { display: block; color: #ff6b35; font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 4px; }
.balance-time { color: #999; font-size: 12px; }

.filter-bar { display: flex; gap: 10px; margin-bottom: 12px; }

.amount-in { color: #67c23a; font-weight: 600; font-variant-numeric: tabular-nums; }
.amount-out { color: #f56c6c; font-weight: 600; font-variant-numeric: tabular-nums; }

.pagination { display: flex; justify-content: flex-end; align-items: center; margin-top: 16px; gap: 16px; }
.total { font-size: 13px; color: #666; }
.pagination :deep(.el-pager li.is-active) {
  background: linear-gradient(135deg, #ff8c5a 0%, #ff6b35 100%) !important;
  color: #fff !important;
}
</style>