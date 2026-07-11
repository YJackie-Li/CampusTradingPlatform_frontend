import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  getProfile,
  updateProfileApi,
  changePasswordApi,
} from '@/api/user'
import { logoutApi } from '@/api/auth'
import { connectChatWs, disconnectChatWs } from '@/utils/websocket'
import { getToken, getUserInfo, setAuth, clearAuth } from '@/utils/auth-storage'

/**
 * 用户状态管理
 * - token / userInfo 持久化在 sessionStorage（按标签页隔离，
 *   解决 "同浏览器多标签登录互相覆盖" 的问题）
 * - login / logout 同步写本地 + 触发 WebSocket 连接/断开
 * - updateProfile / changePassword 接真实后端
 * - fetchProfile 主动从后端拉取最新 userInfo
 */
export const useUserStore = defineStore('user', () => {
  const token = ref(getToken())
  const userInfo = ref(getUserInfo())

  const isLoggedIn = computed(() => !!token.value && !!userInfo.value)
  const role = computed(() => userInfo.value?.role || 'GUEST')
  const isAdmin = computed(() => role.value === 'ADMIN')

  // 内部：把 userInfo 同步到 state + sessionStorage
  const writeUserInfo = (info) => {
    userInfo.value = info
    setAuth(token.value, info)
  }

  // 登录：data = { token, userInfo }
  const login = (data) => {
    token.value = data.token
    setAuth(data.token, data.userInfo)
    writeUserInfo(data.userInfo)
    if (data.token) connectChatWs(data.token)
  }

  // 退出：先调后端（best-effort），再清本地
  const logout = async () => {
    try {
      await logoutApi()
    } catch {
      // 后端 logout 失败也要继续清本地
    }
    disconnectChatWs()
    token.value = ''
    clearAuth()
    userInfo.value = null
  }

  // 主动拉一次最新 profile 并写回（启动刷新 / 登录后兜底）
  const fetchProfile = async () => {
    if (!token.value) return null
    const res = await getProfile()
    writeUserInfo(res)
    return res
  }

  // 修改个人资料：patch 字段对齐 backend UpdateProfileDTO
  // 后端返回更新后的 userInfo；前端用响应刷新本地
  const updateProfile = async (patch) => {
    const updated = await updateProfileApi(patch)
    writeUserInfo(updated)
    return updated
  }

  // 修改密码：{ oldPassword, newPassword }
  const changePassword = async ({ oldPassword, newPassword }) => {
    await changePasswordApi({ oldPassword, newPassword })
  }

  return {
    token,
    userInfo,
    isLoggedIn,
    role,
    isAdmin,
    login,
    logout,
    updateProfile,
    changePassword,
    fetchProfile,
  }
})
