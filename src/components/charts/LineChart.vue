<script setup>
import { computed } from 'vue'
import BaseChart from '../BaseChart.vue'

const props = defineProps({
  // { labels: ['06-21',...], series: [{ name, data, color }] }
  data: { type: Object, required: true },
  height: { type: String, default: '300px' },
})

const option = computed(() => {
  const { labels = [], series = [] } = props.data
  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: '#e4e7ed',
      textStyle: { color: '#333', fontSize: 12 },
    },
    legend: {
      data: series.map((s) => s.name),
      bottom: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: '#666', fontSize: 12 },
    },
    grid: { left: 30, right: 20, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: { lineStyle: { color: '#e4e7ed' } },
      axisLabel: { color: '#999', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#f0f2f5', type: 'dashed' } },
      axisLabel: { color: '#999', fontSize: 11 },
    },
    series: series.map((s) => ({
      name: s.name,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      data: s.data,
      itemStyle: { color: s.color },
      lineStyle: { width: 2, color: s.color },
      areaStyle: s.area
        ? {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: s.color + '55' },
                { offset: 1, color: s.color + '00' },
              ],
            },
          }
        : undefined,
    })),
  }
})
</script>

<template>
  <BaseChart :option="option" :height="height" />
</template>
