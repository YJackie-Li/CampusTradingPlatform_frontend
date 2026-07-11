<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Wallet, Plus, Minus, Refresh } from '@element-plus/icons-vue'
import {
  getMyBalance,
  getMyTransactions,
  alipayRecharge,
  alipayWithdraw,
  wxpayRecharge,
  wxpayRechargeSuccess,
  wxpayWithdraw,
  txTypeText,
} from '@/api/wallet'

const loading = ref(false)
const balance = ref(0)
const list = ref([])
const total = ref(0)
const filterType = ref(null)  // null=全部
const pageNum = ref(1)
const pageSize = ref(10)

const formatMoney = (v) => {
  if (v == null) return '0.00'
  return Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const loadBalance = async () => {
  try {
    const res = await getMyBalance()
    balance.value = res?.balance ?? 0
  } catch (e) {
    // ignore
  }
}

const loadList = async () => {
  loading.value = true
  try {
    const res = await getMyTransactions({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      type: filterType.value || undefined,
    })
    list.value = res?.records || []
    total.value = res?.total || 0
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadBalance()
  loadList()
})

// 页面销毁时清掉 wxpay 倒计时,避免内存泄漏
onUnmounted(() => {
  clearWxRechargeTimer()
})

const refresh = () => {
  loadBalance()
  loadList()
}

const handlePageChange = (p) => {
  pageNum.value = p
  loadList()
}

const onTypeChange = () => {
  pageNum.value = 1
  loadList()
}

// ===== 充值 =====
const rechargeVisible = ref(false)
const rechargeAmount = ref(100)
const rechargeMethod = ref('ALIPAY')  // 'ALIPAY' | 'WECHAT'
const rechargeLoading = ref(false)

// 微信 mock 充值子弹窗状态
const wxRechargeDialogVisible = ref(false)
const wxRechargeInfo = ref({ prepayId: '' })
let wxRechargeTimer = null

const openRecharge = () => {
  rechargeAmount.value = 100
  rechargeMethod.value = 'ALIPAY'
  rechargeVisible.value = true
}
const closeRechargeDialog = () => {
  // 主弹窗关闭时只清 timer,不要级联关闭微信子弹窗 —
  // 微信弹窗的开关由自己的 cancelWxRecharge / confirmWxRecharge 控制
  rechargeVisible.value = false
  clearWxRechargeTimer()
}

const submitRecharge = async () => {
  const amt = Number(rechargeAmount.value)
  if (!amt || amt <= 0) {
    ElMessage.warning('金额必须大于 0')
    return
  }
  if (rechargeMethod.value === 'ALIPAY') {
    // 支付宝:跳沙箱付款页
    rechargeLoading.value = true
    try {
      const res = await alipayRecharge(amt)
      rechargeVisible.value = false
      if (res?.payUrl) {
        ElMessage.info('即将跳转到支付宝沙箱...')
        window.location.href = res.payUrl
      } else {
        ElMessage.success('充值已发起')
        refresh()
      }
    } finally {
      rechargeLoading.value = false
    }
  } else {
    // 微信:弹二维码子弹窗,用户点"我已完成支付"立即触发入账(无倒计时)
    // mock 演示场景不需要 2s 等待,后端 UNIQUE(user_id, order_id, refund_id, type=RECHARGE) 兜底幂等
    rechargeLoading.value = true
    try {
      const res = await wxpayRecharge(amt)
      wxRechargeInfo.value = { prepayId: res?.prepayId || '' }
      rechargeVisible.value = false
      wxRechargeDialogVisible.value = true
    } catch (e) {
      // ignore
    } finally {
      rechargeLoading.value = false
    }
  }
}

const confirmWxRecharge = async () => {
  const amt = Number(rechargeAmount.value)
  if (!amt || amt <= 0) return
  try {
    await wxpayRechargeSuccess(wxRechargeInfo.value.prepayId, amt)
    ElMessage.success('充值成功(mock)')
    wxRechargeDialogVisible.value = false
    refresh()
  } catch (e) {
    // ignore
  }
}

const cancelWxRecharge = () => {
  wxRechargeDialogVisible.value = false
}

const clearWxRechargeTimer = () => {
  // 保留函数占位(给 onUnmounted / closeRechargeDialog 调用),实际无 timer 要清
  wxRechargeTimer = null
}

// ===== 提现 =====
const withdrawVisible = ref(false)
const withdrawAmount = ref(50)
const withdrawMethod = ref('ALIPAY')  // 'ALIPAY' | 'WECHAT'
const withdrawLoading = ref(false)
const openWithdraw = () => {
  if (balance.value <= 0) {
    ElMessage.warning('余额为 0,无法提现')
    return
  }
  withdrawAmount.value = Math.min(50, Number(balance.value))
  withdrawMethod.value = 'ALIPAY'
  withdrawVisible.value = true
}
const submitWithdraw = async () => {
  const amt = Number(withdrawAmount.value)
  if (!amt || amt <= 0) {
    ElMessage.warning('金额必须大于 0')
    return
  }
  if (amt > Number(balance.value)) {
    ElMessage.warning('提现金额超过余额')
    return
  }
  withdrawLoading.value = true
  try {
    const res = withdrawMethod.value === 'ALIPAY'
      ? await alipayWithdraw(amt)
      : await wxpayWithdraw(amt)
    withdrawVisible.value = false
    if (res?.mockReason) {
      ElMessageBox.alert(res.mockReason, '提现结果', { type: 'warning' })
    } else {
      ElMessage.success('提现成功')
    }
    refresh()
  } finally {
    withdrawLoading.value = false
  }
}

const rowClass = ({ row }) => {
  return row.direction === 1 ? 'tx-in' : 'tx-out'
}

// 提现抽成:与后端 commissionProperties.withdrawRate 同步(默认 1%)
const WITHDRAW_FEE_RATE = 0.01
const actualArrival = computed(() => {
  const amt = Number(withdrawAmount.value) || 0
  const fee = Math.round(amt * WITHDRAW_FEE_RATE * 100) / 100
  return Math.round((amt - fee) * 100) / 100
})
const feeAmount = computed(() => {
  const amt = Number(withdrawAmount.value) || 0
  return Math.round(amt * WITHDRAW_FEE_RATE * 100) / 100
})
</script>

<template>
  <div class="wallet-page">
    <div class="page-header">
      <h2 class="page-title">我的钱包</h2>
    </div>

    <!-- 余额卡片 -->
    <div class="balance-card">
      <div class="balance-left">
        <div class="balance-icon">
          <el-icon :size="32"><Wallet /></el-icon>
        </div>
        <div class="balance-info">
          <div class="balance-label">钱包余额</div>
          <div class="balance-amount">¥ {{ formatMoney(balance) }}</div>
        </div>
      </div>
      <div class="balance-actions">
        <el-button type="primary" :icon="Plus" @click="openRecharge">充值</el-button>
        <el-button :icon="Minus" @click="openWithdraw">提现</el-button>
        <el-button :icon="Refresh" circle @click="refresh" title="刷新" />
      </div>
    </div>

    <!-- 流水 -->
    <div class="data-card">
      <div class="list-header">
        <span class="list-title">资金流水</span>
        <el-select
          v-model="filterType"
          placeholder="全部类型"
          clearable
          size="small"
          style="width: 140px;"
          @change="onTypeChange"
        >
          <el-option label="充值" :value="1" />
          <el-option label="提现" :value="2" />
          <el-option label="支付" :value="3" />
        </el-select>
      </div>

      <el-table
        v-loading="loading"
        :data="list"
        stripe
        style="width: 100%"
        :header-cell-style="{ background: '#fafbfc', color: '#1f1f1f' }"
        :row-class-name="rowClass"
      >
        <el-table-column label="金额" min-width="140" align="left">
          <template #default="{ row }">
            <span :class="['amount', row.direction === 1 ? 'amount-in' : 'amount-out']">
              {{ row.direction === 1 ? '+' : '-' }}¥{{ formatMoney(row.amount) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="类型" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ txTypeText(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="说明" min-width="240" align="left" />
        <el-table-column label="钱包余额(变动后)" min-width="160" align="right">
          <template #default="{ row }">
            ¥{{ formatMoney(row.balanceAfter) }}
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="时间" min-width="160" align="center" />
        <template #empty>
          <el-empty description="暂无流水" />
        </template>
      </el-table>

      <div class="pagination">
        <span class="total">共 {{ total }} 条</span>
        <el-pagination
          v-model:current-page="pageNum"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next, jumper"
          background
          @current-change="handlePageChange"
        />
      </div>
    </div>

    <!-- 充值弹窗 -->
    <el-dialog
      v-model="rechargeVisible"
      title="钱包充值"
      width="440px"
      align-center
      :close-on-click-modal="false"
      @close="closeRechargeDialog"
    >
      <p class="dialog-tip">充值支持支付宝(沙箱)和微信(演示模式),按需选择渠道。</p>
      <el-form @submit.prevent>
        <el-form-item label="充值金额(元)">
          <el-input-number
            v-model="rechargeAmount"
            :min="0.01"
            :max="100000"
            :step="10"
            :precision="2"
            controls-position="right"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="支付渠道">
          <div class="pay-options">
            <div
              class="pay-option"
              :class="{ active: rechargeMethod === 'ALIPAY' }"
              @click="rechargeMethod = 'ALIPAY'"
            >
              <span class="pay-icon-alipay">支</span>
              <div class="pay-option-text">
                <div class="pay-option-label">支付宝</div>
                <div class="pay-option-sub">沙箱环境</div>
              </div>
              <span v-if="rechargeMethod === 'ALIPAY'" class="pay-option-check">✓</span>
            </div>
            <div
              class="pay-option"
              :class="{ active: rechargeMethod === 'WECHAT' }"
              @click="rechargeMethod = 'WECHAT'"
            >
              <span class="pay-icon-wechat">微</span>
              <div class="pay-option-text">
                <div class="pay-option-label">微信支付</div>
                <div class="pay-option-sub">演示模式</div>
              </div>
              <span v-if="rechargeMethod === 'WECHAT'" class="pay-option-check">✓</span>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeRechargeDialog">取消</el-button>
        <el-button type="primary" :loading="rechargeLoading" @click="submitRecharge">
          确认充值
        </el-button>
      </template>
    </el-dialog>

    <!-- 微信 mock 充值子弹窗 -->
    <el-dialog
      v-model="wxRechargeDialogVisible"
      title="微信支付(mock)"
      width="380px"
      align-center
      :show-close="false"
      :close-on-click-modal="false"
      @close="cancelWxRecharge"
    >
      <div class="wxpay-mock">
        <div class="qr-mock">
          <div class="qr-pattern">
            <span v-for="i in 64" :key="i" :class="['qr-cell', ((i * 37 + 11) % 7) < 3 ? 'on' : 'off']" />
          </div>
          <div class="qr-corner qr-tl" />
          <div class="qr-corner qr-tr" />
          <div class="qr-corner qr-bl" />
          <div class="qr-logo">微</div>
        </div>
        <div class="wxpay-tip">
          <p>模拟二维码扫描中...</p>
          <p class="muted">{{ wxRechargeInfo.prepayId || 'MOCK_xxx' }}</p>
          <p class="muted">微信支付 V3 已下线沙箱,本环境采用 mock 模式</p>
          <p class="muted">点击下方按钮即模拟支付成功</p>
        </div>
      </div>
      <template #footer>
        <el-button @click="cancelWxRecharge">取消</el-button>
        <el-button type="primary" @click="confirmWxRecharge">
          我已完成支付
        </el-button>
      </template>
    </el-dialog>

    <!-- 提现弹窗 -->
    <el-dialog v-model="withdrawVisible" title="钱包提现" width="440px" align-center>
      <p class="dialog-tip">
        提现支持支付宝和微信。因沙箱均无"商家转账到零钱"产品,提交后系统自动记账(不影响账本平衡)。
      </p>
      <el-form @submit.prevent>
        <el-form-item label="提现金额(元)">
          <el-input-number
            v-model="withdrawAmount"
            :min="0.01"
            :max="Number(balance) || 0"
            :step="10"
            :precision="2"
            controls-position="right"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="钱包余额">
          <span class="balance-tip">¥ {{ formatMoney(balance) }}</span>
        </el-form-item>
        <el-form-item label="到账预览">
          <div class="withdraw-preview">
            实际到账 <span class="preview-amount">¥{{ formatMoney(actualArrival) }}</span>
            <span class="preview-fee">手续费 ¥{{ formatMoney(feeAmount) }} (1%)</span>
          </div>
        </el-form-item>
        <el-form-item label="提现渠道">
          <div class="pay-options">
            <div
              class="pay-option"
              :class="{ active: withdrawMethod === 'ALIPAY' }"
              @click="withdrawMethod = 'ALIPAY'"
            >
              <span class="pay-icon-alipay">支</span>
              <div class="pay-option-text">
                <div class="pay-option-label">支付宝</div>
                <div class="pay-option-sub">沙箱 mock</div>
              </div>
              <span v-if="withdrawMethod === 'ALIPAY'" class="pay-option-check">✓</span>
            </div>
            <div
              class="pay-option"
              :class="{ active: withdrawMethod === 'WECHAT' }"
              @click="withdrawMethod = 'WECHAT'"
            >
              <span class="pay-icon-wechat">微</span>
              <div class="pay-option-text">
                <div class="pay-option-label">微信支付</div>
                <div class="pay-option-sub">沙箱 mock</div>
              </div>
              <span v-if="withdrawMethod === 'WECHAT'" class="pay-option-check">✓</span>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="withdrawVisible = false">取消</el-button>
        <el-button type="primary" :loading="withdrawLoading" @click="submitWithdraw">
          确认提现
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.wallet-page { min-height: 100%; }
.page-header { margin-bottom: 16px; }
.page-title { font-size: 18px; font-weight: 600; color: #1f1f1f; margin: 0; }

.balance-card {
  background: linear-gradient(135deg, #ff8c5a 0%, #ff6b35 100%);
  border-radius: 12px;
  padding: 28px 32px;
  color: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 4px 16px rgba(255, 107, 53, 0.25);
  margin-bottom: 16px;
}
.balance-left { display: flex; align-items: center; gap: 20px; }
.balance-icon {
  width: 60px; height: 60px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex; align-items: center; justify-content: center;
}
.balance-label { font-size: 13px; opacity: 0.9; }
.balance-amount { font-size: 32px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
.balance-actions { display: flex; gap: 10px; }
.balance-actions :deep(.el-button) { font-weight: 500; }

.data-card { background: #fff; border-radius: 12px; padding: 18px 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
.list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.list-title { font-size: 15px; font-weight: 600; color: #1f1f1f; }

.amount { font-weight: 600; font-variant-numeric: tabular-nums; }
.amount-in { color: #67c23a; }
.amount-out { color: #f56c6c; }

.pagination { display: flex; justify-content: flex-end; align-items: center; margin-top: 16px; gap: 16px; }
.total { font-size: 13px; color: #666; }
.pagination :deep(.el-pager li.is-active) {
  background: linear-gradient(135deg, #ff8c5a 0%, #ff6b35 100%) !important;
  color: #fff !important;
}

.dialog-tip { font-size: 13px; color: #666; margin: 0 0 12px 0; line-height: 1.6; }
.balance-tip { color: #ff6b35; font-weight: 600; }
.withdraw-preview {
  display: flex; align-items: baseline; gap: 12px;
  font-size: 13px; color: #666;
}
.preview-amount { color: #ff6b35; font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; }
.preview-fee { color: #999; font-size: 12px; }

/* 渠道选择(简化版,用在 WalletPage 弹窗) */
.pay-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  width: 100%;
}
.pay-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid #eef0f3;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
}
.pay-option:hover { border-color: #ff8c5a; background: #fff7f2; }
.pay-option.active {
  border-color: #ff6b35;
  background: #fff7f2;
  box-shadow: 0 0 0 1px #ff6b35;
}
.pay-icon-alipay,
.pay-icon-wechat {
  width: 32px; height: 32px;
  border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
}
.pay-icon-alipay { background: #1677ff; }
.pay-icon-wechat { background: #07c160; }
.pay-option-text { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.pay-option-label { color: #1f1f1f; font-size: 13px; font-weight: 500; }
.pay-option-sub { color: #999; font-size: 11px; }
.pay-option-check {
  position: absolute;
  right: 10px;
  width: 18px; height: 18px;
  border-radius: 50%;
  background: #ff6b35;
  color: #fff;
  font-size: 11px;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700;
}

/* 微信 mock 二维码弹窗 */
.wxpay-mock { text-align: center; padding: 10px 0; }
.qr-mock {
  position: relative;
  width: 180px; height: 180px;
  margin: 0 auto 16px;
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 8px;
  padding: 10px;
}
.qr-pattern {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 1px;
  width: 100%; height: 100%;
}
.qr-cell { background: transparent; }
.qr-cell.on { background: #1f1f1f; }
.qr-corner {
  position: absolute;
  width: 32px; height: 32px;
  border: 4px solid #1f1f1f;
}
.qr-tl { top: 6px; left: 6px; }
.qr-tr { top: 6px; right: 6px; }
.qr-bl { bottom: 6px; left: 6px; }
.qr-logo {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 36px; height: 36px;
  border-radius: 8px;
  background: #07c160;
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.wxpay-tip p { margin: 4px 0; color: #1f1f1f; font-size: 13px; }
.wxpay-tip .muted { color: #999; font-size: 12px; }
</style>
