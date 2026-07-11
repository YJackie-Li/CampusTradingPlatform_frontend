import http from './http'

// 登录：POST /api/auth/login
// 请求体：{ username, password, role? }
// 成功响应 data：{ token, userInfo }
export const login = (data) => http.post('/auth/login', data)

// 退出登录：POST /api/auth/logout
export const logoutApi = () => http.post('/auth/logout')

// 注册：POST /api/auth/register
export const register = (data) => http.post('/auth/register', data)

// 忘记密码重置：POST /api/auth/forgot-password
// 请求体：{ username, realName, newPassword, confirmPassword }
// 走校友白名单身份核验，无须登录态
export const forgotPassword = (data) => http.post('/auth/forgot-password', data)
