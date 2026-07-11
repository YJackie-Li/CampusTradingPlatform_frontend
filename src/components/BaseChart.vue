<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  option: { type: Object, required: true },
  height: { type: String, default: '320px' },
})

const chartEl = ref(null)
let chartInstance = null
let resizeObserver = null

const initChart = async () => {
  await nextTick()
  if (!chartEl.value) return
  if (chartInstance) return
  chartInstance = echarts.init(chartEl.value)
  chartInstance.setOption(props.option)

  // 自适应
  resizeObserver = new ResizeObserver(() => chartInstance?.resize())
  resizeObserver.observe(chartEl.value)
  window.addEventListener('resize', handleResize)
}

const handleResize = () => chartInstance?.resize()

onMounted(initChart)

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  resizeObserver?.disconnect()
  chartInstance?.dispose()
  chartInstance = null
})

// option 变化时重设
watch(
  () => props.option,
  (val) => {
    if (chartInstance && val) chartInstance.setOption(val, true)
  },
  { deep: true }
)
</script>

<template>
  <div ref="chartEl" class="base-chart" :style="{ height }" />
</template>

<style scoped>
.base-chart {
  width: 100%;
}
</style>
