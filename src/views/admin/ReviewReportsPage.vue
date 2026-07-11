<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, Refresh, Bell, ChatLineRound, Box, StarFilled, ChatLineSquare } from '@element-plus/icons-vue'
import {
  getAdminReviewReportPage,
  auditAdminReviewReport,
  getAdminReviewReportCounts,
  reportTargetText,
  reportStatusText,
  reportStatusTagType,
  reporterRoleText,
  REPORT_STATUS,
  REPORT_TARGET,
} from '@/api/reviewReports'

const router = useRouter()

// ===== tabs =====
// - pending: 待处理（status=0）
// - kept:    已保留（status=1）
// - deleted: 已删除（status=2）
// - all:     全部
const activeTab = ref('pending')
const tabOptions = [
  { key: 'pending', label: '待处理', status: 0 },
  { key: 'kept', label: '已保留', status: 1 },
  { key: 'deleted', label: '已删除', status: 2 },
  { key: 'all', label: '全部', status: null },
]

const filters = reactive({
  keyword: '',
  pageNum: 1,
  pageSize: 10,
})

const loading = ref(false)
const list = ref([])
const total = ref(0)
const counts = reactive({ pending: 0, kept: 0, deleted: 0, total: 0 })

const currentTab = computed(
  () => tabOptions.find((t) => t.key === activeTab.value) || tabOptions[0]
)

const fetchCounts = async () => {
  try {
    const c = await getAdminReviewReportCounts()
    Object.assign(counts, c)
  } catch (e) {
    console.warn('加载举报计数失败', e)
  }
}

const fetchList = async () => {
  loading.value = true
  try {
    const tab = currentTab.value
    const res = await getAdminReviewReportPage({
      status: tab.status,
      pageNum: filters.pageNum,
      pageSize: filters.pageSize,
    })
    list.value = res.records
    total.value = res.total
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchCounts()
  fetchList()
})

watch(activeTab, () => {
  filters.pageNum = 1
  fetchList()
})

const handleSearch = () => {
  filters.pageNum = 1
  fetchList()
}
const handleRefresh = () => {
  fetchCounts()
  fetchList()
}
const handlePageChange = (p) => {
  filters.pageNum = p
  fetchList()
}
const handleSizeChange = (s) => {
  filters.pageSize = s
  filters.pageNum = 1
  fetchList()
}

// ===== 仲裁弹窗 =====
const auditDialog = reactive({
  visible: false,
  report: null,
  decision: 'keep', // 'keep' | 'delete'
  remark: '',
  submitting: false,
})
const openAuditDialog = (row) => {
  auditDialog.report = row
  auditDialog.decision = 'keep'
  auditDialog.remark = ''
  auditDialog.visible = true
}
const submitAudit = async () => {
  const dlg = auditDialog
  if (!dlg.remark.trim()) {
    ElMessage.warning('请填写裁决理由')
    return
  }
  dlg.submitting = true
  try {
    await auditAdminReviewReport(dlg.report.id, {
      status: dlg.decision === 'keep'
        ? REPORT_STATUS.KEEP
        : REPORT_STATUS.DELETE,
      auditRemark: dlg.remark.trim(),
    })
    ElMessage.success(
      dlg.decision === 'keep' ? '已保留评价' : '已删除违规内容'
    )
    dlg.visible = false
    fetchCounts()
    fetchList()
  } catch (e) {
    ElMessage.error(e?.message || '操作失败')
  } finally {
    dlg.submitting = false
  }
}

// ===== 详情弹窗 =====
const detailDialog = reactive({
  visible: false,
  report: null,
})
const openDetailDialog = (row) => {
  detailDialog.report = row
  detailDialog.visible = true
}
const goAuditFromDetail = () => {
  const target = detailDialog.report
  detailDialog.visible = false
  if (target) openAuditDialog(target)
}

// 跳到该评价对应的订单（在用户端的订单中心）
const goOrder = (row) => {
  if (!row) return
  router.push(`/user-home/orders?focus=${row.reviewId}`)
}

const timeShort = (s) => (s ? s.slice(0, 16) : '-')

// ===== 局部搜索（前端按 关键词/目标类型 在已分页的数据里再过滤） =====
// 注意：分页接口目前不接 keyword/targetType，故这一层只是简单隐藏，
// 真正查找靠 status 切换 + 后端 future 增强。
</script>

<template>
  <div class="review-reports-page" v-loading="loading">
    <div class="page-title">
      <h2>评价举报管理</h2>
      <div class="title-actions">
        <el-button :icon="Refresh" size="small" @click="handleRefresh">刷新</el-button>
      </div>
    </div>

    <!-- 概览三块 -->
    <div class="summary-row">
      <div class="summary-card summary-warning">
        <div class="summary-icon"><el-icon :size="22"><Bell /></el-icon></div>
        <div class="summary-body">
          <div class="summary-value">{{ counts.pending }}</div>
          <div class="summary-label">待处理</div>
        </div>
      </div>
      <div class="summary-card summary-info">
        <div class="summary-icon"><el-icon :size="22"><ChatLineRound /></el-icon></div>
        <div class="summary-body">
          <div class="summary-value">{{ counts.kept }}</div>
          <div class="summary-label">已保留</div>
        </div>
      </div>
      <div class="summary-card summary-danger">
        <div class="summary-icon"><el-icon :size="22"><ChatLineSquare /></el-icon></div>
        <div class="summary-body">
          <div class="summary-value">{{ counts.deleted }}</div>
          <div class="summary-label">已删除</div>
        </div>
      </div>
    </div>

    <!-- tabs -->
    <div class="tabs-bar">
      <div
        v-for="t in tabOptions"
        :key="t.key"
        class="tab"
        :class="{ active: activeTab === t.key }"
        @click="activeTab = t.key"
      >
        {{ t.label }}
        <span class="tab-count">
          {{
            t.key === 'pending' ? counts.pending
            : t.key === 'kept' ? counts.kept
            : t.key === 'deleted' ? counts.deleted
            : counts.total
          }}
        </span>
      </div>
    </div>

    <!-- 表格 -->
    <el-table
      :data="list"
      stripe
      class="report-table"
      empty-text="暂无举报"
    >
      <el-table-column label="商品" min-width="200">
        <template #default="{ row }">
          <div class="order-cell" @click="goOrder(row)">
            <img v-if="row.goodsCover" :src="row.goodsCover" class="cover" />
            <div v-else class="cover cover-empty">
              <el-icon :size="18" color="#ccc"><Box /></el-icon>
            </div>
            <div class="order-info">
              <div class="order-title">{{ row.goodsTitle || '-' }}</div>
              <div class="order-no">评价 #{{ row.reviewId }}</div>
            </div>
          </div>
        </template>
      </el-table-column>

      <el-table-column label="举报人" width="110">
        <template #default="{ row }">
          <div class="user-cell">
            <div class="user-name">{{ row.reporterNickname || '用户#' + row.reporterId }}</div>
            <div class="user-role">
              <el-tag size="small" effect="plain" type="info">
                {{ reporterRoleText(row.reporterRole) }}
              </el-tag>
            </div>
          </div>
        </template>
      </el-table-column>

      <el-table-column label="目标" width="100">
        <template #default="{ row }">
          <el-tag
            :type="row.targetType === 2 ? 'warning' : 'primary'"
            size="small"
            effect="light"
          >
            {{ reportTargetText(row.targetType) }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column label="被举报内容" min-width="220">
        <template #default="{ row }">
          <div class="target-cell">
            <div class="target-text">
              <template v-if="row.targetType === 2 && !row.replyContentVisible">
                <span class="muted">[回复已被管理员删除]</span>
              </template>
              <template v-else-if="row.targetType === 1 && !row.reviewContentVisible">
                <span class="muted">[评价已被管理员屏蔽]</span>
              </template>
              <template v-else>
                {{ row.targetContent || '（内容为空）' }}
              </template>
            </div>
            <div v-if="row.description" class="target-desc">补充：{{ row.description }}</div>
          </div>
        </template>
      </el-table-column>

      <el-table-column label="举报原因" min-width="160">
        <template #default="{ row }">
          <div class="reason-cell">
            <div class="reason-text">{{ row.reason || '-' }}</div>
          </div>
        </template>
      </el-table-column>

      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="reportStatusTagType(row.status)" size="small" effect="plain">
            {{ reportStatusText(row.status) }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column label="提交时间" width="140">
        <template #default="{ row }">
          <span class="time">{{ timeShort(row.createTime) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.status === 0"
            type="primary"
            size="small"
            round
            @click="openAuditDialog(row)"
          >处理</el-button>
          <div v-else class="final-result">
            <el-tag :type="reportStatusTagType(row.status)" size="small" effect="plain">
              {{ reportStatusText(row.status) }}
            </el-tag>
            <div v-if="row.auditTime" class="final-time">
              {{ timeShort(row.auditTime) }}
            </div>
            <div v-if="row.auditAdminNickname" class="final-by">
              裁决：{{ row.auditAdminNickname }}
            </div>
          </div>
          <div class="op-link">
            <span class="cell-link" @click="openDetailDialog(row)">查看详情</span>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div v-if="total > 0" class="pagination">
      <span class="total">共 {{ total }} 条</span>
      <el-pagination
        v-model:current-page="filters.pageNum"
        v-model:page-size="filters.pageSize"
        :page-sizes="[10, 20, 50]"
        :total="total"
        layout="sizes, prev, pager, next, jumper"
        background
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>

    <el-empty
      v-if="!loading && list.length === 0"
      description="当前 tab 暂无举报记录"
      :image-size="100"
      style="margin-top: 40px;"
    />

    <!-- 详情弹窗 -->
    <el-dialog
      v-model="detailDialog.visible"
      title="举报详情"
      width="560px"
      align-center
    >
      <div v-if="detailDialog.report" class="detail-body">
        <div class="detail-goods">
          <img v-if="detailDialog.report.goodsCover" :src="detailDialog.report.goodsCover" class="detail-cover" />
          <div v-else class="detail-cover detail-cover-empty">
            <el-icon :size="24" color="#ccc"><Box /></el-icon>
          </div>
          <div class="detail-goods-info">
            <div class="detail-goods-title">{{ detailDialog.report.goodsTitle }}</div>
            <div class="detail-meta">
              <span>评价 #{{ detailDialog.report.reviewId }}</span>
              <span class="dot">·</span>
              <span>举报人：{{ detailDialog.report.reporterNickname || '用户#' + detailDialog.report.reporterId }}</span>
              <span class="dot">·</span>
              <span>{{ reporterRoleText(detailDialog.report.reporterRole) }}</span>
            </div>
            <div class="detail-meta">
              <el-tag :type="detailDialog.report.targetType === 2 ? 'warning' : 'primary'" size="small" effect="light">
                {{ reportTargetText(detailDialog.report.targetType) }}
              </el-tag>
              <el-tag :type="reportStatusTagType(detailDialog.report.status)" size="small" effect="plain" style="margin-left: 4px;">
                {{ reportStatusText(detailDialog.report.status) }}
              </el-tag>
            </div>
          </div>
        </div>

        <el-divider />

        <!-- 被举报的内容（被删除则显示提示） -->
        <div class="detail-block">
          <div class="block-label">被举报内容</div>
          <div class="block-content">
            <template v-if="detailDialog.report.targetType === 2 && !detailDialog.report.replyContentVisible">
              <span class="muted">[回复已被管理员删除]</span>
            </template>
            <template v-else-if="detailDialog.report.targetType === 1 && !detailDialog.report.reviewContentVisible">
              <span class="muted">[评价已被管理员屏蔽]</span>
            </template>
            <template v-else>
              {{ detailDialog.report.targetContent || '（内容为空）' }}
            </template>
          </div>
        </div>

        <div class="detail-block">
          <div class="block-label">举报原因</div>
          <div class="block-content">{{ detailDialog.report.reason || '-' }}</div>
        </div>

        <div v-if="detailDialog.report.description" class="detail-block">
          <div class="block-label">补充说明</div>
          <div class="block-content">{{ detailDialog.report.description }}</div>
        </div>

        <!-- 裁决记录 -->
        <div v-if="detailDialog.report.auditBy" class="detail-block">
          <div class="block-label">
            管理员裁决
            <span v-if="detailDialog.report.auditTime" class="block-time">
              {{ timeShort(detailDialog.report.auditTime) }}
            </span>
          </div>
          <div class="block-content admin">
            <div>{{ detailDialog.report.auditRemark || '（无备注）' }}</div>
            <div class="block-by">裁决人：{{ detailDialog.report.auditAdminNickname || ('管理员#' + detailDialog.report.auditBy) }}</div>
          </div>
        </div>

        <div class="detail-foot">
          提交时间：{{ timeShort(detailDialog.report.createTime) }}
        </div>
      </div>
      <template #footer>
        <el-button @click="detailDialog.visible = false">关闭</el-button>
        <el-button
          v-if="detailDialog.report && detailDialog.report.status === 0"
          type="primary"
          @click="goAuditFromDetail"
        >去处理 →</el-button>
      </template>
    </el-dialog>

    <!-- 仲裁弹窗 -->
    <el-dialog
      v-model="auditDialog.visible"
      title="评价举报仲裁"
      width="520px"
      align-center
      :close-on-click-modal="false"
    >
      <div v-if="auditDialog.report" class="audit-body">
        <div class="info-row">
          <span class="label">商品</span>
          <span class="value">{{ auditDialog.report.goodsTitle }}</span>
        </div>
        <div class="info-row">
          <span class="label">举报人</span>
          <span class="value">
            {{ auditDialog.report.reporterNickname || ('用户#' + auditDialog.report.reporterId) }}
            <span class="muted">（{{ reporterRoleText(auditDialog.report.reporterRole) }}）</span>
          </span>
        </div>
        <div class="info-row">
          <span class="label">举报目标</span>
          <span class="value">
            <el-tag :type="auditDialog.report.targetType === 2 ? 'warning' : 'primary'" size="small" effect="light">
              {{ reportTargetText(auditDialog.report.targetType) }}
            </el-tag>
          </span>
        </div>
        <div class="info-row">
          <span class="label">举报原因</span>
          <span class="value">{{ auditDialog.report.reason }}</span>
        </div>
        <div v-if="auditDialog.report.description" class="info-row">
          <span class="label">补充说明</span>
          <span class="value">{{ auditDialog.report.description }}</span>
        </div>
        <div class="info-row block-target">
          <span class="label">被举报内容</span>
          <span class="value block-target-text">
            <template v-if="auditDialog.report.targetType === 2 && !auditDialog.report.replyContentVisible">
              <span class="muted">[回复已被管理员删除]</span>
            </template>
            <template v-else-if="auditDialog.report.targetType === 1 && !auditDialog.report.reviewContentVisible">
              <span class="muted">[评价已被管理员屏蔽]</span>
            </template>
            <template v-else>
              {{ auditDialog.report.targetContent || '（内容为空）' }}
            </template>
          </span>
        </div>

        <el-divider />

        <el-radio-group v-model="auditDialog.decision" class="decision-group">
          <el-radio-button value="keep">保留（驳回举报）</el-radio-button>
          <el-radio-button value="delete">删除违规内容</el-radio-button>
        </el-radio-group>

        <el-input
          v-model="auditDialog.remark"
          type="textarea"
          :rows="3"
          :maxlength="255"
          show-word-limit
          placeholder="请填写裁决理由（必填，会展示给买家和卖家）"
          style="margin-top: 14px"
        />
        <div class="hint">
          保留：评价/回复保持原样<br />
          删除：
          <template v-if="auditDialog.report.targetType === 2">仅清空该回复内容</template>
          <template v-else>屏蔽该评价整体</template>
        </div>
      </div>
      <template #footer>
        <el-button @click="auditDialog.visible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="auditDialog.submitting"
          @click="submitAudit"
        >确认裁决</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.review-reports-page { min-height: 100%; }

.page-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.page-title h2 {
  font-size: 18px;
  font-weight: 600;
  color: #1f1f1f;
  margin: 0;
}

/* ===== 概览 ===== */
.summary-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}
.summary-card {
  background: #fff;
  border-radius: 12px;
  padding: 18px 22px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  transition: all 0.25s;
  border-left: 3px solid var(--accent);
}
.summary-card:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,0.08); }
.summary-danger { --accent: #ef4444; }
.summary-warning { --accent: #f59e0b; }
.summary-info { --accent: #3b82f6; }
.summary-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
}
.summary-value {
  font-size: 22px;
  font-weight: 700;
  color: #1f1f1f;
  line-height: 1.2;
}
.summary-label {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

/* ===== tabs ===== */
.tabs-bar {
  display: flex;
  gap: 4px;
  padding: 0 4px;
  margin-bottom: 14px;
  border-bottom: 1px solid #f0f2f5;
}
.tab {
  padding: 10px 18px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  position: relative;
  user-select: none;
  transition: color 0.2s;
}
.tab:hover { color: #ff6b35; }
.tab.active { color: #1f1f1f; font-weight: 600; }
.tab.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 18px;
  right: 18px;
  height: 2px;
  background: linear-gradient(90deg, #ff8c5a, #ff6b35);
  border-radius: 2px;
}
.tab-count {
  display: inline-block;
  min-width: 18px;
  padding: 0 6px;
  margin-left: 4px;
  font-size: 11px;
  background: #f5f7fa;
  color: #888;
  border-radius: 9px;
  text-align: center;
  line-height: 18px;
}
.tab.active .tab-count {
  background: linear-gradient(90deg, #ff8c5a, #ff6b35);
  color: #fff;
}

/* ===== 表格 ===== */
.report-table {
  background: #fff;
  border-radius: 12px;
  padding: 8px 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}
.order-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}
.cover {
  width: 44px;
  height: 44px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
  background: #f5f7fa;
}
.cover-empty {
  display: flex;
  align-items: center;
  justify-content: center;
}
.order-info { min-width: 0; }
.order-title {
  font-size: 13px;
  color: #1f1f1f;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}
.order-no { font-size: 11px; color: #999; margin-top: 2px; }

.user-cell { line-height: 1.3; }
.user-name { font-size: 13px; color: #1f1f1f; }
.user-role { font-size: 11px; margin-top: 2px; }

.target-cell { line-height: 1.4; }
.target-text {
  font-size: 13px;
  color: #1f1f1f;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-all;
}
.target-desc {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.muted { color: #aaa; font-style: italic; }

.reason-cell { line-height: 1.4; }
.reason-text { font-size: 13px; color: #1f1f1f; }

.time { font-size: 12px; color: #666; }
.final-result { line-height: 1.4; }
.final-time { font-size: 11px; color: #aaa; margin-top: 2px; }
.final-by { font-size: 11px; color: #888; margin-top: 2px; }
.op-link { margin-top: 6px; }
.cell-link {
  display: inline-block;
  font-size: 11px;
  color: #ff6b35;
  cursor: pointer;
  user-select: none;
}
.cell-link:hover { text-decoration: underline; color: #ff8c5a; }

/* ===== 分页 ===== */
.pagination {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-top: 18px;
  gap: 16px;
}
.total { font-size: 13px; color: #666; }
.pagination :deep(.el-pager li.is-active) {
  background: linear-gradient(135deg, #ff8c5a, #ff6b35) !important;
  color: #fff !important;
}

/* ===== 弹窗 ===== */
.audit-body { font-size: 14px; }
.audit-body .info-row {
  display: flex;
  padding: 7px 0;
  border-bottom: 1px dashed #f0f2f5;
}
.audit-body .info-row .label {
  width: 80px;
  color: #888;
  flex-shrink: 0;
}
.audit-body .info-row .value { flex: 1; color: #1f1f1f; word-break: break-all; }
.block-target-text {
  display: inline-block;
  padding: 8px 10px;
  background: #fafbfc;
  border: 1px solid #f0f2f5;
  border-radius: 6px;
  max-height: 120px;
  overflow-y: auto;
  white-space: pre-wrap;
}
.decision-group { display: flex; flex-wrap: wrap; gap: 8px; }
.decision-group :deep(.el-radio-button__inner) { width: 200px; }
.hint {
  font-size: 12px;
  color: #999;
  margin-top: 8px;
  line-height: 1.6;
}

/* ===== 详情弹窗 ===== */
.detail-body { font-size: 14px; }
.detail-goods {
  display: flex;
  gap: 12px;
  align-items: center;
}
.detail-cover {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  object-fit: cover;
  background: #f5f7fa;
  flex-shrink: 0;
}
.detail-cover-empty {
  display: flex;
  align-items: center;
  justify-content: center;
}
.detail-goods-info { flex: 1; min-width: 0; }
.detail-goods-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f1f1f;
  margin-bottom: 6px;
  word-break: break-all;
}
.detail-meta {
  font-size: 12px;
  color: #888;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 2px;
}
.detail-meta .dot { color: #ddd; }
.detail-block { margin-top: 14px; }
.block-label {
  font-size: 12px;
  color: #888;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.block-time { color: #bbb; font-size: 11px; }
.block-content {
  font-size: 13px;
  color: #1f1f1f;
  line-height: 1.7;
  background: #fafbfc;
  border: 1px solid #f0f2f5;
  border-radius: 6px;
  padding: 10px 12px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 220px;
  overflow-y: auto;
}
.block-content.admin {
  background: #f0f9ff;
  border-color: #bae0ff;
  color: #0050b3;
}
.block-by {
  font-size: 11px;
  color: #888;
  margin-top: 4px;
}
.detail-foot {
  margin-top: 16px;
  padding-top: 10px;
  border-top: 1px dashed #f0f2f5;
  font-size: 12px;
  color: #aaa;
  text-align: right;
}

@media (max-width: 1100px) {
  .summary-row { grid-template-columns: 1fr; }
  .decision-group :deep(.el-radio-button__inner) { width: 160px; }
}
</style>
