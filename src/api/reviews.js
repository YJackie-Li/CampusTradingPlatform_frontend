import http from './http'

export const createReview = (data) => http.post('/review', data)
// 卖家评价买家（v4 升级）：独立于买家评价，无须等买家先评
export const createSellerRating = (data) => http.post('/review/seller', data)
export const getReviewByOrder = (orderId) => http.get(`/review/order/${orderId}`)
export const getReview = (id) => http.get(`/review/${id}`)
export const deleteReview = (id) => http.delete(`/review/${id}`)
// 接收纯字符串 content，内部包成 { content }，避免 axios 把字符串序列化成
// application/x-www-form-urlencoded（后端 @RequestBody 只认 JSON）。
export const replyReview = (id, content) =>
  http.post(`/review/${id}/reply`, { content })
export const getReviewPage = (params) => http.get('/review/page', { params })
export const getMyReviewPage = (params) => http.get('/review/my', { params })
export const getReviewStats = (goodsId) =>
  http.get('/review/stats', { params: { goodsId } })
// 用户维度的双向评价统计（公开接口）：商品详情页展示卖家"作为卖家/作为买家"两组口碑
export const getUserReviewStats = (userId) =>
  http.get('/review/user-stats', { params: { userId } })
