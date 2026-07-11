import http from './http'

// ===== 举报目标 =====
export const REPORT_TARGET = {
  REVIEW_CONTENT: 1,
  REPLY_CONTENT: 2,
}

export const reportTargetText = (t) =>
  ({
    1: '评价内容',
    2: '回复内容',
  }[t] ?? '-')

// ===== 举报 / 裁决状态 =====
// 0-待处理 1-保留(驳回) 2-删除(确认违规)
export const REPORT_STATUS = {
  PENDING: 0,
  KEEP: 1,
  DELETE: 2,
}

export const reportStatusText = (s) =>
  ({
    0: '待处理',
    1: '已保留',
    2: '已删除',
  }[s] ?? '-')

export const reportStatusTagType = (s) =>
  ({
    0: 'warning',
    1: 'info',
    2: 'danger',
  }[s] || 'info')

// ===== 举报人角色 =====
// 服务端在 ReviewReportVO.reporterRole 给出
export const reporterRoleText = (r) =>
  ({
    BUYER: '买家',
    SELLER: '卖家',
    OTHER: '其他用户',
  }[r] ?? '-')

// ===== 用户端接口 =====
// 提交举报（带原因）
export const submitReviewReport = (data) =>
  http.post('/review/report', data)

// 列出某条评价下的所有举报（双方可见，仅限该评价的 reviewer/seller）
export const listReviewReports = (reviewId) =>
  http.get(`/review/report/by-review/${reviewId}`)

// ===== 管理员接口 =====
export const getAdminReviewReportPage = (params) =>
  http.get('/admin/review/report/page', { params })

// 仪表盘计数：{ pending, kept, deleted, total }
export const getAdminReviewReportCounts = () =>
  http.get('/admin/review/report/counts')

// 管理员最终裁决：status 1-保留 2-删除；auditRemark 必填
export const auditAdminReviewReport = (reportId, data) =>
  http.put(`/admin/review/report/${reportId}/audit`, data)
