import http from './http'

export const getAddressList = (params) => http.get('/address/list', { params })
export const getAddress = (id) => http.get(`/address/${id}`)
export const addAddress = (data) => http.post('/address', data)
export const updateAddress = (data) => http.put('/address', data)
export const deleteAddress = (id) => http.delete(`/address/${id}`)
export const setDefaultAddress = (id) => http.put(`/address/${id}/default`)
