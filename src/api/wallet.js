import http from './http'

// 流水类型 -> 文案(前端展示用,对应后端 WalletTransactionType 枚举)
// 1=充值 2=提现 3=支付(订单支付/卖家收款/退款)
export const TX_TYPE_TEXT = {
  1: '充值',
  2: '提现',
  3: '支付',
}
export const txTypeText = (t) => TX_TYPE_TEXT[t] || '-'

// 平台账户流水类型 -> 文案(对应后端 PlatformTransactionType 枚举,字符串枚举)
export const PLATFORM_TX_TYPE_TEXT = {
  ESCROW_IN: '资金入托管',
  ESCROW_OUT: '打款给卖家',
  REFUND_OUT: '退款出账',
  COMMISSION_IN: '收手续费',
}
export const platformTxTypeText = (t) => PLATFORM_TX_TYPE_TEXT[t] || '-'

// 我的钱包
export const getMyBalance = () => http.get('/wallet/balance')

export const getMyTransactions = (params) => http.get('/wallet/transactions', { params })

// 充值 / 提现
export const alipayRecharge = (amount) => http.post('/payment/alipay/recharge', { amount })
export const alipayWithdraw = (amount) => http.post('/payment/alipay/withdraw', { amount })

// 订单支付
export const alipayOrderPay = (orderId) => http.post('/payment/alipay/order-create', { orderId })
export const wxpayOrderCreate = (orderId) => http.post('/payment/wxpay/create', { orderId })
export const wxpayMockSuccess = (orderId) => http.post('/payment/wxpay/mock-success', { orderId })

// 钱包充值 / 提现(微信渠道,沙箱不可用,走 mock)
export const wxpayRecharge = (amount) => http.post('/payment/wxpay/recharge', { amount })
export const wxpayRechargeSuccess = (prepayId, amount) => http.post('/payment/wxpay/recharge-success', { prepayId, amount })
export const wxpayWithdraw = (amount) => http.post('/payment/wxpay/withdraw', { amount })

// admin
export const adminGetPlatform = () => http.get('/admin/wallet/platform')
export const adminGetUserWallet = (userId) => http.get(`/admin/wallet/users/${userId}`)
export const adminListTransactions = (params) => http.get('/admin/wallet/transactions', { params })
export const adminListPlatformTransactions = (params) =>
  http.get('/admin/wallet/platform/transactions', { params })
// 注:历史曾有的 adminAdjust 系统调账 / adminReconcile 手动对账 已删除(后端对应接口已下线)