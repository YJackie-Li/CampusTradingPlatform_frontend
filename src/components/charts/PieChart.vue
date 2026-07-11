<script setup>
import { computed } from 'vue'
import BaseChart from '../BaseChart.vue'

const props = defineProps({
  // [{ name: '已完成', value: 5 }, ...]
  data: { type: Array, required: true },
  height: { type: String, default: '300px' },
  // 'pie' 饼图 | 'ring' 环形（默认）
  type: { type: String, default: 'ring' },
})

const PALETTE = ['#22C55E', '#F59E0B', '#EF4444', '#9CA3AF', '#3B82F6', '#8B5CF6']

const option = computed(() => {
  const total = props.data.reduce((s, d) => s + d.value, 0)
  return {
    color: PALETTE,
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: '#e4e7ed',
      textStyle: { color: '#333', fontSize: 12 },
      formatter: (p) => {
        const pct = total ? ((p.value / total) * 100).toFixed(2) : 0
        return `${p.name}<br/>数量：${p.value} 单<br/>占比：${pct}%`
      },
    },
    legend: {
      orient: 'vertical',
      right: 20,
      top: 'middle',
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: '#666', fontSize: 12 },
      formatter: (name) => {
        const item = props.data.find((d) => d.name === name)
        if (!item) return name
        const pct = total ? ((item.value / total) * 100).toFixed(2) : 0
        return `${name}  ${pct}%`
      },
    },
    series: [
      {
        type: 'pie',
        radius: props.type === 'ring' ? ['52%', '78%'] : '70%',
        center: ['38%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          position: 'outside',
          formatter: '{b}\n{d}%',
          fontSize: 11,
          color: '#666',
        },
        labelLine: {
          length: 10,
          length2: 8,
          lineStyle: { color: '#cbd5e1' },
        },
        data: props.data,
      },
    ],
  }
})
</script>

<template>
  <BaseChart :option="option" :height="height" />
</template>
