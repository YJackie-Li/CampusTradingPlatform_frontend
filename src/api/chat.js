// 即时通讯（模块九） —— 与 docs/api.md v2 对齐的真实 axios 请求
// 实时消息推送见 src/utils/websocket.js（STOMP over SockJS）
import http from './http'
import { onChatMessage, onPresence as onChatPresence } from '@/utils/websocket'

// ===== 用户端 =====
export const getSessionList = () => http.get('/chat/sessions')
export const getMessages = (sessionId, params) =>
  http.get(`/chat/sessions/${sessionId}/messages`, { params })
/**
 * 发送消息。两种调用都接受，避免调用方传错：
 *   sendMessage(sessionId, { type, content })         // 推荐
 *   sendMessage({ sessionId, type, content })        // 老代码误传也能兜底
 */
export const sendMessage = (arg1, arg2) => {
  let sessionId, body
  if (arg1 != null && typeof arg1 === 'object' && 'sessionId' in arg1) {
    const { sessionId: sid, ...rest } = arg1
    sessionId = sid
    body = rest
  } else {
    sessionId = arg1
    body = arg2
  }
  if (sessionId == null) {
    return Promise.reject(new Error('sessionId 不能为空'))
  }
  return http.post(`/chat/sessions/${sessionId}/messages`, body)
}
export const markSessionRead = (sessionId) =>
  http.post(`/chat/sessions/${sessionId}/read`)
export const deleteSession = (sessionId) =>
  http.delete(`/chat/sessions/${sessionId}`)
export const getUnreadCount = () => http.get('/chat/unread-count')
export const getOrCreateSession = (data) => http.post('/chat/sessions', data)

// ===== 管理员端 =====
export const getAdminSessionPage = (params) =>
  http.get('/admin/chat/sessions/page', { params })
export const getAdminChatStats = () => http.get('/admin/chat/stats')
/**
 * 管理员删除整段会话（双端 session 行 + 双方消息）。
 * 普通用户的 deleteSession 只删自己视角那一行，管理员场景下不够用。
 */
export const deleteAdminSession = (sessionId) =>
  http.delete(`/admin/chat/sessions/${sessionId}`)
/**
 * 管理员查看某段会话的消息历史。
 * 必须走管理员版——用户版接口会校验 session.userId == 当前用户 id，
 * 管理员不是任何 session 的归属者，会被 "会话不存在" 拒掉。
 */
export const getAdminMessages = (sessionId, params) =>
  http.get(`/admin/chat/sessions/${sessionId}/messages`, { params })

// ===== 实时消息订阅 =====
// 注册一个回调，每次收到 WebSocket 推送的聊天消息时调用。
// 内部订阅 /user/queue/messages，由 websocket.js 维护。
// 返回一个取消订阅的函数。
export const onMessagePush = (cb) => onChatMessage(cb)

export const offMessagePush = (cb) => {
  // 简化：chat 模块的所有订阅共用一个 listener 池
  // 调用方拿到 onMessagePush 返回的 unsubscribe 函数自行 cancel 即可
  // 这里保留同名导出，避免引用方报错；典型调用方拿到的是 onMessagePush 的返回值
  if (typeof cb === 'function') {
    // noop: 真实取消请使用 onMessagePush 返回的 unsubscribe
  }
}

// 在线状态推送（payload: { userId, online }）
// 内部订阅 /user/queue/presence
export const onPresence = (cb) => onChatPresence(cb)
export const offPresence = (cb) => {
  if (typeof cb === 'function') {
    // noop: 真实取消请使用 onPresence 返回的 unsubscribe
  }
}
