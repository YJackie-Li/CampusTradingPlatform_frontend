<script setup>
import { computed } from 'vue'

/**
 * 订单资金状态徽标（v3 支付升级）。
 *
 * 根据 t_order.status + receive_time 判断当前资金位置。
 * 文案刻意与 orderStatusText 的"订单阶段"区分,避免同框出现两个完全相同的标签：
 *   0 待付款  → 资金在买家
 *   1 待发货  → 平台托管
 *   2 待收货  → 平台托管
 *   3 已完成  → 已结算给卖家
 *   4 已取消  → 资金已退回买家
 *   5 退款中  → 退款处理中（不可推导确切位置,显示中性文案）
 *   6 已退款  → 资金已退买家
 */
const props = defineProps({
  status: { type: Number, required: true },
  receiveTime: { type: String, default: null },
})

const info = computed(() => {
  const s = Number(props.status)
  switch (s) {
    case 0: return { text: '资金在买家', type: 'info' }
    case 1:
    case 2: return { text: '平台托管', type: 'warning' }
    case 3: return { text: '已结算给卖家', type: 'success' }
    case 4: return { text: '资金已退回买家', type: 'info' }
    case 5: return { text: '退款处理中', type: 'danger' }
    case 6: return { text: '资金已退买家', type: 'info' }
    default: return { text: '-', type: 'info' }
  }
})
</script>

<template>
  <el-tag :type="info.type" effect="plain" size="small">
    {{ info.text }}
  </el-tag>
</template>
