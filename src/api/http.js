import axios from 'axios'
import { ElMessage } from 'element-plus'
import { getToken, clearAuth } from '@/utils/auth-storage'

// 与后端 Result.success 的 code 一致（ResultCode.SUCCESS = 200）
const SUCCESS_CODE = 200

const http = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

// 请求拦截器：从 sessionStorage（按标签隔离）取出 JWT 注入 Authorization
http.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// 响应拦截器：拆包 + 统一错误提示
// - 业务成功：直接返回 res.data.data，方便上层 res.data.data 写法
// - 业务失败 / HTTP 失败：toast 后端 message 并 reject
http.interceptors.response.use(
  (res) => {
    const body = res.data
    // 文件下载/二进制等不走 Result 包装的请求，原样放行
    if (body == null || typeof body !== 'object' || !('code' in body)) {
      return body
    }
    if (body.code === SUCCESS_CODE) {
      return body.data
    }
    ElMessage.error(body.message || '请求失败')
    return Promise.reject(new Error(body.message || '请求失败'))
  },
  (error) => {
    const status = error.response?.status
    const isLoginReq = error.config?.url?.includes('/auth/login')
    // 401 时清掉本地登录态（但保留发生在登录页本身的 401，让调用方处理）
    if (status === 401 && !isLoginReq) {
      clearAuth()
    }
    // 游客态（本地无 token）触发的 401 不弹 toast —— 没登录访问需要登录的接口属于正常浏览，
    // 比如点了"收藏"按钮或者访问个人中心，由调用方自己决定要不要跳登录页。
    if (status === 401 && !getToken()) {
      return Promise.reject(error)
    }
    const msg =
      error.response?.data?.message ||
      (status === 401 ? '未登录或登录已过期' : null) ||
      error.message ||
      '网络异常'
    ElMessage.error(msg)
    return Promise.reject(error)
  },
)

export default http