// 商品管理（模块六） —— 与 docs/api.md v2 对齐的真实 axios 请求
// 字段模型：saleStatus 0-未上架 1-在售 2-已下架 3-已售
//           tradeMethod FACE_TO_FACE / EXPRESS / BOTH
import http from './http'

// ===== 商品 / 收藏 / 想要 / 浏览 =====

// 用户端
export const getMyGoods = (params) => http.get('/goods/my', { params })
export const getGoods = (id) => http.get(`/goods/${id}`)
export const addGoods = (data) => http.post('/goods', data)
export const updateGoods = (data) => http.put('/goods', data)
export const deleteGoods = (id) => http.delete(`/goods/${id}`)
// 批量删除：后端 DELETE /goods 接 body { ids }，注意 axios DELETE body 要走 data
export const batchDeleteGoods = (ids) => http.delete('/goods', { data: { ids } })
export const onSaleGoods = (id) => http.put(`/goods/${id}/on-sale`)
export const offSaleGoods = (id) => http.put(`/goods/${id}/off-sale`)
export const getGoodsPage = (params) => http.get('/goods/page', { params })
export const getHotGoods = (params) => http.get('/goods/hot', { params })
// 首页推荐：调 /recommend/home 而不是 /goods/recommend，
// 后者要 @RequireAuth，未登录态会 401；前者对 null uid 自动 fallback 到 hotList
export const getRecommendGoods = (params) => http.get('/recommend/home', { params })
export const recordView = (id) => http.post(`/goods/${id}/view`)
export const reduceStock = (goodsId, quantity) =>
  http.post(`/goods/${goodsId}/reduce-stock`, { quantity })

// 收藏
export const toggleFavorite = (goodsId) => http.post(`/favorite/${goodsId}`)
export const removeFavorite = (goodsId) => http.delete(`/favorite/${goodsId}`)
export const removeFavoritesBatch = (ids) => http.delete('/favorite', { data: { ids } })
export const getFavoritePage = (params) => http.get('/favorite/page', { params })
export const isFavorited = (goodsId) => http.get(`/favorite/${goodsId}/exists`)

// 想要 / 浏览
export const toggleWant = (goodsId) => http.post(`/want/${goodsId}`)
export const getBrowseHistory = (params) => http.get('/browse/history', { params })

// 管理员端
export const getAdminGoodsPage = (params) => http.get('/admin/goods/page', { params })
export const getAdminPendingGoods = (params) => http.get('/admin/goods/audit/pending', { params })
export const getAdminGoods = (id) => http.get(`/admin/goods/${id}`)
export const deleteAdminGoods = (id) => http.delete(`/admin/goods/${id}`)
export const auditAdminGoods = (id, data) => http.put(`/admin/goods/${id}/audit`, data)

// ===== 字典辅助（前端显示）=====
export const TRADE_METHOD_MAP = { FACE_TO_FACE: '自提', EXPRESS: '邮递', BOTH: '两者皆可' }
export const tradeMethodText = (m) => TRADE_METHOD_MAP[m] || '-'
export const auditStatusText = (s) => ({ 0: '待审核', 1: '已通过', 2: '已拒绝' }[s] || '-')
export const saleStatusText = (s) => ({ 0: '未上架', 1: '在售', 2: '已下架', 3: '已售' }[s] || '-')

// 成色 1-10：10=全新；9=9 成新 / 几乎全新；8=8 成新；5=5 成新 / 正常使用痕迹；≤4=有使用痕迹
// 取值越低使用痕迹越多；后端 schema 是 TINYINT 1-10，存的就是数字本身
export const CONDITION_LEVEL_MAP = {
  10: '全新',
  9: '9 成新',
  8: '8 成新',
  7: '7 成新',
  6: '6 成新',
  5: '5 成新',
  4: '4 成新',
  3: '3 成新',
  2: '2 成新',
  1: '1 成新',
}
export const conditionLevelText = (n) => {
  if (n == null) return '-'
  const v = Number(n)
  if (Number.isNaN(v)) return '-'
  // 不在 1-10 范围内的兜底
  if (CONDITION_LEVEL_MAP[v]) return CONDITION_LEVEL_MAP[v]
  return `${v} 成新`
}
