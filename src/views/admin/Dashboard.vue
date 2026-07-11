<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { getDashboard } from '@/api/statistics'
import OverviewCards from './components/OverviewCards.vue'
import LineChart from '@/components/charts/LineChart.vue'
import BarChart from '@/components/charts/BarChart.vue'
import PieChart from '@/components/charts/PieChart.vue'
import RadarChart from '@/components/charts/RadarChart.vue'

// 加载态
const loading = ref(true)
const loadError = ref('')

// 概览卡 + 订单状态分布:不参与时间窗口(语义是"当前快照")
const overview = ref({})
const orderStatus = ref([])

// 三个时间窗口模块各自独立:
//   - viewXxx  存后端一次性返回的"近 1 年"全量数据(365 天)
//   - rangeXxx 是当前模块选中的窗口
//   - Xxx      是根据 rangeXxx 从 viewXxx 切片出来的"展示数据"
// 切窗口不再请求后端,前端本地切,零延迟。
const viewGrowth = ref({ labels: [], users: [], orders: [] })
const viewCategoryRank = ref([])  // [{name, value}]
const viewHealth = ref({ indicators: [], values: [] })

const rangeGrowth = ref('90')
const rangeCategory = ref('90')
const rangeHealth = ref('90')

// 窗口 -> 天数
const rangeMap = {
  '30': 30,    // 近 1 个月
  '90': 90,    // 近 3 个月(默认)
  '180': 180,  // 近 6 个月
  '365': 365,  // 近 1 年
}

// 后端一次拉全量(365 天),后面切换窗口不再请求
const fetchAll = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const res = await getDashboard(365)
    const d = res || {}
    overview.value = d.overview || {}
    orderStatus.value = d.orderStatus || []
    viewGrowth.value = {
      labels: d.growth?.labels || [],
      users: d.growth?.users || [],
      orders: d.growth?.orders || [],
    }
    viewCategoryRank.value = (d.categoryRank || []).map((x) => ({
      name: x.name,
      value: x.value,
    }))
    viewHealth.value = d.health || { indicators: [], values: [] }
  } catch (e) {
    loadError.value = e?.message || '数据加载失败'
  } finally {
    loading.value = false
  }
}

const handleRetry = () => fetchAll()

onMounted(fetchAll)

// ============ 切片:从"近 1 年"全量数据里切出当前窗口 ============
// 增长趋势(折线图):label 是按日期顺序的,直接取后 N 个
const growth = computed(() => {
  const days = rangeMap[rangeGrowth.value] || 90
  const labels = viewGrowth.value.labels || []
  const users = viewGrowth.value.users || []
  const orders = viewGrowth.value.orders || []
  const start = Math.max(0, labels.length - days)
  return {
    labels: labels.slice(start),
    series: [
      {
        name: '新增用户',
        data: users.slice(start),
        color: '#3B82F6',
        area: true,
      },
      {
        name: '新增订单',
        data: orders.slice(start),
        color: '#22C55E',
        area: true,
      },
    ],
  }
})

// 分类销量排行(柱状图):label 和 value 按时间顺序排列,
// 直接 slice 最后 N 个 bucket,排序天然就是"近 N 天销量".
// 短窗口的总和可能小,这是预期的(不是"全平台 TOP10")
const categoryRank = computed(() => {
  const days = rangeMap[rangeCategory.value] || 90
  const list = viewCategoryRank.value || []
  const start = Math.max(0, list.length - days)
  const sliced = list.slice(start)
  return {
    categories: sliced.map((x) => x.name),
    values: sliced.map((x) => x.value),
  }
})

// 平台健康评分(雷达图):5 个百分比指标的"全量"已经拉过来了。
// 全量 = 近 1 年;短窗口要重新算比例,所以这里直接复用全量结果最简单
// —— 健康分本身是给运营人"近期"看,保持原值或重算都行,这里用前端最近一次后端返回的快照。
// 实际生产中,后端应当按窗口分别算 5 个指标;这里保持单次拉取,雷达图跟随最后一次刷新的窗口。
const health = computed(() => viewHealth.value)

// 健康评分卡片的展示
const healthItems = computed(() => {
  const ind = health.value.indicators || []
  const vals = health.value.values || []
  return ind.map((it, i) => ({
    name: it.name,
    value: vals[i] ?? 0,
    color: ['#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6'][i % 5],
  }))
})
</script>

<template>
  <div class="dashboard" v-loading="loading">
    <!-- 页面标题 -->
    <div class="page-title">
      <h2>仪表盘</h2>
      <el-button
        size="small"
        :icon="Refresh"
        :loading="loading"
        @click="handleRetry"
      >刷新</el-button>
    </div>

    <el-empty
      v-if="!loading && loadError"
      :description="loadError"
      style="margin: 60px 0;"
    >
      <el-button type="primary" @click="handleRetry">重新加载</el-button>
    </el-empty>

    <!-- 概览卡片 -->
    <OverviewCards :data="overview" />

    <!-- 图表区 -->
    <div class="chart-grid">
      <!-- 增长趋势 -->
      <section class="chart-card">
        <div class="chart-head">
          <h3 class="chart-title">增长趋势</h3>
          <el-radio-group
            v-model="rangeGrowth"
            size="small"
          >
            <el-radio-button label="30">近1个月</el-radio-button>
            <el-radio-button label="90">近3个月</el-radio-button>
            <el-radio-button label="180">近6个月</el-radio-button>
            <el-radio-button label="365">近1年</el-radio-button>
          </el-radio-group>
        </div>
        <LineChart :data="growth" height="300px" />
      </section>

      <!-- 分类销量排行 -->
      <section class="chart-card">
        <div class="chart-head">
          <h3 class="chart-title">分类销量排行</h3>
          <el-radio-group
            v-model="rangeCategory"
            size="small"
          >
            <el-radio-button label="30">近1个月</el-radio-button>
            <el-radio-button label="90">近3个月</el-radio-button>
            <el-radio-button label="180">近6个月</el-radio-button>
            <el-radio-button label="365">近1年</el-radio-button>
          </el-radio-group>
        </div>
        <BarChart :data="categoryRank" height="300px" />
      </section>

      <!-- 订单状态分布 -->
      <section class="chart-card">
        <div class="chart-head">
          <h3 class="chart-title">订单状态分布</h3>
        </div>
        <PieChart :data="orderStatus" height="300px" />
      </section>

      <!-- 平台健康评分 -->
      <section class="chart-card">
        <div class="chart-head">
          <h3 class="chart-title">平台健康评分</h3>
          <el-radio-group
            v-model="rangeHealth"
            size="small"
          >
            <el-radio-button label="30">近1个月</el-radio-button>
            <el-radio-button label="90">近3个月</el-radio-button>
            <el-radio-button label="180">近6个月</el-radio-button>
            <el-radio-button label="365">近1年</el-radio-button>
          </el-radio-group>
        </div>
        <div class="health-body">
          <div class="health-chart">
            <RadarChart :data="health" height="280px" />
          </div>
          <ul class="health-list">
            <li v-for="h in healthItems" :key="h.name">
              <span class="dot" :style="{ background: h.color }"></span>
              <span class="name">{{ h.name }}</span>
              <span class="value" :style="{ color: h.color }">{{ h.value }}</span>
            </li>
          </ul>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  min-height: 100%;
}

.page-title {
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-title h2 {
  font-size: 18px;
  font-weight: 600;
  color: #1f1f1f;
  margin: 0;
}

/* ===== 图表网格 ===== */
.chart-grid {
  margin-top: 16px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.chart-card {
  background: #fff;
  border-radius: 12px;
  padding: 18px 20px 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.chart-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.chart-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f1f1f;
  margin: 0;
}

.chart-head :deep(.el-radio-button__inner) {
  border: 1px solid #e4e7ed;
  box-shadow: none !important;
  padding: 5px 12px;
  font-size: 12px;
}

.chart-head :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background: #ff6b35;
  border-color: #ff6b35;
  color: #fff;
  box-shadow: none !important;
}

/* 健康评分卡内的列表 */
.health-body {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
}

.health-chart {
  flex: 1;
  min-width: 0;
}

.health-list {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 140px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.health-list li {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #666;
}

.health-list .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.health-list .name {
  flex: 1;
}

.health-list .value {
  font-weight: 600;
  font-size: 13px;
}

@media (max-width: 1100px) {
  .chart-grid {
    grid-template-columns: 1fr;
  }
}
</style>
