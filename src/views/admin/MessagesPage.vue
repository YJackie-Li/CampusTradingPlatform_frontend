<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search,
  RefreshLeft,
  View,
  Delete,
  ChatLineRound,
  ChatDotRound,
  Clock,
  User,
} from '@element-plus/icons-vue'
import {
  getAdminSessionPage,
  getAdminChatStats,
  getAdminMessages,
  deleteAdminSession,
} from '@/api/chat'

const filters = reactive({
  keyword: '',
  pageNum: 1,
  pageSize: 10,
})

const loading = ref(false)
const list = ref([])
const total = ref(0)
const stats = reactive({ total: 0, unreadTotal: 0, todayNew: 0 })

const fetchList = async () => {
  loading.value = true
  try {
    const res = await getAdminSessionPage(filters)
    list.value = res.records
    total.value = res.total
  } finally {
    loading.value = false
  }
}

const fetchStats = async () => {
  try {
    const res = await getAdminChatStats()
    Object.assign(stats, res)
  } catch {
    /* ignore */
  }
}

onMounted(() => {
  fetchList()
  fetchStats()
})

const handleSearch = () => {
  filters.pageNum = 1
  fetchList()
}
const handleReset = () => {
  Object.assign(filters, { keyword: '', pageNum: 1, pageSize: 10 })
  fetchList()
}
const handlePageChange = (page) => {
  filters.pageNum = page
  fetchList()
}
const handleSizeChange = (size) => {
  filters.pageSize = size
  filters.pageNum = 1
  fetchList()
}

// ===== 查看消息弹窗 =====
const dialogVisible = ref(false)
const dialogLoading = ref(false)
const dialogSession = ref(null)
const dialogMessages = ref([])

const openDialog = async (row) => {
  dialogSession.value = row
  dialogMessages.value = []
  dialogVisible.value = true
  dialogLoading.value = true
  try {
    const res = await getAdminMessages(row.id, { pageNum: 1, pageSize: 200 })
    dialogMessages.value = res.records || []
  } catch (e) {
    // 拦截器已 toast；这里把消息清空，避免展示假"暂无消息"
    dialogMessages.value = []
  } finally {
    dialogLoading.value = false
  }
}

// ===== 删除会话 =====
const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除会话「${row.userNickname || `用户#${row.userId}`} ↔ ${row.peerNickname || `用户#${row.peerId}`}」吗？该操作不可恢复。`,
      '删除会话',
      { type: 'error', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  try {
    await deleteAdminSession(row.id)
    ElMessage.success('已删除会话')
    fetchList()
    fetchStats()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || '删除失败')
  }
}

// ===== 工具方法 =====
const shortTime = (t) => {
  if (!t) return ''
  const m = String(t).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
  if (m) return `${m[2]}-${m[3]} ${m[4]}:${m[5]}`
  return t
}

const previewContent = (last) => {
  if (!last) return '（暂无消息）'
  if (last.type === 'image') return '[图片]'
  if (last.type === 'emoji') return last.content
  return last.content
}

// 当前会话消息是否来自对方
const isPeer = (m, session) => session && m.senderId === session.peerId
</script>

<template>
  <div class="page-container">
    <!-- 头部 -->
    <div class="page-header">
      <h2 class="page-title">消息管理</h2>
      <p class="page-desc">查看与管理平台所有用户之间的聊天会话</p>
    </div>

    <!-- 统计卡 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon icon-blue">
          <el-icon :size="22"><ChatLineRound /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ stats.total }}</div>
          <div class="stat-label">总会话数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon icon-red">
          <el-icon :size="22"><ChatDotRound /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ stats.unreadTotal }}</div>
          <div class="stat-label">未读消息</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon icon-orange">
          <el-icon :size="22"><Clock /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ stats.todayNew }}</div>
          <div class="stat-label">今日新增</div>
        </div>
      </div>
    </div>

    <!-- 筛选 -->
    <div class="filter-bar">
      <div class="filter-fields">
        <div class="filter-item">
          <label>用户</label>
          <el-input
            v-model="filters.keyword"
            placeholder="搜索用户昵称 / 用户ID"
            clearable
            class="filter-input"
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>
        <div class="filter-buttons">
          <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
          <el-button :icon="RefreshLeft" @click="handleReset">重置</el-button>
        </div>
      </div>
    </div>

    <!-- 列表 -->
    <div class="data-card">
      <el-table
        v-loading="loading"
        :data="list"
        stripe
        style="width: 100%"
        :header-cell-style="{ background: '#fafbfc', color: '#1f1f1f' }"
      >
        <el-table-column label="会话ID" prop="id" min-width="80" align="center" />
        <el-table-column label="归属者" min-width="160" align="center">
          <template #default="{ row }">
            <div class="user-cell">
              <el-icon :size="14" color="#999"><User /></el-icon>
              <span>{{ row.userNickname || `用户#${row.userId}` }}</span>
              <span class="uid">#{{ row.userId }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="对方" min-width="160" align="center">
          <template #default="{ row }">
            <div class="user-cell">
              <el-icon :size="14" color="#999"><User /></el-icon>
              <span>{{ row.peerNickname || `用户#${row.peerId}` }}</span>
              <span class="uid">#{{ row.peerId }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="最后消息" min-width="240" align="center">
          <template #default="{ row }">
            <span class="last-msg" :title="previewContent(row.lastMessage)">
              {{ previewContent(row.lastMessage) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="未读" min-width="80" align="center">
          <template #default="{ row }">
            <el-badge
              v-if="row.unreadCount > 0"
              :value="row.unreadCount"
              :max="99"
              class="unread-badge"
            />
            <span v-else class="muted">0</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag
              :type="row.blocked ? 'danger' : (row.online ? 'success' : 'info')"
              size="small"
              effect="light"
            >
              {{ row.blocked ? '已屏蔽' : (row.online ? '在线' : '离线') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" min-width="160" align="center">
          <template #default="{ row }">{{ shortTime(row.updateTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" min-width="160" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openDialog(row)">
              <el-icon><View /></el-icon>
              <span>查看消息</span>
            </el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">
              <el-icon><Delete /></el-icon>
              <span>删除</span>
            </el-button>
          </template>
        </el-table-column>

        <template #empty>
          <el-empty description="暂无会话" />
        </template>
      </el-table>

      <div class="pagination">
        <span class="total">共 {{ total }} 条</span>
        <el-pagination
          v-model:current-page="filters.pageNum"
          v-model:page-size="filters.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="sizes, prev, pager, next, jumper"
          background
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </div>

    <!-- 查看消息弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="
        dialogSession
          ? `会话 #${dialogSession.id} · ${dialogSession.userNickname || `用户#${dialogSession.userId}`} ↔ ${dialogSession.peerNickname || `用户#${dialogSession.peerId}`}`
          : '会话消息'
      "
      width="640px"
      align-center
      :close-on-click-modal="false"
    >
      <div v-if="dialogLoading" class="loading-tip">加载中…</div>
      <div v-else-if="dialogMessages.length === 0" class="loading-tip">该会话暂无消息</div>
      <div v-else class="msg-list">
        <div
          v-for="m in dialogMessages"
          :key="m.id"
          class="msg-item"
          :class="{ peer: isPeer(m, dialogSession) }"
        >
          <el-avatar :size="32">
            {{ (m.senderNickname || 'U').slice(0, 1).toUpperCase() }}
          </el-avatar>
          <div class="msg-body">
            <div class="msg-head">
              <span class="sender">{{ m.senderNickname }}</span>
              <span class="time">{{ shortTime(m.createTime) }}</span>
            </div>
            <div class="msg-bubble">
              <img
                v-if="m.type === 'image'"
                :src="m.content"
                class="msg-image"
                alt="image"
              />
              <span v-else-if="m.type === 'emoji'" class="msg-emoji">{{ m.content }}</span>
              <span v-else class="msg-text">{{ m.content }}</span>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-container { min-height: 100%; }

.page-header { margin-bottom: 16px; }
.page-title { font-size: 18px; font-weight: 600; color: #1f1f1f; margin: 0 0 4px; }
.page-desc { font-size: 13px; color: #999; margin: 0; }

/* ========== 统计卡 ========== */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}
@media (max-width: 720px) {
  .stats-row { grid-template-columns: 1fr; }
}
.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}
.stat-icon {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}
.icon-blue { background: linear-gradient(135deg, #6c8cff 0%, #4f7ce0 100%); }
.icon-red { background: linear-gradient(135deg, #ff8c5a 0%, #ff6b35 100%); }
.icon-orange { background: linear-gradient(135deg, #ffc371 0%, #ff8c42 100%); }
.stat-body { display: flex; flex-direction: column; }
.stat-value { font-size: 22px; font-weight: 700; color: #1f1f1f; line-height: 1.2; }
.stat-label { font-size: 12px; color: #999; margin-top: 4px; }

/* ========== 筛选 ========== */
.filter-bar {
  background: #fff;
  border-radius: 12px;
  padding: 14px 20px;
  margin-bottom: 14px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}
.filter-fields {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.filter-item label {
  font-size: 14px;
  color: #1f1f1f;
  font-weight: 500;
  white-space: nowrap;
}
.filter-input { width: 240px; }
.filter-buttons {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

/* ========== 列表 ========== */
.data-card {
  background: #fff;
  border-radius: 12px;
  padding: 18px 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.user-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.uid {
  font-size: 11px;
  color: #bbb;
  background: #f5f7fa;
  padding: 1px 6px;
  border-radius: 4px;
}

.last-msg {
  display: inline-block;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
  color: #555;
}

.unread-badge :deep(.el-badge__content) {
  background: #ff4d4f !important;
  border-color: #fff !important;
}

.muted { color: #ccc; }

/* ========== 分页 ========== */
.pagination {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-top: 16px;
  gap: 16px;
}
.total { font-size: 13px; color: #666; }
.pagination :deep(.el-pager li.is-active) {
  background: linear-gradient(135deg, #ff8c5a 0%, #ff6b35 100%) !important;
  color: #fff !important;
}

/* ========== 消息弹窗 ========== */
.loading-tip {
  text-align: center;
  color: #999;
  padding: 30px 0;
  font-size: 13px;
}

.msg-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 480px;
  overflow-y: auto;
  padding: 4px 4px 4px 0;
}

.msg-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.msg-item.peer { flex-direction: row-reverse; }

.msg-body { max-width: 70%; }
.msg-item.peer .msg-body { text-align: right; }

.msg-head {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 12px;
}
.sender { font-weight: 600; color: #1f1f1f; }
.time { color: #aaa; }

.msg-bubble {
  display: inline-block;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 8px;
  font-size: 13px;
  color: #333;
  line-height: 1.6;
  word-break: break-word;
  text-align: left;
}
.msg-item.peer .msg-bubble {
  background: linear-gradient(135deg, #fff7f2 0%, #ffe8db 100%);
  color: #5c2a14;
}
.msg-image {
  max-width: 240px;
  max-height: 240px;
  border-radius: 6px;
  display: block;
}
.msg-emoji { font-size: 28px; line-height: 1; }
.msg-text { white-space: pre-wrap; }
</style>