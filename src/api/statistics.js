import http from './http'

export const getOverview = () => http.get('/statistics/overview')
export const getGrowth = (days = 90) =>
  http.get('/statistics/growth', { params: { days } })
export const getCategoryRank = (days = 90) =>
  http.get('/statistics/category-rank', { params: { days } })
export const getOrderStatus = () => http.get('/statistics/order-status')
export const getHealth = (days = 90) =>
  http.get('/statistics/health', { params: { days } })
export const getDashboard = (days = 90) =>
  http.get('/statistics/dashboard', { params: { days } })
