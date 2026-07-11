<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
const props = defineProps({
  data: {
    type: Object,
    required: true,
    // { userCount, userDelta, goodsCount, goodsDelta, orderCount, orderDelta, salesAmount, salesDelta, pendingGoods, pendingOrders }
  },
})

const formatAmount = (v) => {
  if (v == null) return '0'
  const num = Number(v)
  if (num >= 10000) return (num / 10000).toFixed(2) + '万'
  return num.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

// 「待处理退款」卡片可点击：跳到管理员退款管理页
const goRefunds = () => {
  router.push('/admin-home/refunds')
}
</script>

<template>
  <div class="overview-cards">
    <div class="ov-card ov-user">
      <div class="ov-icon">
        <el-icon :size="22"><User /></el-icon>
      </div>
      <div class="ov-body">
        <div class="ov-value">{{ data.userCount ?? 0 }}</div>
        <div class="ov-label">用户数</div>
        <div class="ov-delta" :class="data.userDelta >= 0 ? 'up' : 'down'">
          {{ data.userDelta >= 0 ? '+' : '' }}{{ data.userDelta }}
        </div>
      </div>
    </div>

    <div class="ov-card ov-goods">
      <div class="ov-icon">
        <el-icon :size="22"><Goods /></el-icon>
      </div>
      <div class="ov-body">
        <div class="ov-value">{{ data.goodsCount ?? 0 }}</div>
        <div class="ov-label">商品数</div>
        <div class="ov-delta" :class="data.goodsDelta >= 0 ? 'up' : 'down'">
          {{ data.goodsDelta >= 0 ? '+' : '' }}{{ data.goodsDelta }}
        </div>
      </div>
    </div>

    <div class="ov-card ov-order">
      <div class="ov-icon">
        <el-icon :size="22"><List /></el-icon>
      </div>
      <div class="ov-body">
        <div class="ov-value">{{ data.orderCount ?? 0 }}</div>
        <div class="ov-label">订单数</div>
        <div class="ov-delta" :class="data.orderDelta >= 0 ? 'up' : 'down'">
          {{ data.orderDelta >= 0 ? '+' : '' }}{{ data.orderDelta }}
        </div>
      </div>
    </div>

    <div class="ov-card ov-sales">
      <div class="ov-icon">
        <el-icon :size="22"><Money /></el-icon>
      </div>
      <div class="ov-body">
        <div class="ov-value">¥{{ formatAmount(data.salesAmount) }}</div>
        <div class="ov-label">销售总额</div>
        <div class="ov-delta" :class="data.salesDelta >= 0 ? 'up' : 'down'">
          {{ data.salesDelta >= 0 ? '+' : '' }}{{ data.salesDelta }}%
        </div>
      </div>
    </div>

    <div class="ov-card ov-pending-goods">
      <div class="ov-icon">
        <el-icon :size="22"><Document /></el-icon>
      </div>
      <div class="ov-body">
        <div class="ov-value">{{ data.pendingGoods ?? 0 }}</div>
        <div class="ov-label">待审核商品</div>
      </div>
    </div>

    <div class="ov-card ov-pending-order clickable" @click="goRefunds">
      <div class="ov-icon">
        <el-icon :size="22"><Bell /></el-icon>
      </div>
      <div class="ov-body">
        <div class="ov-value">{{ data.pendingOrders ?? 0 }}</div>
        <div class="ov-label">待处理退款</div>
        <div class="ov-tip">点击处理 →</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overview-cards {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 16px;
}

.ov-card {
  position: relative;
  background: #fff;
  border-radius: 12px;
  padding: 18px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  transition: all 0.25s;
  overflow: hidden;
}

.ov-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--accent, #ff6b35);
  border-radius: 3px 0 0 3px;
}

.ov-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
}

.ov-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-bg, #fff7f2);
  color: var(--accent, #ff6b35);
  flex-shrink: 0;
}

.ov-body {
  flex: 1;
  min-width: 0;
}

.ov-value {
  font-size: 22px;
  font-weight: 700;
  color: #1f1f1f;
  line-height: 1.2;
  letter-spacing: 0.5px;
}

.ov-label {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.ov-delta {
  position: absolute;
  top: 14px;
  right: 16px;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
}

.ov-delta.up {
  color: #22c55e;
  background: rgba(34, 197, 94, 0.1);
}

.ov-delta.down {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.ov-user { --accent: #3b82f6; --accent-bg: rgba(59, 130, 246, 0.1); }
.ov-goods { --accent: #ff6b35; --accent-bg: rgba(255, 107, 53, 0.1); }
.ov-order { --accent: #22c55e; --accent-bg: rgba(34, 197, 94, 0.1); }
.ov-sales { --accent: #f59e0b; --accent-bg: rgba(245, 158, 11, 0.1); }
.ov-pending-goods { --accent: #8b5cf6; --accent-bg: rgba(139, 92, 246, 0.1); }
.ov-pending-order { --accent: #ef4444; --accent-bg: rgba(239, 68, 68, 0.1); }

/* 「待处理退款」卡片可点击 */
.ov-card.clickable { cursor: pointer; }
.ov-card.clickable:hover { box-shadow: 0 6px 18px rgba(239, 68, 68, 0.15); }
.ov-tip {
  font-size: 11px;
  color: var(--accent, #ef4444);
  margin-top: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}
.ov-card.clickable:hover .ov-tip { opacity: 1; }

@media (max-width: 1100px) {
  .overview-cards {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
