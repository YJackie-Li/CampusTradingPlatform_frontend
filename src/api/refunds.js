import http from './http'

// ===== 退款阶段 =====
// 0-待卖家处理 1-待管理员仲裁 2-已结束
export const REFUND_STAGE = {
  PENDING_SELLER: 0,
  PENDING_ADMIN: 1,
  DONE: 2,
}

export const refundStageText = (s) =>
  ({
    0: '待卖家处理',
    1: '待管理员仲裁',
    2: '已结束',
  }[s] ?? '-')

export const refundStageTagType = (s) =>
  ({
    0: 'warning',
    1: 'danger',
    2: 'info',
  }[s] || 'info')

// ===== 退款状态 =====
// 0-待处理 1-同意 2-拒绝
export const refundStatusText = (s) =>
  ({
    0: '待处理',
    1: '已同意',
    2: '已拒绝',
  }[s] ?? '-')

export const refundStatusTagType = (s) =>
  ({
    0: 'warning',
    1: 'success',
    2: 'info',
  }[s] || 'info')

// ===== 接口 =====
// 管理员分页查询
export const getAdminRefundPage = (params) =>
  http.get('/admin/refund/page', { params })

// 仪表盘用的精简计数：{ pendingSeller, pendingAdmin, total }
export const getAdminRefundCounts = () =>
  http.get('/admin/refund/counts')

// 管理员最终裁决：status 1-同意 2-拒绝
export const auditAdminRefund = (refundId, data) =>
  http.put(`/admin/refund/${refundId}/audit`, data)
