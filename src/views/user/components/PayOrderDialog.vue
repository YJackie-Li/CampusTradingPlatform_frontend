<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Wallet } from '@element-plus/icons-vue'
import { getMyBalance } from '@/api/wallet'
import { payOrder } from '@/api/orders'
import {
  alipayOrderPay,
  wxpayOrderCreate,
  wxpayMockSuccess,
} from '@/api/wallet'

/**
 * 订单支付弹窗（v3 支付升级）。
 *
 * 三种支付方式：
 * - BALANCE: 走 OrderService.pay(BALANCE) 同步扣钱包（最常用）
 * - ALIPAY:  跳支付宝沙箱付款，异步回调后 status=1
 * - WECHAT:  弹"模拟二维码"子弹窗，2s 后用户点"我已完成支付" 触发 mock-success
 *
 * Props:
 *   v-model:  { visible: bool, order: OrderVO|null } （兼容旧 payDialog 形态）
 *   order:    OrderVO（直接传订单对象更清晰，本组件优先用 v-model.order）
 */
const props = defineProps({
  modelValue: { type: Object, default: () => ({ visible: false, order: null }) },
})
const emit = defineEmits(['update:modelValue', 'paid'])

const visible = computed({
  get: () => props.modelValue?.visible ?? false,
  set: (v) => emit('update:modelValue', { ...props.modelValue, visible: v }),
})

const order = computed(() => props.modelValue?.order ?? null)

const method = ref('BALANCE')
const balance = ref(0)
const submitting = ref(false)
const wxpayDialogVisible = ref(false)
const wxpayInfo = ref({ prepayId: '', codeUrl: '' })
const wxpayCountdown = ref(0)
let wxpayTimer = null

const formatMoney = (v) =>
  Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const insufficientBalance = computed(() => {
  if (method.value !== 'BALANCE') return false
  return Number(balance.value) < Number(order.value?.totalAmount ?? 0)
})

const loadBalance = async () => {
  try {
    const res = await getMyBalance()
    balance.value = Number(res?.balance ?? 0)
  } catch {
    balance.value = 0
  }
}

watch(
  () => props.modelValue?.visible,
  (v) => {
    if (v) {
      // 默认选 BALANCE（最便宜、最稳）
      method.value = 'BALANCE'
      loadBalance()
    } else {
      // 关闭时清掉 wxpay 子弹窗
      wxpayDialogVisible.value = false
      clearWxpayTimer()
    }
  }
)

const onClose = () => {
  visible.value = false
}

const submit = async () => {
  const o = order.value
  if (!o) return
  if (submitting.value) return

  if (method.value === 'BALANCE') {
    if (insufficientBalance.value) {
      ElMessage.warning('余额不足,请先充值或选择其他支付方式')
      return
    }
    submitting.value = true
    try {
      await payOrder(o.id, { method: 'BALANCE' })
      ElMessage.success('支付成功')
      visible.value = false
      emit('paid', { method: 'BALANCE' })
    } catch (e) {
      // 拦截器已经 toast 过
    } finally {
      submitting.value = false
    }
  } else if (method.value === 'ALIPAY') {
    submitting.value = true
    try {
      const res = await alipayOrderPay(o.id)
      if (res?.payUrl) {
        ElMessage.info('即将跳转到支付宝沙箱...')
        visible.value = false
        emit('paid', { method: 'ALIPAY' })
        window.location.href = res.payUrl
      } else {
        ElMessage.warning('未获取到支付链接')
      }
    } catch (e) {
      // ignore
    } finally {
      submitting.value = false
    }
  } else if (method.value === 'WECHAT') {
    submitting.value = true
    try {
      const res = await wxpayOrderCreate(o.id)
      wxpayInfo.value = {
        prepayId: res?.prepayId || '',
        codeUrl: res?.codeUrl || '',
      }
      wxpayDialogVisible.value = true
      // 2s 倒计时,提示用户"正在等待支付"
      wxpayCountdown.value = 2
      clearWxpayTimer()
      wxpayTimer = setInterval(() => {
        wxpayCountdown.value--
        if (wxpayCountdown.value <= 0) clearWxpayTimer()
      }, 1000)
    } catch (e) {
      // ignore
    } finally {
      submitting.value = false
    }
  }
}

const clearWxpayTimer = () => {
  if (wxpayTimer) {
    clearInterval(wxpayTimer)
    wxpayTimer = null
  }
}

const wxpayConfirm = async () => {
  const o = order.value
  if (!o) return
  try {
    await wxpayMockSuccess(o.id)
    ElMessage.success('支付成功(mock)')
    wxpayDialogVisible.value = false
    visible.value = false
    emit('paid', { method: 'WECHAT' })
  } catch (e) {
    // ignore
  }
}

const wxpayCancel = () => {
  wxpayDialogVisible.value = false
}
</script>

<template>
  <!-- 主弹窗:选择支付方式 -->
  <el-dialog
    :model-value="visible"
    title="选择支付方式"
    width="420px"
    align-center
    :show-close="true"
    @close="onClose"
    @update:model-value="(v) => (visible = v)"
  >
    <div class="pay-amount">
      <span class="amount-label">支付金额</span>
      <span class="amount-value">¥ {{ formatMoney(order?.totalAmount) }}</span>
    </div>

    <div class="pay-list">
      <!-- 余额支付（默认） -->
      <div
        class="pay-item"
        :class="{ active: method === 'BALANCE', disabled: insufficientBalance }"
        @click="!insufficientBalance && (method = 'BALANCE')"
      >
        <span class="pay-icon pay-icon-balance">
          <el-icon :size="20"><Wallet /></el-icon>
        </span>
        <div class="pay-info">
          <span class="pay-label">余额支付</span>
          <span class="pay-sub">可用 ¥ {{ formatMoney(balance) }}</span>
        </div>
        <span v-if="method === 'BALANCE'" class="pay-check">✓</span>
      </div>

      <!-- 支付宝 -->
      <div
        class="pay-item"
        :class="{ active: method === 'ALIPAY' }"
        @click="method = 'ALIPAY'"
      >
        <span class="pay-icon pay-icon-alipay" aria-label="支付宝">
          <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
            <text
              x="16"
              y="22.5"
              font-family="'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Heiti SC', sans-serif"
              font-size="20"
              font-weight="700"
              fill="#fff"
              text-anchor="middle"
            >支</text>
          </svg>
        </span>
        <div class="pay-info">
          <span class="pay-label">支付宝</span>
          <span class="pay-sub">沙箱环境</span>
        </div>
        <span v-if="method === 'ALIPAY'" class="pay-check">✓</span>
      </div>

      <!-- 微信支付(mock) -->
      <div
        class="pay-item"
        :class="{ active: method === 'WECHAT' }"
        @click="method = 'WECHAT'"
      >
        <span class="pay-icon pay-icon-wechat" aria-label="微信支付">
          <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
            <path
              fill="#fff"
              d="M11.5 6C6.8 6 3 9.2 3 13.1c0 2.2 1.3 4.2 3.3 5.5l-.8 2.5 2.9-1.5c.9.2 1.9.4 3 .4h.6c-.2-.6-.3-1.3-.3-1.9 0-3.7 3.5-6.7 7.8-6.7h.7C19.4 8.1 15.8 6 11.5 6Zm-3.2 4.4a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Zm6.4 0a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Z"
            />
            <path
              fill="#fff"
              d="M29 18.4c0-3.2-3.2-5.7-7.1-5.7-4 0-7.2 2.6-7.2 5.7 0 3.2 3.2 5.7 7.2 5.7.8 0 1.6-.1 2.4-.3l2.5 1.3-.7-2.1c1.8-1.1 2.9-2.7 2.9-4.6Zm-9.4-1.7a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8Zm4.7 0a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8Z"
            />
          </svg>
        </span>
        <div class="pay-info">
          <span class="pay-label">微信支付</span>
          <span class="pay-sub">演示模式(沙箱不可用)</span>
        </div>
        <span v-if="method === 'WECHAT'" class="pay-check">✓</span>
      </div>
    </div>

    <div v-if="insufficientBalance" class="balance-warn">
      余额不足,请先<a @click.prevent="visible = false; $router.push('/user-home/wallet')">充值</a>或选择其他支付方式
    </div>

    <template #footer>
      <el-button @click="onClose">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">
        确认支付 ¥ {{ formatMoney(order?.totalAmount) }}
      </el-button>
    </template>
  </el-dialog>

  <!-- 微信 mock 扫码子弹窗 -->
  <el-dialog
    v-model="wxpayDialogVisible"
    title="微信支付(mock)"
    width="380px"
    align-center
    :show-close="false"
    :close-on-click-modal="false"
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
        <p class="muted">{{ wxpayInfo.prepayId || 'MOCK_xxx' }}</p>
        <p v-if="wxpayCountdown > 0" class="muted">{{ wxpayCountdown }}s 后可点击下方按钮</p>
        <p v-else class="muted">微信支付 V3 已下线沙箱,本环境采用 mock 模式</p>
      </div>
    </div>
    <template #footer>
      <el-button @click="wxpayCancel">取消</el-button>
      <el-button type="primary" :disabled="wxpayCountdown > 0" @click="wxpayConfirm">
        我已完成支付
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.pay-amount {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff7f2;
  border: 1px solid #ffe0cc;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
}
.amount-label { color: #666; font-size: 13px; }
.amount-value { color: #ff6b35; font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }

.pay-list { display: flex; flex-direction: column; gap: 8px; }
.pay-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #eef0f3;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
}
.pay-item:hover { border-color: #ff8c5a; background: #fff7f2; }
.pay-item.active {
  border-color: #ff6b35;
  background: #fff7f2;
  box-shadow: 0 0 0 1px #ff6b35;
}
.pay-item.disabled { opacity: 0.5; cursor: not-allowed; }
.pay-item.disabled:hover { border-color: #eef0f3; background: transparent; }

.pay-icon {
  width: 36px; height: 36px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  color: #fff;
}
.pay-icon-balance { background: linear-gradient(135deg, #ff8c5a 0%, #ff6b35 100%); }
.pay-icon-alipay { background: #1677ff; }
.pay-icon-wechat { background: #07c160; }

.pay-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.pay-label { color: #1f1f1f; font-size: 14px; font-weight: 500; }
.pay-sub { color: #999; font-size: 12px; }

.pay-check {
  position: absolute;
  right: 12px;
  width: 20px; height: 20px;
  border-radius: 50%;
  background: #ff6b35;
  color: #fff;
  font-size: 12px;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700;
}

.balance-warn {
  margin-top: 12px;
  padding: 8px 12px;
  background: #fdf6ec;
  color: #b88230;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.6;
}
.balance-warn a { color: #ff6b35; text-decoration: underline; cursor: pointer; margin: 0 4px; }

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
