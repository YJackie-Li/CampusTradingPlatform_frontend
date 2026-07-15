// AI 总结接口 —— 商品总结 + 买家评价总结
// 后端挂在 /api/ai 下,所有接口都是"按需调用 + 静默降级":
//   失败/关闭/无输入时返回 null,前端据此隐藏卡片,不抛错、不弹 toast
import http from './http'

/**
 * 获取指定商品的 AI 卖点摘要(基于商品描述)。
 * @param {number|string} goodsId 商品 ID
 * @returns {Promise<string|null>}
 */
export const getGoodsAiSummary = (goodsId) => http.get(`/ai/goods/${goodsId}/summary`)

/**
 * 获取指定商品的"买家评价"AI 聚合摘要。
 * 只读买家对卖家的评价,不含卖家对买家。
 * @param {number|string} goodsId 商品 ID
 * @returns {Promise<string|null>}
 */
export const getGoodsReviewSummary = (goodsId) =>
  http.get(`/ai/goods/${goodsId}/review-summary`)