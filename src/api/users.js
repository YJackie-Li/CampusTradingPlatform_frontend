import http from './http'

export const getUserPage = (params) => http.get('/admin/users/page', { params })
export const getUser = (id) => http.get(`/admin/users/${id}`)
export const addUser = (data) => http.post('/admin/users', data)
export const updateUser = (data) => http.put('/admin/users', data)
export const deleteUser = (id) => http.delete(`/admin/users/${id}`)
export const updateUserStatus = (id, status) =>
  http.put(`/admin/users/${id}/status`, { status })
export const resetUserPassword = (id) =>
  http.post(`/admin/users/${id}/reset-password`)
