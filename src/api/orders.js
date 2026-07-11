import http from './http'

// ===== 订单状态 =====
// 0-待付款 1-待发货 2-待收货 3-已完成 4-已取消 5-退款中 6-已退款
export const ORDER_STATUS = {
  PENDING_PAY: 0,
  PENDING_DELIVER: 1,
  PENDING_RECEIVE: 2,
  DONE: 3,
  CANCELED: 4,
  REFUNDING: 5,
  REFUNDED: 6,
}

export const orderStatusText = (s) =>
  ({
    0: '待付款',
    1: '待发货',
    2: '待收货',
    3: '已完成',
    4: '已取消',
    5: '退款中',
    6: '已退款',
  }[s] ?? '-')

export const orderStatusTagType = (s) =>
  ({
    0: 'danger',
    1: 'warning',
    2: 'primary',
    3: 'success',
    4: 'info',
    5: 'warning',
    6: 'info',
  }[s] || 'info')

// 是否可申请退款（待发货/待收货可申请；已完成需 7 天内）
export const canRefund = (o) => {
  if (!o) return false
  if (o.status === 1) return true
  if (o.status === 2) return true
  if (o.status === 3) {
    if (!o.receiveTime) return true
    const days = (Date.now() - new Date(o.receiveTime).getTime()) / 86400000
    return days <= 7
  }
  return false
}

// ===== 接口 =====
export const createOrder = (data) => http.post('/order', data)
export const getOrderPage = (params) => http.get('/order/page', { params })
export const getOrder = (id) => http.get(`/order/${id}`)
export const payOrder = (id, data) => http.post(`/order/${id}/pay`, data)
export const cancelOrder = (id) => http.post(`/order/${id}/cancel`)
export const deliverOrder = (id) => http.post(`/order/${id}/deliver`)
export const receiveOrder = (id) => http.post(`/order/${id}/receive`)
export const refundOrder = (id, data) => http.post(`/order/${id}/refund`, data)
// 卖家处理退款：status=1 同意 2 拒绝
export const auditRefundOrder = (refundId, data) => http.put(`/order/refund/${refundId}/audit`, data)
// 查询某订单的退款记录
export const getOrderRefund = (orderId) => http.get(`/order/${orderId}/refund`)
