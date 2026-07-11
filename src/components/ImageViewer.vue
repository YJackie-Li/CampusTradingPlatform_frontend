<script setup>
/**
 * 通用图片预览器：
 * - 点击外部 / 按 Esc / 点关闭按钮 → 关闭
 * - 滚轮上下 → 缩放（夹在 0.1x ~ 6x，相对于图片自然像素）
 * - 双击 → 100%适配 ↔ 200%
 * - 鼠标按下拖动 → 平移（仅在图片视觉尺寸 > 视口时有效；否则点击穿透关闭）
 * - 右下角工具栏：缩小 / 比例文字 / 放大 / 1:1 / 恢复
 * - 多图模式：左右切换（src 数组 + index）
 *
 * scale 语义：永远是"图片自然像素的倍数"。
 *   100% 适配（默认） ≈ 0.3 ~ 0.5（按视口 / 图片自然尺寸计算）
 *   1:1 实际像素     = 1
 *   滚轮加减         = 直接 ±0.25
 *
 * 显示百分比 = scale / fitRatio × 100。
 *   100% 适配 → 显示 100%
 *   1:1 像素  → 显示 1/fitRatio（比如 227%）
 *   滚轮缩放 → 按当前 fit 比例的相对值显示
 * 这样 "100% → 1:1 → 滚轮" 的数字始终与视觉大小同步，不会跳变。
 *
 * 100% 比例 = 把图片整体缩放到刚好放进当前屏幕窗口（保留 8% 边距）。
 * 1:1 比例  = 图片的自然像素尺寸，每一像素对应一显示像素。
 */
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import {
  ZoomIn,
  ZoomOut,
  RefreshLeft,
  FullScreen,
  Close,
  ArrowLeft,
  ArrowRight,
} from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // 单图模式
  src: { type: String, default: '' },
  // 多图模式（可选）：传入列表则显示左右切换
  srcList: { type: Array, default: () => [] },
  startIndex: { type: Number, default: 0 },
  // alt 文本，鼠标 hover 时显示
  alt: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'close'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const list = computed(() =>
  props.srcList && props.srcList.length ? props.srcList : props.src ? [props.src] : []
)

const index = ref(0)
watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      index.value = Math.min(Math.max(props.startIndex, 0), Math.max(list.value.length - 1, 0))
      resetToFit()
    }
  }
)
watch(
  () => props.src,
  () => resetToFit()
)

const currentSrc = computed(() => list.value[index.value] || '')

// 缩放：scale 永远是"图片自然像素的倍数"。
//   100% 适配（默认）≈ 0.4（一张 4000px 宽的图在 1920 屏上 ≈ 0.44）
//   1:1 实际像素     = 1
//   用户继续滚轮     = 直接加减 0.25（数字与视觉同步增长/缩小，没有跳变）
const MIN_SCALE = 0.1
const MAX_SCALE = 6
const STEP = 0.25
const scale = ref(1)
const tx = ref(0)
const ty = ref(0)

// 图片自然尺寸（onload 时填）；用来算 100% 适配比例
const imgRef = ref(null)
const naturalSize = ref({ w: 0, h: 0 })

// 视口给图片留 8% 边距 + 底部 110px 给工具栏 / 顶部 70px 给关闭按钮
const computeFitRatio = () => {
  if (!naturalSize.value.w || !naturalSize.value.h) return 1
  const availW = window.innerWidth * 0.92
  const availH = window.innerHeight - 180
  return Math.min(availW / naturalSize.value.w, availH / naturalSize.value.h)
}
const fitRatio = ref(1)
const updateFitRatio = () => {
  fitRatio.value = computeFitRatio()
}
const onImgLoad = () => {
  const el = imgRef.value
  if (!el) return
  naturalSize.value = { w: el.naturalWidth, h: el.naturalHeight }
  updateFitRatio()
  // 第一次加载完 → 直接 100% 适配
  if (scale.value === 1 && !tx.value && !ty.value) {
    scale.value = fitRatio.value
  }
}

// "用户是否主动改过 zoom"——用来在 resize / 切图时决定是否要重新 fit
const userHasZoomed = ref(false)

// resize 时若用户没主动缩放过，跟着视口重新 fit
const onResize = () => {
  if (!visible.value) return
  if (!userHasZoomed.value) {
    updateFitRatio()
    scale.value = fitRatio.value
    tx.value = 0
    ty.value = 0
  }
}

// 恢复：回到 100% 适配（scale = 自然像素的 fitRatio 倍）
const resetToFit = () => {
  updateFitRatio()
  scale.value = fitRatio.value
  tx.value = 0
  ty.value = 0
  userHasZoomed.value = false
}

const clampScale = (s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))
const zoomIn = () => {
  userHasZoomed.value = true
  scale.value = clampScale(scale.value + STEP)
}
const zoomOut = () => {
  userHasZoomed.value = true
  scale.value = clampScale(scale.value - STEP)
}

// 1:1 实际像素：scale = 1
const setActual = () => {
  userHasZoomed.value = true
  scale.value = 1
  tx.value = 0
  ty.value = 0
}

// 滚轮缩放
const onWheel = (e) => {
  if (!visible.value) return
  e.preventDefault()
  userHasZoomed.value = true
  const delta = e.deltaY < 0 ? STEP : -STEP
  scale.value = clampScale(scale.value + delta)
}

// 双击切换 100% 适配 ↔ 200%
const onDouble = () => {
  // 如果当前是"接近 100% 适配"，双击放大到 200%；否则回到 100%
  if (scale.value <= fitRatio.value * 1.05 + 0.01) {
    userHasZoomed.value = true
    scale.value = clampScale(2)
  } else {
    resetToFit()
  }
}
// 拖拽平移——只要图片视觉尺寸 > 视口就可以拖
const overflowing = computed(() => {
  if (!naturalSize.value.w) return scale.value > fitRatio.value * 1.05
  const visualW = naturalSize.value.w * scale.value
  const visualH = naturalSize.value.h * scale.value
  return visualW > window.innerWidth * 0.92 || visualH > window.innerHeight - 180
})
const dragging = ref(false)
let dragStart = { x: 0, y: 0, tx: 0, ty: 0 }
const onMouseDown = (e) => {
  if (!overflowing.value) return // 未溢出时点击穿透到遮罩以关闭
  dragging.value = true
  dragStart = { x: e.clientX, y: e.clientY, tx: tx.value, ty: ty.value }
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}
const onMouseMove = (e) => {
  if (!dragging.value) return
  tx.value = dragStart.tx + (e.clientX - dragStart.x)
  ty.value = dragStart.ty + (e.clientY - dragStart.y)
}
const onMouseUp = () => {
  dragging.value = false
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
}

const close = () => {
  visible.value = false
  emit('close')
}

const onBackdropClick = () => close()

const onKeyDown = (e) => {
  if (!visible.value) return
  if (e.key === 'Escape') close()
  else if (e.key === '+' || e.key === '=') zoomIn()
  else if (e.key === '-' || e.key === '_') zoomOut()
  else if (e.key === '0') resetToFit()
  else if (e.key === 'ArrowLeft' && list.value.length > 1) prev()
  else if (e.key === 'ArrowRight' && list.value.length > 1) next()
}

watch(visible, (v) => {
  if (v) {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResize)
  } else {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('resize', onResize)
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})

const prev = () => {
  if (list.value.length <= 1) return
  index.value = (index.value - 1 + list.value.length) % list.value.length
  resetToFit()
}
const next = () => {
  if (list.value.length <= 1) return
  index.value = (index.value + 1) % list.value.length
  resetToFit()
}

const imgStyle = computed(() => ({
  transform: `translate(${tx.value}px, ${ty.value}px) scale(${scale.value})`,
  cursor: overflowing.value ? (dragging.value ? 'grabbing' : 'grab') : 'zoom-in',
}))

// 显示用的百分比：100% = 100% 适配（刚好放进屏幕）。scale / fitRatio 把自然像素倍数转成相对 fit 的比例。
// 例：fitRatio=0.44, scale=0.44 → 100%；scale=1 → 227%（1:1）；scale=0.25 → 57%
const displayPercent = computed(() => {
  if (!fitRatio.value) return Math.round(scale.value * 100)
  return Math.round((scale.value / fitRatio.value) * 100)
})
</script>

<template>
  <transition name="iv-fade">
    <div
      v-if="visible"
      class="iv-mask"
      @click.self="onBackdropClick"
      @wheel.passive="onWheel"
    >
      <!-- 顶部工具条：关闭 -->
      <button class="iv-btn iv-close" title="关闭 (Esc)" @click="close">
        <el-icon :size="22"><Close /></el-icon>
      </button>

      <!-- 多图时显示左右切换 -->
      <button
        v-if="list.length > 1"
        class="iv-btn iv-nav iv-nav-left"
        title="上一张 (←)"
        @click.stop="prev"
      >
        <el-icon :size="26"><ArrowLeft /></el-icon>
      </button>
      <button
        v-if="list.length > 1"
        class="iv-btn iv-nav iv-nav-right"
        title="下一张 (→)"
        @click.stop="next"
      >
        <el-icon :size="26"><ArrowRight /></el-icon>
      </button>

      <!-- 图片本体 -->
      <div class="iv-stage">
        <img
          v-if="currentSrc"
          ref="imgRef"
          :src="currentSrc"
          :alt="alt"
          class="iv-img"
          :style="imgStyle"
          @load="onImgLoad"
          @mousedown="onMouseDown"
          @dblclick="onDouble"
          draggable="false"
        />
      </div>

      <!-- 底部工具条：缩放控制 + 计数 -->
      <div class="iv-toolbar" @click.stop>
        <button class="iv-tb-btn" title="缩小 (-)" @click="zoomOut">
          <el-icon :size="18"><ZoomOut /></el-icon>
        </button>
        <span class="iv-scale-text">{{ displayPercent }}%</span>
        <button class="iv-tb-btn" title="放大 (+)" @click="zoomIn">
          <el-icon :size="18"><ZoomIn /></el-icon>
        </button>
        <span class="iv-divider"></span>
        <button class="iv-tb-btn" title="1:1 实际像素" @click="setActual">
          <el-icon :size="18"><FullScreen /></el-icon>
        </button>
        <button class="iv-tb-btn" title="恢复 100% 适配 (0)" @click="resetToFit">
          <el-icon :size="18"><RefreshLeft /></el-icon>
        </button>
        <span v-if="list.length > 1" class="iv-counter">
          {{ index + 1 }} / {{ list.length }}
        </span>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.iv-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.88);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}

.iv-stage {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.iv-img {
  /* 不设 max-width/max-height —— 图片始终按自然尺寸渲染，
     由 transform: scale() 决定视觉大小。100% 适配与 1:1 都是同一个 scale 倍数，
     不会出现 "1:1 显示 100% 但和 fit 一样大" 的语义跳变。 */
  transform-origin: center center;
  transition: transform 0.05s linear;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
  border-radius: 4px;
}

.iv-btn {
  position: absolute;
  background: rgba(255, 255, 255, 0.12);
  border: 0;
  color: #fff;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, transform 0.1s;
  z-index: 1;
}
.iv-btn:hover {
  background: rgba(255, 255, 255, 0.22);
}
.iv-btn:active {
  transform: scale(0.96);
}

.iv-close {
  top: 20px;
  right: 20px;
}

.iv-nav {
  top: 50%;
  transform: translateY(-50%);
}
.iv-nav-left { left: 20px; }
.iv-nav-right { right: 20px; }
.iv-nav:hover { transform: translateY(-50%) scale(1.05); }

.iv-toolbar {
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  color: #fff;
  font-size: 13px;
  backdrop-filter: blur(6px);
}

.iv-tb-btn {
  background: transparent;
  border: 0;
  color: #fff;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.iv-tb-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.iv-scale-text {
  min-width: 48px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.85);
}

.iv-divider {
  width: 1px;
  height: 18px;
  background: rgba(255, 255, 255, 0.2);
  margin: 0 4px;
}

.iv-counter {
  margin-left: 8px;
  padding-left: 12px;
  border-left: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.75);
  font-variant-numeric: tabular-nums;
}

.iv-fade-enter-active,
.iv-fade-leave-active {
  transition: opacity 0.2s;
}
.iv-fade-enter-from,
.iv-fade-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .iv-close { top: 12px; right: 12px; width: 38px; height: 38px; }
  .iv-nav-left { left: 8px; }
  .iv-nav-right { right: 8px; }
  .iv-toolbar { bottom: 14px; padding: 6px 10px; gap: 4px; }
}
</style>