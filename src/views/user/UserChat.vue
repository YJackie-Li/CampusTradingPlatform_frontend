<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Picture, MagicStick } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { uploadFile } from '@/api/common'
import {
  getSessionList,
  getMessages,
  sendMessage,
  markSessionRead,
  getOrCreateSession,
  onMessagePush,
  offMessagePush,
  onPresence,
  offPresence,
} from '@/api/chat'
import ImageViewer from '@/components/ImageViewer.vue'

const route = useRoute()
const userStore = useUserStore()

// 数据
const sessions = ref([])
const currentSessionId = ref(null)
const messages = ref([])
const inputText = ref('')
const sending = ref(false)
const uploading = ref(false)
const loadingSessions = ref(false)
const loadingMessages = ref(false)

// UI 状态
const imageViewerOpen = ref(false)
const imageViewerSrc = ref('')
const emojiPickerOpen = ref(false)
const mobileView = ref('list') // 'list' | 'chat'
const messagesRef = ref(null)

// 表情库
const EMOJI_LIST = [
  '😀','😂','😍','🥰','😊','😎','🤩','👍',
  '👎','🙏','💪','✨','🔥','❤️','🎉','✅',
  '❓','😢','😡','🤔','🙄','😴','🤗','🤭',
]

const currentSession = computed(
  () => sessions.value.find((s) => s.id === currentSessionId.value) || null
)

const meNickname = computed(() => userStore.userInfo?.nickname || '我')
const meAvatar = computed(() => userStore.userInfo?.avatar || '')
// 当前真实登录用户 id（用于判断消息属于"我"还是"对端"，之前模板里硬写了 1001 这个魔法数）
const currentUserId = computed(() => Number(userStore.userInfo?.id) || 0)

// ===== 工具 =====
const shortTime = (t) => {
  if (!t) return ''
  const m = String(t).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
  if (m) return `${m[2]}-${m[3]} ${m[4]}:${m[5]}`
  return t
}

const previewOf = (last) => {
  if (!last) return ''
  if (last.type === 'image') return '[图片]'
  if (last.type === 'emoji') return '[表情]'
  return last.content
}

const scrollToBottom = () => {
  const el = messagesRef.value
  if (el) el.scrollTop = el.scrollHeight
}

// ===== 加载 =====
const loadSessions = async () => {
  loadingSessions.value = true
  try {
    const res = await getSessionList()
    // /api/chat/sessions 后端返回的是裸 List，不是 PageResult；
    // 写成容错的兼容两种形状，避免会话渲染不出来卡在"选择会话"空态
    const list = Array.isArray(res)
      ? res
      : (res?.records ?? [])
    // 按"最后消息时间"倒序排：后端虽按 update_time 排，但 update_time 会被"标记已读"
    // 等无关操作刷新，前端按 lastMessage.createTime 再排一次保证"刚聊过的置顶"
    sessions.value = list.slice().sort((a, b) => {
      const at = a.lastMessage?.createTime ? new Date(a.lastMessage.createTime).getTime() : 0
      const bt = b.lastMessage?.createTime ? new Date(b.lastMessage.createTime).getTime() : 0
      if (bt !== at) return bt - at
      // 兜底：没消息时按 updateTime 倒序
      return new Date(b.updateTime || 0).getTime() - new Date(a.updateTime || 0).getTime()
    })
  } finally {
    loadingSessions.value = false
  }
}

const selectSession = async (sessionId) => {
  if (!sessionId) return
  currentSessionId.value = sessionId
  mobileView.value = 'chat'
  loadingMessages.value = true
  try {
    const res = await getMessages(sessionId)
    messages.value = res?.records ?? []
    await nextTick()
    scrollToBottom()
    // 静默标记已读
    await markSessionRead(sessionId)
    // 刷新会话列表（更新未读数 / lastMessage）
    await loadSessions()
  } finally {
    loadingMessages.value = false
  }
}

// ===== 发送 =====
// 共用：先乐观地把消息推进 messages（自己发的立刻看到，不依赖后端返回非空）；
// 后端响应回来后用真实 VO（带自增 id）替换占位消息，保证后续 push 的 sid / id 都对得上。
const sendOptimistic = async (type, content) => {
  const session = currentSession.value
  if (!session) return
  const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const me = userStore.userInfo || {}
  const optimistic = {
    id: tempId,
    sessionId: session.id,
    senderId: currentUserId.value || me.id,
    senderNickname: me.nickname || me.username || '我',
    receiverId: session.peerId,
    type,
    content,
    isRead: 0,
    createTime: new Date().toISOString(),
    __optimistic: true,
  }
  messages.value.push(optimistic)
  await nextTick()
  scrollToBottom()
  try {
    const real = await sendMessage(session.id, { type, content })
    if (real && real.id != null) {
      const idx = messages.value.findIndex((m) => m.id === tempId)
      if (idx >= 0) messages.value.splice(idx, 1, real)
    }
    await loadSessions()
  } catch (err) {
    // 发送失败：把乐观消息标红/移除，避免错觉
    const idx = messages.value.findIndex((m) => m.id === tempId)
    if (idx >= 0) messages.value.splice(idx, 1)
    ElMessage.error(err?.message || '发送失败')
    throw err
  }
}

const sendCurrent = async () => {
  const text = inputText.value.trim()
  if (!text || !currentSession.value) return
  sending.value = true
  inputText.value = ''
  try {
    await sendOptimistic('text', text)
  } finally {
    sending.value = false
  }
}

const sendEmoji = async (emoji) => {
  if (!currentSession.value) return
  emojiPickerOpen.value = false
  await sendOptimistic('emoji', emoji)
}

const onPickImage = async (e) => {
  const file = e.target.files?.[0]
  e.target.value = '' // 清空，允许重复选同一文件
  if (!file || !currentSession.value) return
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.warning('图片不能超过 2MB')
    return
  }
  uploading.value = true
  try {
    // 1) 之前 readAsDataURL 把 base64 整段塞到 content，超 MySQL TEXT（64KB）和
    //    SockJS 单帧缓冲上限，后端 convertAndSendToUser 抛异常被吞掉，对方收不到
    // 2) 后端已配 /static/upload/** 静态映射 + Vite dev 代理，URL 直接当 <img src> 即可
    const up = await uploadFile(file, 'chat')
    await sendOptimistic('image', up.url)
  } catch (err) {
    ElMessage.error(err?.message || '图片发送失败')
  } finally {
    uploading.value = false
  }
}

// ===== 推送处理 =====
// 入参就是后端 push 来的 ChatMessageVO；上一版误写成 (sessionId, msg)
// 两个形参，可 onMessagePush 只传 1 个，导致 object === number 永远 false ——
// 新消息永远不会自动追加到当前会话窗口、markSessionRead 也不会被推送触发。
//
// 重要：会话表是双端冗余，A 视角的 sessionId=1，B 视角的 sessionId=2，
// 是两条不同的行。A 发消息时 m.sessionId = 1（不是 B 自己的 2）。
// 推过来时不能直接拿 msg.sessionId 跟 currentSessionId.value 比，否则永远不等。
// 正确做法：拿 msg.senderId 在当前用户的 sessions 里反查"和发送方对应的那条本地 session"，
// 再跟 currentSessionId 比较。
const handlePushedMessage = async (msg) => {
  const senderId = Number(msg?.senderId)
  // 反查本地视角下"和这个 sender 对话的那条 session"
  const mine = sessions.value.find((s) => Number(s.peerId) === senderId)
  const mySid = Number(mine?.id) || null
  if (mySid && mySid === Number(currentSessionId.value)) {
    messages.value.push(msg)
    await markSessionRead(mySid)
    await nextTick()
    scrollToBottom()
  }
  // 任意推送都刷新会话列表（更新最后一条 + 未读数 / 新会话也要出现）
  await loadSessions()
}

// 对端用户上下线时由后端 broadcastPresence 推过来。
// payload: { userId: number, online: boolean }
// 当前用户的 sessions 里每条 session 的 online 字段就是"我看的那个 peer 在不在"，
// 所以后端在 connect/disconnect 时直接改了 t_chat_session.online，我们只拉一次就行。
const handlePresence = async (payload) => {
  if (!payload || payload.userId == null) return
  await loadSessions()
}

// ===== 图片预览（共享 ImageViewer：滚轮缩放 / 拖拽平移 / Esc 关闭） =====
const openLightbox = (src) => {
  imageViewerSrc.value = src
  imageViewerOpen.value = true
}

// ===== 移动端返回 =====
const backToList = () => {
  mobileView.value = 'list'
}

// ===== 生命周期 =====
onMounted(async () => {
  await loadSessions()

  const { sessionId, peerId, goodsId, goodsTitle, goodsCover } = route.query
  if (sessionId) {
    await selectSession(Number(sessionId))
  } else if (peerId) {
    // 不能跟自己开新会话；后端会拒绝并返回 "对方用户 id 无效"，
    // 这里提前拦下，避免一次没必要的往返 + 给个更清楚的提示
    if (userStore.userInfo?.id && Number(peerId) === Number(userStore.userInfo.id)) {
      ElMessage.warning('不能与自己聊天')
    } else {
      const res = await getOrCreateSession({
        peerId: Number(peerId),
        goodsId,
        goodsTitle,
        goodsCover,
      })
      if (res) {
        await loadSessions()
        await selectSession(res.id)
      }
    }
  } else if (sessions.value.length) {
    await selectSession(sessions.value[0].id)
  }

  onMessagePush(handlePushedMessage)
  // 对端上下线推送过来时刷一遍 session 列表，让聊天框头部和会话列表的
  // 在线/离线 pill 实时变化。后端 ChatWsController 的 broadcastPresence 会
  // 把"X 上线/下线"事件推给所有跟 X 有过会话的在线用户。
  onPresence(handlePresence)
  // ImageViewer 内部自行管理 Esc / 方向键 / +- 快捷键，无需在 document 上挂全局监听
})

onBeforeUnmount(() => {
  offMessagePush()
  offPresence()
})
</script>

<template>
  <div class="chat-page">
    <div class="chat-card">
      <!-- ============ 左侧：会话列表 ============ -->
      <aside class="session-list" v-show="mobileView === 'list'">
        <header class="list-header">
          <span class="list-title">消息</span>
          <span class="list-count">{{ sessions.length }}</span>
        </header>
        <div class="list-body" v-loading="loadingSessions">
          <el-empty
            v-if="!loadingSessions && sessions.length === 0"
            description="暂无消息"
            :image-size="80"
          />
          <div
            v-for="s in sessions"
            :key="s.id"
            class="session-item"
            :class="{ active: s.id === currentSessionId }"
            @click="selectSession(s.id)"
          >
            <span class="active-bar" v-if="s.id === currentSessionId"></span>
            <el-avatar :size="40" :src="s.peerAvatar">
              {{ (s.peerNickname || '?').slice(0, 1) }}
            </el-avatar>
            <div class="session-main">
              <div class="row-1">
                <span class="nickname">{{ s.peerNickname }}</span>
                <span class="time">{{ shortTime(s.lastMessage?.createTime || s.updateTime) }}</span>
              </div>
              <div class="row-2">
                <span class="preview">{{ previewOf(s.lastMessage) }}</span>
                <span v-if="s.blocked" class="blocked-tag">屏蔽{{ s.blocked ? 2 : '' }}</span>
                <span v-if="s.unreadCount > 0" class="unread-badge">
                  {{ s.unreadCount > 99 ? '99+' : s.unreadCount }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- ============ 右侧：聊天窗口 ============ -->
      <section class="chat-pane" v-show="mobileView === 'chat'">
        <template v-if="currentSession">
          <header class="chat-header">
            <el-icon class="back-btn" @click="backToList">
              <ArrowLeft />
            </el-icon>
            <el-avatar :size="36" :src="currentSession.peerAvatar">
              {{ (currentSession.peerNickname || '?').slice(0, 1) }}
            </el-avatar>
            <div class="peer-meta">
              <div class="peer-name">{{ currentSession.peerNickname }}</div>
            </div>
            <div class="online-pill" :class="{ 'online-pill--offline': !currentSession.online }">
              <span class="online-dot"></span>
              <span>{{ currentSession.online ? '在线' : '离线' }}</span>
            </div>
          </header>

          <div class="messages" ref="messagesRef" v-loading="loadingMessages">
            <div
              v-for="m in messages"
              :key="m.id"
              class="msg-row"
              :class="m.senderId === currentUserId ? 'me' : 'peer'"
            >
              <!-- 对端消息（左侧） -->
              <template v-if="m.senderId !== currentUserId">
                <el-avatar :size="36" :src="currentSession.peerAvatar">
                  {{ (currentSession.peerNickname || '?').slice(0, 1) }}
                </el-avatar>
                <div class="msg-stack">
                  <div class="sender-name">{{ m.senderNickname }}</div>
                  <div class="bubble">
                    <img
                      v-if="m.type === 'image'"
                      :src="m.content"
                      class="bubble-img"
                      @click="openLightbox(m.content)"
                      alt="img"
                    />
                    <span v-else-if="m.type === 'emoji'" class="bubble-emoji">{{ m.content }}</span>
                    <span v-else>{{ m.content }}</span>
                  </div>
                  <div class="msg-time">{{ shortTime(m.createTime) }}</div>
                </div>
              </template>
              <!-- 我的消息（右侧） -->
              <template v-else>
                <div class="msg-stack me">
                  <div class="bubble me-bubble">
                    <img
                      v-if="m.type === 'image'"
                      :src="m.content"
                      class="bubble-img"
                      @click="openLightbox(m.content)"
                      alt="img"
                    />
                    <span v-else-if="m.type === 'emoji'" class="bubble-emoji">{{ m.content }}</span>
                    <span v-else>{{ m.content }}</span>
                  </div>
                  <div class="msg-time">{{ shortTime(m.createTime) }}</div>
                </div>
                <el-avatar :size="36" :src="meAvatar">
                  {{ meNickname.slice(0, 1) }}
                </el-avatar>
              </template>
            </div>
          </div>

          <!-- 表情选择器 -->
          <transition name="picker-fade">
            <div v-if="emojiPickerOpen" class="emoji-picker">
              <div
                v-for="e in EMOJI_LIST"
                :key="e"
                class="emoji-cell"
                @click="sendEmoji(e)"
              >{{ e }}</div>
            </div>
          </transition>

          <footer class="chat-footer">
            <button
              class="footer-icon"
              :class="{ active: emojiPickerOpen }"
              @click="emojiPickerOpen = !emojiPickerOpen"
              title="表情"
            >
              <el-icon :size="18"><MagicStick /></el-icon>
            </button>
            <label class="footer-icon" :class="{ disabled: uploading }" title="图片">
              <el-icon :size="18"><Picture /></el-icon>
              <input
                type="file"
                hidden
                accept="image/*"
                :disabled="uploading"
                @change="onPickImage"
              />
            </label>
            <input
              v-model="inputText"
              class="footer-input"
              placeholder="输入消息..."
              @keydown.enter="sendCurrent"
              :disabled="!currentSession || sending"
            />
            <button
              class="send-btn"
              :disabled="!inputText.trim() || sending"
              @click="sendCurrent"
            >发送</button>
          </footer>
        </template>
        <div v-else class="empty-chat">
          <el-empty description="选择一个会话开始聊天" :image-size="120" />
        </div>
      </section>
    </div>

    <!-- ============ 图片预览（共享 ImageViewer：滚轮缩放 / 拖拽平移） ============ -->
    <ImageViewer
      v-model="imageViewerOpen"
      :src="imageViewerSrc"
      alt="聊天图片"
    />
  </div>
</template>

<style scoped>
.chat-page {
  width: 100%;
}

/* ========== 主卡片 ========== */
.chat-card {
  display: flex;
  max-width: 1100px;
  margin: 18px auto 24px;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  height: calc(100vh - 220px);
  min-height: 540px;
}

/* ========== 左侧会话列表 ========== */
.session-list {
  width: 320px;
  flex-shrink: 0;
  border-right: 1px solid #f0f2f5;
  display: flex;
  flex-direction: column;
  background: #fff;
}
.list-header {
  padding: 18px 20px 14px;
  border-bottom: 1px solid #f0f2f5;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.list-title {
  font-weight: 700;
  font-size: 16px;
  color: #1f1f1f;
}
.list-count {
  color: #999;
  font-size: 13px;
}
.list-body {
  flex: 1;
  overflow-y: auto;
}
.session-item {
  position: relative;
  display: flex;
  gap: 12px;
  padding: 14px 16px 14px 22px;
  cursor: pointer;
  transition: background 0.15s;
}
.session-item:hover {
  background: #fafbfc;
}
.session-item.active {
  background: #eaf4ff;
}
.active-bar {
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 3px;
  background: linear-gradient(180deg, #5b9bff, #3a7be6);
  border-radius: 0 2px 2px 0;
}
.session-main {
  flex: 1;
  min-width: 0;
}
.row-1 {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.nickname {
  font-weight: 600;
  font-size: 14px;
  color: #1f1f1f;
}
.time {
  font-size: 11px;
  color: #aaa;
}
.row-2 {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
}
.preview {
  font-size: 12px;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 170px;
}
.blocked-tag {
  font-size: 11px;
  background: #fff3f0;
  color: #ff6b35;
  padding: 1px 6px;
  border-radius: 3px;
  margin-right: 4px;
}
.unread-badge {
  background: #ff4d4f;
  color: #fff;
  border-radius: 999px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* ========== 右侧聊天窗口 ========== */
.chat-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #fff;
}

.chat-header {
  padding: 14px 22px;
  border-bottom: 1px solid #f0f2f5;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.back-btn {
  display: none;
  cursor: pointer;
  color: #555;
}
.peer-meta {
  flex: 1;
  min-width: 0;
}
.peer-name {
  font-weight: 600;
  font-size: 15px;
  color: #1f1f1f;
}
.online-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #19be6b;
  font-weight: 500;
}
.online-pill--offline {
  color: #909399;
}
.online-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #19be6b;
  box-shadow: 0 0 0 3px rgba(25, 190, 107, 0.15);
}
.online-pill--offline .online-dot {
  background: #c0c4cc;
  box-shadow: 0 0 0 3px rgba(192, 196, 204, 0.15);
}

/* ========== 消息流 ========== */
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 22px 26px;
  background: #fafbfc;
}
.msg-row {
  display: flex;
  gap: 10px;
  margin-bottom: 22px;
}
.msg-row.peer {
  justify-content: flex-start;
}
.msg-row.me {
  justify-content: flex-end;
}
.msg-stack {
  display: flex;
  flex-direction: column;
  max-width: 70%;
}
.msg-stack.me {
  align-items: flex-end;
}
.sender-name {
  font-size: 11px;
  color: #999;
  margin-bottom: 4px;
  margin-left: 2px;
}
.bubble {
  display: inline-block;
  padding: 10px 14px;
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 10px;
  font-size: 14px;
  color: #1f1f1f;
  max-width: 100%;
  word-break: break-word;
  line-height: 1.5;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
}
.bubble.me-bubble {
  background: #1f1f1f;
  color: #fff;
  border-color: #1f1f1f;
}
.bubble-img {
  display: block;
  max-width: 220px;
  max-height: 220px;
  border-radius: 6px;
  cursor: zoom-in;
}
.bubble-emoji {
  font-size: 32px;
  line-height: 1;
  padding: 4px 0;
}
.msg-time {
  font-size: 11px;
  color: #bbb;
  margin-top: 4px;
}

/* ========== 输入区 ========== */
.chat-footer {
  padding: 12px 16px;
  border-top: 1px solid #f0f2f5;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  background: #fff;
  position: relative;
}
.footer-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #fff5e6;
  color: #ff8c5a;
  cursor: pointer;
  border: none;
  flex-shrink: 0;
  transition: background 0.2s, color 0.2s, transform 0.1s;
}
.footer-icon:hover {
  transform: scale(1.05);
}
.footer-icon.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}
.footer-icon.active {
  background: linear-gradient(135deg, #ff8c5a, #ff6b35);
  color: #fff;
}
.footer-input {
  flex: 1;
  height: 36px;
  padding: 0 14px;
  border: 1px solid #e4e7ed;
  border-radius: 999px;
  background: #f5f7fa;
  outline: none;
  font-size: 14px;
  color: #1f1f1f;
  transition: background 0.2s, border-color 0.2s;
}
.footer-input:focus {
  background: #fff;
  border-color: #ff8c5a;
}
.footer-input:disabled {
  background: #f5f7fa;
  color: #aaa;
}
.send-btn {
  height: 36px;
  padding: 0 22px;
  border-radius: 999px;
  border: none;
  background: #1f1f1f;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  flex-shrink: 0;
  transition: background 0.2s, opacity 0.2s;
}
.send-btn:disabled {
  background: #e4e7ed;
  color: #999;
  cursor: not-allowed;
}
.send-btn:not(:disabled):hover {
  background: #2c2c2c;
}

/* ========== 表情面板 ========== */
.emoji-picker {
  position: absolute;
  bottom: 64px;
  left: 22px;
  width: 300px;
  padding: 10px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  display: grid;
  /* minmax(0, 1fr)：列默认 min-content，遇到宽字形 emoji（👍/🎉/❤️ 等）
     会被撑爆。把 min 压到 0，1fr 才能按父容器宽度均分，emoji 留在 cell 里 */
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 4px;
  z-index: 10;
  /* 双保险：万一真有极端宽字形，也不让它冲到圆角外面去 */
  overflow: hidden;
}
.emoji-cell {
  font-size: 22px;
  text-align: center;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
  /* 让 flex/grid 子项能小于内容宽度，否则 min-content 还是会撑列 */
  min-width: 0;
  overflow: hidden;
}
.emoji-cell:hover {
  background: #f5f7fa;
}
.picker-fade-enter-active,
.picker-fade-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}
.picker-fade-enter-from,
.picker-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

/* ========== 空态 ========== */
.empty-chat {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ========== 旧 Lightbox 已废弃 ========== */
/* 复用共享组件 @/components/ImageViewer.vue（缩放 / 拖拽 / 键盘快捷键都在那边统一实现） */

/* ========== 响应式 ========== */
/* 桌面端：左右两栏同时显示（左侧会话列表始终可见）
   必须用 !important 覆盖 v-show="mobileView === 'chat'" 设的 display:none，
   否则开聊后整个左栏会被收起。 */
@media (min-width: 801px) {
  .session-list {
    display: flex !important;
  }
}
@media (max-width: 800px) {
  .chat-card {
    flex-direction: column;
    height: auto;
    min-height: 500px;
  }
  .session-list {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid #f0f2f5;
    max-height: 50vh;
  }
  .back-btn {
    display: inline-block;
  }
  .chat-pane {
    min-height: 60vh;
  }
}
</style>