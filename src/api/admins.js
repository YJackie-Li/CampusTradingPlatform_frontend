import http from './http'

export const getAdminPage = (params) => http.get('/admin/admins/page', { params })
export const addAdmin = (data) => http.post('/admin/admins', data)
export const updateAdmin = (data) => http.put('/admin/admins', data)
export const deleteAdmin = (id) => http.delete(`/admin/admins/${id}`)
export const updateAdminStatus = (id, status) =>
  http.put(`/admin/admins/${id}/status`, { status })
