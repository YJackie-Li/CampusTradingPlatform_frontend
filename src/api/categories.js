import http from './http'

export const getCategoryTree = (params) => http.get('/category/tree', { params })
export const getCategoryList = () => http.get('/category/list')
export const getCategory = (id) => http.get(`/category/${id}`)
export const addCategory = (data) => http.post('/category', data)
export const updateCategory = (data) => http.put('/category', data)
export const deleteCategory = (id) => http.delete(`/category/${id}`)
export const updateCategoryStatus = (id, status) =>
  http.put(`/category/${id}/status`, { status })
export const updateCategorySort = (list) => http.put('/category/sort', list)
