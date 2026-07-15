import http from './http'

// 管理端 - 订单全量查看
// 后端 AdminOrderController 挂在 /api/admin/order 前缀下，由 AuthInterceptor 守住 role=ADMIN。
// 这里的所有路径会自动被 src/api/http.js 的 baseURL='/api' 加上前缀。
export const getAdminOrderPage   = (params) => http.get('/admin/order/page', { params })
export const getAdminOrder       = (id)      => http.get(`/admin/order/${id}`)
// 详情对话框的退款/评价区块用：分别是 t_refund / t_review 的完整实体
export const getAdminOrderRefund = (id)      => http.get(`/admin/order/${id}/refund`)
export const getAdminOrderReview = (id)      => http.get(`/admin/order/${id}/review`)
