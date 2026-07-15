<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Plus, Minus, Box, Van } from '@element-plus/icons-vue'
import { regionData } from 'element-china-area-data'
import { getGoods } from '@/api/goods'
import { getAddressList, addAddress } from '@/api/addresses'
import { createOrder } from '@/api/orders'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const currentUserId = computed(() => userStore.userInfo?.id)

// 商品
const product = ref(null)
const loading = ref(true)

const tradeMethodLabel = (m) =>
  ({ FACE_TO_FACE: '自提', EXPRESS: '邮寄', BOTH: '两者皆可' }[m] || '两者皆可')

const loadProduct = async (id) => {
  loading.value = true
  try {
    const p = await getGoods(id)
    if (!p) {
      ElMessage.error('商品不存在或已下架')
      router.replace('/home')
      return
    }
    product.value = p
  } catch (e) {
    ElMessage.error('加载商品失败')
  } finally {
    loading.value = false
  }
}

const initialQty = Number(route.query.quantity) || 1
const buyQuantity = ref(initialQty)
const maxQty = computed(() =>
  Math.max(1, Number(product.value?.stock ?? product.value?.quantity ?? 1))
)
watch(maxQty, (m) => {
  if (buyQuantity.value > m) buyQuantity.value = m
  if (buyQuantity.value < 1) buyQuantity.value = 1
})

const incQty = () => {
  if (buyQuantity.value < maxQty.value) buyQuantity.value += 1
}
const decQty = () => {
  if (buyQuantity.value > 1) buyQuantity.value -= 1
}

// 备注
const remark = ref('')
const remarkLen = computed(() => remark.value.length)

// 封面样式：真实图走 <img>，否则渐变占位
const visualForId = (id) => {
  const palettes = [
    ['#ff8c5a', '#ff6b35'],
    ['#5b8def', '#4f7ce0'],
    ['#52c41a', '#389e0d'],
    ['#722ed1', '#531dab'],
    ['#13c2c2', '#08979c'],
  ]
  const n = Number(id) || 0
  return { bg1: palettes[n % palettes.length][0], bg2: palettes[n % palettes.length][1] }
}
const getCoverStyle = (p) => {
  if (p?.cover || p?.images?.length) return { background: '#f5f7fa' }
  const v = visualForId(p?.id)
  return { background: `linear-gradient(135deg, ${v.bg1} 0%, ${v.bg2} 100%)` }
}

// 收货方式（按商品 tradeMethod 决定可选项）
const tradeMethod = computed(() => product.value?.tradeMethod || 'BOTH')
const availableTradeMethods = computed(() => {
  if (tradeMethod.value === 'FACE_TO_FACE') return ['FACE_TO_FACE']
  if (tradeMethod.value === 'EXPRESS') return ['EXPRESS']
  return ['FACE_TO_FACE', 'EXPRESS']
})
const selectedTrade = ref('FACE_TO_FACE')
watch(
  () => product.value?.id,
  () => {
    selectedTrade.value = availableTradeMethods.value[0]
  },
  { immediate: true }
)
const isExpress = computed(() => selectedTrade.value === 'EXPRESS')

// 地址列表（邮寄时显示）
const addresses = ref([])
const selectedAddressId = ref(null)
const selectedAddress = computed(
  () => addresses.value.find((a) => a.id === selectedAddressId.value) || null
)
const loadAddresses = async () => {
  const res = await getAddressList()
  addresses.value = res
  // 默认选默认地址
  const def = addresses.value.find((a) => a.isDefault)
  if (def) selectedAddressId.value = def.id
}
const openAddressPicker = ref(false)
const pickAddress = (a) => {
  selectedAddressId.value = a.id
  openAddressPicker.value = false
}

// ===== 内嵌新增地址(在当前页面直接添加,不跳走)=====
const openAddAddressDialog = ref(false)
const addingAddress = ref(false)
const emptyAddrForm = () => ({
  receiver: '',
  phone: '',
  region: [], // 汉字数组 [省, 市, 区]
  detail: '',
  isDefault: false,
})
const addrForm = reactive(emptyAddrForm())
const addrFormRef = ref()
const addrFormRules = {
  receiver: [{ required: true, message: '请输入收件人', trigger: 'blur' }],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' },
  ],
  region: [{ required: true, message: '请选择省/市/区', trigger: 'change' }],
  detail: [{ required: true, message: '请输入详细地址', trigger: 'blur' }],
}

const openAddAddress = () => {
  // 切到新增弹窗前,先关闭"选择地址"弹窗,避免两个 dialog 叠加视觉混乱
  openAddressPicker.value = false
  Object.assign(addrForm, emptyAddrForm())
  openAddAddressDialog.value = true
}
const cancelAddAddress = () => {
  openAddAddressDialog.value = false
}
const submitAddAddress = async () => {
  if (!addrFormRef.value) return
  try {
    await addrFormRef.value.validate()
  } catch {
    return
  }
  addingAddress.value = true
  const [province, city, district] = addrForm.region
  // cascader 用 :props="{ value: 'label' }" 后,region 已是汉字数组,直接提交
  try {
    const created = await addAddress({
      receiver: addrForm.receiver.trim(),
      phone: addrForm.phone.trim(),
      province,
      city,
      district,
      detail: addrForm.detail.trim(),
      isDefault: addrForm.isDefault ? 1 : 0,
    })
    // 后端 AddressVO 含 fullAddress,前端拿来直接用;列表里也是它负责拼接
    const newId = created?.id
    openAddAddressDialog.value = false
    ElMessage.success('地址已添加')
    // 刷新地址列表,确保新地址出现在选择弹窗里,并自动选中
    await loadAddresses()
    if (newId) selectedAddressId.value = newId
  } catch (e) {
    // http.js 拦截器已 toast;留在弹窗让用户改后再试
  } finally {
    addingAddress.value = false
  }
}

// 费用：运费按商品本来的 freight 计(0=包邮)
const freight = computed(() => {
  if (!isExpress.value) return 0
  const f = Number(product.value?.freight)
  return Number.isFinite(f) && f >= 0 ? f : 0
})
const priceFmt = computed(() => Number(product.value?.price || 0).toLocaleString('zh-CN'))
const subtotalFmt = computed(() =>
  ((Number(product.value?.price || 0)) * buyQuantity.value).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
)
const totalFmt = computed(() =>
  (Number(product.value?.price || 0) * buyQuantity.value + freight.value).toLocaleString(
    'zh-CN',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  )
)

// 提交订单
const submitting = ref(false)
const handleSubmit = async () => {
  if (!product.value) return
  if (isExpress.value && !selectedAddress.value) {
    ElMessage.warning('请选择收货地址')
    return
  }
  // 防御：卖家不能购买自己的商品
  if (currentUserId.value && product.value.sellerId === currentUserId.value) {
    ElMessage.warning('不能购买自己的商品')
    return
  }
  submitting.value = true
  try {
    const order = await createOrder({
      goodsId: product.value.id,
      goodsCover: product.value.cover || product.value.images?.[0] || '',
      goodsTitle: product.value.title,
      sellerId: product.value.sellerId,
      sellerNickname: product.value.sellerNickname || '',
      price: Number(product.value.price),
      quantity: buyQuantity.value,
      totalAmount: Number(product.value.price) * buyQuantity.value + freight.value,
      freight: freight.value,
      tradeMethod: selectedTrade.value,
      addressId: selectedAddress.value?.id || null,
      addressText: selectedAddress.value?.fullAddress || '',
      remark: remark.value,
    })
    ElMessage.success('订单创建成功')
    // axios 拦截器已 unwrap Result.data；order 本身就是 OrderVO
    const orderId = order?.id ?? order?.orderId
    // 跳到订单中心并自动弹起支付框，避免用户再次点击"立即支付"
    const qs = orderId ? `?focus=${orderId}&autoPay=1` : ''
    router.replace(`/user-home/orders${qs}`)
  } catch (e) {
    ElMessage.error(e?.message || '订单创建失败，请重试')
  } finally {
    submitting.value = false
  }
}

const handleBack = () => {
  if (window.history.length > 1) router.back()
  else router.push('/home')
}

onMounted(async () => {
  await loadProduct(route.query.goodsId)
  await loadAddresses()
})
</script>

<template>
  <div class="create-order-page">
    <main class="order-main">
      <div class="back-link" @click="handleBack">
        <el-icon><ArrowLeft /></el-icon>
        <span>返回</span>
      </div>

      <h1 class="page-title">确认订单</h1>

      <div v-if="loading" class="loading">加载中...</div>

      <template v-else-if="product">
        <!-- ===== 商品信息 ===== -->
        <section class="card">
          <h2 class="card-title">商品信息</h2>
          <div class="goods-row">
            <div
              class="goods-cover"
              :style="getCoverStyle(product)"
            >
              <img
                v-if="product.cover || (product.images && product.images.length)"
                :src="product.cover || product.images[0]"
                class="cover-img"
                @error="(e) => (e.target.style.display = 'none')"
              />
              <el-icon v-else class="cover-icon" :size="36" color="rgba(255,255,255,0.7)"><Box /></el-icon>
            </div>
            <div class="goods-main">
              <div class="goods-title">{{ product.title }}</div>
              <span class="trade-tag">{{ tradeMethodLabel(product.tradeMethod) }}</span>
            </div>
          </div>

          <div class="form-row">
            <span class="form-label">购买数量</span>
            <div class="qty-control">
              <button class="qty-btn" :disabled="buyQuantity <= 1" @click="decQty">
                <el-icon><Minus /></el-icon>
              </button>
              <input
                class="qty-input"
                v-model.number="buyQuantity"
                type="number"
                :min="1"
                :max="maxQty"
              />
              <button class="qty-btn" :disabled="buyQuantity >= maxQty" @click="incQty">
                <el-icon><Plus /></el-icon>
              </button>
            </div>
          </div>

          <div class="form-row">
            <span class="form-label">买家备注</span>
            <div class="remark-wrap">
              <!-- 自定义 placeholder（覆盖在 textarea 左上角，避开右上角计数和右下角 resize 控件）；
                   原生 textarea 的 placeholder 浏览器默认垂直居中，无法靠 CSS 顶部对齐，
                   所以这里用条件渲染的 span 替换 -->
              <span v-if="!remark" class="remark-placeholder">选填，给卖家留言</span>
              <el-input
                v-model="remark"
                type="textarea"
                :rows="2"
                :maxlength="200"
              />
              <span class="remark-count">{{ remarkLen }} / 200</span>
            </div>
          </div>
        </section>

        <!-- ===== 收货方式 ===== -->
        <section class="card">
          <h2 class="card-title">收货方式</h2>
          <div class="trade-grid">
            <div
              v-for="m in availableTradeMethods"
              :key="m"
              class="trade-card"
              :class="{ active: selectedTrade === m, disabled: false }"
              @click="selectedTrade = m"
            >
              <div class="trade-icon-wrap">
                <el-icon :size="24"><Van v-if="m === 'EXPRESS'" /><Box v-else /></el-icon>
              </div>
              <div class="trade-info">
                <div class="trade-name">{{ m === 'FACE_TO_FACE' ? '自提' : '邮寄' }}</div>
                <div class="trade-desc">
                  {{ m === 'FACE_TO_FACE'
                    ? '自行与卖家沟通取货'
                    : (product?.freight && Number(product.freight) > 0
                        ? `需选择收货地址（运费 ¥${Number(product.freight).toFixed(2)}）`
                        : '需选择收货地址（包邮）') }}
                </div>
              </div>
              <span v-if="selectedTrade === m" class="trade-check">✓</span>
            </div>
          </div>

          <!-- 邮寄才显示地址选择 -->
          <div v-if="isExpress" class="address-pick">
            <div v-if="selectedAddress" class="address-selected" @click="openAddressPicker = true">
              <div class="addr-row1">
                <span class="addr-receiver">{{ selectedAddress.receiver }}</span>
                <span class="addr-phone">{{ selectedAddress.phone }}</span>
                <span v-if="selectedAddress.isDefault" class="addr-default">默认</span>
              </div>
              <div class="addr-row2">{{ selectedAddress.fullAddress }}</div>
              <el-icon class="addr-arrow"><ArrowLeft :style="{ transform: 'rotate(180deg)' }" /></el-icon>
            </div>
            <div v-else class="address-empty" @click="openAddressPicker = true">
              <el-icon><Plus /></el-icon>
              <span>请选择收货地址</span>
            </div>
          </div>

          <!-- 自提提示 -->
          <div v-else class="pickup-hint">
            <span class="check">✓</span>
            <span>该商品为自提交易，下单后请与卖家沟通自提时间和地点</span>
          </div>
        </section>

        <!-- ===== 费用明细 ===== -->
        <section class="card">
          <h2 class="card-title">费用明细</h2>
          <div class="fee-row">
            <span class="fee-label">商品金额</span>
            <span class="fee-value">¥{{ subtotalFmt }}</span>
          </div>
          <div class="fee-row">
            <span class="fee-label">运费</span>
            <span class="fee-value">¥{{ freight.toFixed(2) }}</span>
          </div>
          <div class="fee-row fee-total">
            <span class="fee-label">实付金额</span>
            <span class="fee-value fee-real">¥{{ totalFmt }}</span>
          </div>
        </section>

        <!-- ===== 提交按钮 ===== -->
        <div class="submit-bar">
          <el-button
            v-if="currentUserId && product.sellerId === currentUserId"
            class="submit-btn"
            disabled
          >
            不能购买自己的商品
          </el-button>
          <el-button
            v-else
            type="primary"
            class="submit-btn"
            :loading="submitting"
            @click="handleSubmit"
          >
            提交订单
          </el-button>
        </div>
      </template>
    </main>

    <!-- ===== 地址选择弹窗 ===== -->
    <el-dialog
      v-model="openAddressPicker"
      title="选择收货地址"
      width="520px"
      align-center
      :show-close="true"
    >
      <div class="addr-list">
        <div
          v-for="a in addresses"
          :key="a.id"
          class="addr-item"
          :class="{ active: a.id === selectedAddressId }"
          @click="pickAddress(a)"
        >
          <div class="addr-row1">
            <span class="addr-receiver">{{ a.receiver }}</span>
            <span class="addr-phone">{{ a.phone }}</span>
            <span v-if="a.isDefault" class="addr-default">默认</span>
          </div>
          <div class="addr-row2">{{ a.fullAddress }}</div>
          <el-icon v-if="a.id === selectedAddressId" class="addr-check"><ArrowLeft :style="{ transform: 'rotate(180deg)' }" /></el-icon>
        </div>
      </div>
      <template #footer>
        <el-button :icon="Plus" @click="openAddAddress">新增收货地址</el-button>
        <el-button @click="openAddressPicker = false">取消</el-button>
        <el-button type="primary" @click="openAddressPicker = false">确定</el-button>
      </template>
    </el-dialog>

    <!-- ===== 内嵌新增收货地址弹窗 ===== -->
    <el-dialog
      v-model="openAddAddressDialog"
      title="新增收货地址"
      width="520px"
      align-center
      append-to-body
      :close-on-click-modal="false"
      @close="cancelAddAddress"
    >
      <el-form
        ref="addrFormRef"
        :model="addrForm"
        :rules="addrFormRules"
        label-width="84px"
      >
        <el-form-item label="收件人" prop="receiver">
          <el-input v-model="addrForm.receiver" placeholder="请输入收件人姓名" maxlength="20" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="addrForm.phone" placeholder="请输入11位手机号" maxlength="11" />
        </el-form-item>
        <el-form-item label="所在地区" prop="region">
          <!-- 与 AddressList.vue 一致:cascader 用 :props="{ value: 'label' }",
               region 全程是汉字数组,直接提交后端,无需 CodeToText 二次转换 -->
          <el-cascader
            v-model="addrForm.region"
            :options="regionData"
            :props="{ value: 'label' }"
            class="full"
            placeholder="请选择 省 / 市 / 区"
          />
        </el-form-item>
        <el-form-item label="详细地址" prop="detail">
          <el-input
            v-model="addrForm.detail"
            type="textarea"
            :rows="2"
            placeholder="街道、楼栋、门牌号等"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="设为默认">
          <el-switch v-model="addrForm.isDefault" />
          <span class="form-tip">默认地址在结算时会优先选择</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cancelAddAddress">取消</el-button>
        <el-button type="primary" :loading="addingAddress" @click="submitAddAddress">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.create-order-page {
  min-height: 100vh;
  background: #f5f7fa;
  padding-bottom: 100px;
}

.order-main {
  max-width: 800px;
  margin: 0 auto;
  padding: 18px 24px 24px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #666;
  font-size: 13px;
  cursor: pointer;
  margin-bottom: 16px;
  user-select: none;
  transition: color 0.2s;
}
.back-link:hover { color: #ff6b35; }

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: #1f1f1f;
  margin: 0 0 24px;
  letter-spacing: 1px;
}

.loading {
  text-align: center;
  padding: 60px 0;
  color: #999;
}

.card {
  background: #fff;
  border-radius: 12px;
  padding: 22px 26px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f1f1f;
  margin: 0 0 18px;
  letter-spacing: 0.5px;
}

/* ===== 商品信息 ===== */
.goods-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 18px;
  border-bottom: 1px dashed #f0f2f5;
  margin-bottom: 18px;
}
.goods-cover {
  width: 84px;
  height: 84px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background-color: #f5f7fa;
  overflow: hidden;
  position: relative;
}
.cover-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.goods-main { flex: 1; min-width: 0; }
.goods-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f1f1f;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.trade-tag {
  display: inline-block;
  padding: 2px 10px;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  font-size: 12px;
  color: #666;
}

.form-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}
.form-row:last-child { margin-bottom: 0; }
.form-label {
  width: 84px;
  flex-shrink: 0;
  text-align: right;
  color: #666;
  font-size: 14px;
  padding-top: 6px;
}
.form-label::after {
  content: '：';
}

/* ===== qty ===== */
.qty-control {
  display: inline-flex;
  align-items: stretch;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}
.qty-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: #fafbfc;
  color: #555;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.qty-btn:hover:not(:disabled) { background: #fff7f2; color: #ff6b35; }
.qty-btn:disabled { color: #ccc; cursor: not-allowed; }
.qty-input {
  width: 72px;
  height: 36px;
  border: none;
  border-left: 1px solid #e4e7ed;
  border-right: 1px solid #e4e7ed;
  text-align: center;
  font-size: 14px;
  color: #1f1f1f;
  background: #fff;
  outline: none;
  -moz-appearance: textfield;
}
.qty-input::-webkit-outer-spin-button,
.qty-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.remark-wrap { flex: 1; position: relative; }
/* textarea 内部：不再额外加 padding-top，
   因为原生 placeholder 不可控（垂直居中），用户输入和 placeholder 会不对齐 */
.remark-wrap :deep(.el-textarea__inner) {
  padding: 8px 12px;
}
/* 自定义 placeholder：覆盖在 textarea 左上角，紧贴顶部输入起点 */
.remark-placeholder {
  position: absolute;
  left: 13px;
  top: 9px;
  font-size: 14px;
  color: #c0c4cc;
  pointer-events: none;
  line-height: 1.5;
}
/* 字符计数放右上角，避开 textarea 右下角浏览器原生的 resize 控件 */
.remark-count {
  position: absolute;
  right: 12px;
  top: 8px;
  font-size: 12px;
  color: #999;
  pointer-events: none;
  background: #fff;
  padding: 0 4px;
}

/* ===== 收货方式 ===== */
.trade-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.trade-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  border: 1.5px solid #e4e7ed;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  background: #fff;
}
.trade-card:hover { border-color: #ff8c5a; }
.trade-card.active {
  border-color: #ff6b35;
  background: linear-gradient(135deg, #fff5f0 0%, #ffe8db 100%);
}
.trade-icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  flex-shrink: 0;
}
.trade-card.active .trade-icon-wrap {
  background: linear-gradient(135deg, #ff8c5a 0%, #ff6b35 100%);
  border-color: transparent;
  color: #fff;
}
.trade-info { flex: 1; min-width: 0; }
.trade-name {
  font-size: 15px;
  font-weight: 600;
  color: #1f1f1f;
  margin-bottom: 4px;
}
.trade-desc {
  font-size: 12px;
  color: #888;
}
.trade-check {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ff8c5a 0%, #ff6b35 100%);
  color: #fff;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.address-pick { margin-top: 16px; }
.address-selected {
  position: relative;
  padding: 14px 16px;
  border: 1px solid #ffd5b8;
  background: #fff8f3;
  border-radius: 8px;
  cursor: pointer;
}
.addr-row1 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.addr-receiver { font-weight: 600; color: #1f1f1f; }
.addr-phone { color: #555; font-size: 13px; }
.addr-default {
  background: linear-gradient(135deg, #ff8c5a 0%, #ff6b35 100%);
  color: #fff;
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 4px;
}
.addr-row2 { color: #555; font-size: 13px; }
.addr-arrow {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%) rotate(180deg);
  color: #999;
  font-size: 14px;
}

.address-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border: 1px dashed #d9d9d9;
  border-radius: 8px;
  color: #999;
  cursor: pointer;
}

.pickup-hint {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  border-radius: 8px;
  color: #389e0d;
  font-size: 13px;
}
.pickup-hint .check {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #52c41a;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
}

/* ===== 费用 ===== */
.fee-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 4px;
  font-size: 14px;
  color: #555;
}
.fee-label { color: #666; }
.fee-value { color: #1f1f1f; font-weight: 500; }
.fee-total {
  border-top: 1px dashed #f0f2f5;
  margin-top: 6px;
  padding-top: 14px;
}
.fee-real {
  font-size: 22px;
  font-weight: 700;
  color: #ff6b35;
}

/* ===== 提交 ===== */
.submit-bar {
  display: flex;
  justify-content: center;
  margin-top: 28px;
}
.submit-btn {
  width: 280px;
  height: 48px !important;
  font-size: 16px !important;
  font-weight: 600 !important;
  letter-spacing: 2px !important;
  background: linear-gradient(135deg, #5b8def 0%, #4f7ce0 100%) !important;
  border: none !important;
  border-radius: 999px !important;
  box-shadow: 0 6px 16px rgba(79, 124, 224, 0.32) !important;
}
.submit-btn:hover {
  background: linear-gradient(135deg, #4f7ce0 0%, #4370d4 100%) !important;
  transform: translateY(-1px);
}

/* ===== 地址选择弹窗 ===== */
.addr-list { display: flex; flex-direction: column; gap: 10px; }
.addr-item {
  position: relative;
  padding: 12px 16px;
  border: 1.5px solid #e4e7ed;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.addr-item:hover { border-color: #ff8c5a; }
.addr-item.active {
  border-color: #ff6b35;
  background: linear-gradient(135deg, #fff5f0 0%, #ffe8db 100%);
}
.addr-item .addr-check {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%) rotate(180deg);
  color: #ff6b35;
  font-size: 18px;
}

/* ===== 新增收货地址表单 ===== */
.full { width: 100%; }
.form-tip {
  margin-left: 10px;
  color: #999;
  font-size: 12px;
}
</style>