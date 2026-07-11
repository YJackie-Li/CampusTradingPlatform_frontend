// 聊天 WebSocket 客户端（STOMP over SockJS）
// 后端配置：/ws/chat（JwtHandshakeInterceptor 通过 ?token= 鉴权）
//          broker /topic, /queue; user prefix /user
//          推荐订阅 /user/queue/messages 收私信；/topic/heartbeat 收心跳
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client/dist/sockjs'

let client = null
const messageListeners = new Set()
const stateListeners = new Set()
const presenceListeners = new Set()

const notify = (payload) => messageListeners.forEach((cb) => safeInvoke(cb, payload))
const notifyState = (state) => stateListeners.forEach((cb) => safeInvoke(cb, state))
const notifyPresence = (payload) => presenceListeners.forEach((cb) => safeInvoke(cb, payload))

function safeInvoke(cb, payload) {
  try {
    cb(payload)
  } catch (e) {
    // swallow listener errors so one bad subscriber doesn't break the rest
    console.error('[ws] listener error', e)
  }
}

/**
 * 建立 WebSocket 连接。重复调用会先断开旧连接再重连。
 * @param {string} token - JWT
 * @param {object} [opts]
 * @param {string} [opts.baseUrl] - 默认走 vite 代理 /ws
 */
export function connectChatWs(token, opts = {}) {
  disconnectChatWs()
  if (!token) return null

  // dev: vite 代理会把 /ws/** 透传，所以用相对路径；prod: 用 VITE_WS_BASE
  const base =
    opts.baseUrl ||
    import.meta.env.VITE_WS_BASE ||
    (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : '')

  const sockJsUrl = `${base.replace(/\/$/, '')}/ws/chat?token=${encodeURIComponent(token)}`

  client = new Client({
    webSocketFactory: () => new SockJS(sockJsUrl),
    reconnectDelay: 5000, // 自动重连
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    debug: () => {}, // 静默；需要排查时改成 console.log
  })

  client.onConnect = () => {
    notifyState('connected')
    // 收私信（私聊消息）。后端 ChatWsController / ChatService 推到这里
    client.subscribe('/user/queue/messages', (frame) => {
      try {
        const body = frame.body ? JSON.parse(frame.body) : null
        notify(body)
      } catch (e) {
        console.warn('[ws] bad message frame', e, frame.body)
      }
    })
    // 收在线状态变化：后端 ChatWsController 在用户 WS 上下线时推送
    // payload: { userId: number, online: boolean }
    client.subscribe('/user/queue/presence', (frame) => {
      try {
        const body = frame.body ? JSON.parse(frame.body) : null
        if (body) notifyPresence(body)
      } catch (e) {
        console.warn('[ws] bad presence frame', e, frame.body)
      }
    })
    // 收广播（可选：上下线、心跳）
    client.subscribe('/topic/heartbeat', (frame) => {
      try {
        notify({ __heartbeat: true, ...JSON.parse(frame.body || '{}') })
      } catch {
        /* ignore */
      }
    })
  }
  client.onStompError = (frame) => {
    console.warn('[ws] stomp error', frame.headers?.message, frame.body)
    notifyState('error')
  }
  client.onWebSocketClose = () => notifyState('disconnected')

  client.activate()
  notifyState('connecting')
  return client
}

export function disconnectChatWs() {
  if (client) {
    try {
      client.deactivate()
    } catch {
      /* ignore */
    }
    client = null
    notifyState('disconnected')
  }
}

/** 订阅收到的聊天消息（每条是后端 ChatMessageVO 形状：{ id, sessionId, senderId, ... }） */
export function onChatMessage(cb) {
  messageListeners.add(cb)
  return () => messageListeners.delete(cb)
}

/**
 * 订阅对端用户上下线事件（payload: { userId, online }）。
 * 后端在 SessionConnectedEvent / SessionDisconnectEvent 时批量推送给所有
 * 跟该 userId 有过会话的在线用户，前端一般用它触发 loadSessions() 重新拉数据，
 * 这样会话列表/聊天框头部的在线/离线状态能秒级刷新。
 */
export function onPresence(cb) {
  presenceListeners.add(cb)
  return () => presenceListeners.delete(cb)
}

/** 订阅连接状态变化：'connecting' | 'connected' | 'disconnected' | 'error' */
export function onWsState(cb) {
  stateListeners.add(cb)
  return () => stateListeners.delete(cb)
}
