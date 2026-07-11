// 用户中心（模块一/三） —— 个人资料、修改资料、修改密码、上传头像
import http from './http'

// 获取当前登录用户的资料
export const getProfile = () => http.get('/user/profile')

// 修改当前登录用户的资料
// patch 字段：nickname / phone / email / school / campus / bio / gender / avatar 等
export const updateProfileApi = (patch) => http.put('/user/profile', patch)

// 修改密码
// { oldPassword, newPassword }
export const changePasswordApi = (data) => http.put('/user/password', data)

// 上传头像（multipart/form-data，字段名 file）
// 不要手动写 Content-Type: multipart/form-data（不带 boundary 时 Tomcat/Spring 会拒收），
// axios 会自动给 FormData 加 boundary。
export const uploadAvatar = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return http.post('/user/avatar', fd)
}
