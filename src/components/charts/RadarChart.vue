<script setup>
import { computed } from 'vue'
import BaseChart from '../BaseChart.vue'

const props = defineProps({
  // { indicators: [{name,max}], values: [40,60,...] }
  data: { type: Object, required: true },
  height: { type: String, default: '300px' },
})

const option = computed(() => {
  const { indicators = [], values = [] } = props.data
  return {
    color: ['#3B82F6'],
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: '#e4e7ed',
      textStyle: { color: '#333', fontSize: 12 },
    },
    radar: {
      center: ['50%', '55%'],
      radius: '65%',
      splitNumber: 4,
      axisName: {
        color: '#666',
        fontSize: 12,
      },
      splitLine: {
        lineStyle: { color: ['#e4e7ed', '#e4e7ed', '#e4e7ed', '#e4e7ed'] },
      },
      splitArea: {
        areaStyle: {
          color: ['rgba(59,130,246,0.04)', 'rgba(59,130,246,0.08)'],
        },
      },
      axisLine: { lineStyle: { color: '#e4e7ed' } },
      indicator: indicators,
    },
    series: [
      {
        type: 'radar',
        symbol: 'circle',
        symbolSize: 4,
        data: [
          {
            value: values,
            name: '平台健康度',
            areaStyle: { color: 'rgba(59,130,246,0.18)' },
            lineStyle: { width: 2, color: '#3B82F6' },
            itemStyle: { color: '#3B82F6' },
          },
        ],
      },
    ],
  }
})
</script>

<template>
  <BaseChart :option="option" :height="height" />
</template>
