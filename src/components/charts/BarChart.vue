<script setup>
import { computed } from 'vue'
import BaseChart from '../BaseChart.vue'

const props = defineProps({
  // { categories: ['vivo',...], values: [2,1,1,1] }
  data: { type: Object, required: true },
  height: { type: String, default: '300px' },
})

const PALETTE = ['#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6']

const option = computed(() => {
  const { categories = [], values = [] } = props.data
  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: '#e4e7ed',
      textStyle: { color: '#333', fontSize: 12 },
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const p = params[0]
        return `${p.name}<br/><b>${p.value}</b> 件`
      },
    },
    grid: { left: 30, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: categories,
      axisLine: { lineStyle: { color: '#e4e7ed' } },
      axisTick: { show: false },
      axisLabel: { color: '#666', fontSize: 12 },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#f0f2f5', type: 'dashed' } },
      axisLabel: { color: '#999', fontSize: 11 },
    },
    series: [
      {
        type: 'bar',
        barWidth: 32,
        data: values.map((v, i) => ({
          value: v,
          itemStyle: {
            color: PALETTE[i % PALETTE.length],
            borderRadius: [4, 4, 0, 0],
          },
        })),
        label: {
          show: true,
          position: 'top',
          color: '#666',
          fontSize: 12,
        },
      },
    ],
  }
})
</script>

<template>
  <BaseChart :option="option" :height="height" />
</template>
