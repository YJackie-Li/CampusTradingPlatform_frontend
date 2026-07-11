<script setup>
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Clock, Position } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { uploadFile } from '@/api/common'

// 把后端 ISO 时间戳格式化成 "2025-08-12 15:30"
const formatDateTime = (t) => {
  if (!t) return ''
  const s = String(t)
  return s.length >= 16 ? s.slice(0, 16).replace('T', ' ') : s
}

const userStore = useUserStore()

const profileModalVisible = ref(false)
const passwordModalVisible = ref(false)

// 个人信息表单
const profileForm = reactive({
  avatar: '',
  username: '',
  nickname: '',
  phone: '',
  email: '',
  bio: '',
  gender: 1,
})

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const avatarPreview = ref('')
const profileFormRef = ref()
const passwordFormRef = ref()

const isLoggedIn = computed(() => userStore.isLoggedIn)
const userInfo = computed(() => userStore.userInfo || {})

const openProfileModal = () => {
  if (!isLoggedIn.value) {
    ElMessage.warning('请先登录')
    return
  }
  profileForm.avatar = userInfo.value.avatar || ''
  profileForm.username = userInfo.value.username || ''
  profileForm.nickname = userInfo.value.nickname || ''
  profileForm.phone = userInfo.value.phone || ''
  profileForm.email = userInfo.value.email || ''
  profileForm.bio = userInfo.value.bio || ''
  profileForm.gender = userInfo.value.gender || 1
  avatarPreview.value = userInfo.value.avatar || ''
  profileModalVisible.value = true
}

const openPasswordModal = () => {
  if (!isLoggedIn.value) {
    ElMessage.warning('请先登录')
    return
  }
  passwordForm.oldPassword = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
  passwordModalVisible.value = true
}

const avatarUploading = ref(false)
const handleAvatarChange = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    ElMessage.error('请选择图片文件')
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.error('图片大小不能超过 2MB')
    return
  }
  avatarUploading.value = true
  try {
    const res = await uploadFile(file, 'avatar')
    profileForm.avatar = res.url
    avatarPreview.value = res.url
  } catch (err) {
    ElMessage.error(err?.message || '头像上传失败')
  } finally {
    avatarUploading.value = false
    // 清空 input 让用户能再次选同一张图
    e.target.value = ''
  }
}

const submitProfile = async () => {
  if (!profileFormRef.value) return
  await profileFormRef.value.validate(async (valid) => {
    if (!valid) return
    // 提交到后端的字段（username 是登录账号，后端不允许改）
    const patch = {
      nickname: profileForm.nickname,
      gender: profileForm.gender,
    }
    // phone / email / bio 改可选：未填时让后端保留原值，避免空字符串覆盖数据库已有值
    if (profileForm.phone) patch.phone = profileForm.phone
    if (profileForm.email) patch.email = profileForm.email
    if (profileForm.bio !== undefined) patch.bio = profileForm.bio
    if (profileForm.avatar) {
      patch.avatar = profileForm.avatar
    }
    try {
      await userStore.updateProfile(patch)
      ElMessage.success('个人信息已更新')
      profileModalVisible.value = false
    } catch (e) {
      ElMessage.error(e?.message || '个人信息更新失败')
    }
  })
}

const profileRules = {
  nickname: [
    { required: true, message: '请输入昵称', trigger: 'blur' },
    { min: 2, max: 20, message: '昵称长度在 2-20 个字符', trigger: 'blur' },
  ],
  phone: [
    { pattern: /^$|^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' },
  ],
  email: [
    { pattern: /^$|^[\w.+-]+@[\w-]+\.[\w.-]+$/, message: '邮箱格式不正确', trigger: 'blur' },
  ],
  bio: [
    { max: 255, message: '个性签名 ≤ 255 字', trigger: 'blur' },
  ],
}

const submitPassword = async () => {
  if (!passwordFormRef.value) return
  await passwordFormRef.value.validate(async (valid) => {
    if (!valid) return
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      ElMessage.error('两次输入的密码不一致')
      return
    }
    if (passwordForm.oldPassword === passwordForm.newPassword) {
      ElMessage.error('新密码不能与原密码相同')
      return
    }
    try {
      await userStore.changePassword({
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword,
      })
      ElMessage.success('密码修改成功')
      passwordModalVisible.value = false
    } catch (e) {
      ElMessage.error(e?.message || '密码修改失败')
    }
  })
}

const passwordRules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度在 6-20 个字符', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (_rule, value, cb) => {
        if (value !== passwordForm.newPassword) cb(new Error('两次输入的密码不一致'))
        else cb()
      },
      trigger: 'blur',
    },
  ],
}

// 暴露给父组件（TopNavbar）触发
defineExpose({ openProfileModal, openPasswordModal })
</script>

<template>
  <!-- 修改个人信息 -->
  <el-dialog
    v-model="profileModalVisible"
    title="修改个人信息"
    width="480px"
    :close-on-click-modal="false"
    align-center
  >
    <el-form
      ref="profileFormRef"
      :model="profileForm"
      :rules="profileRules"
      label-width="80px"
      label-position="right"
      class="profile-form"
    >
      <div class="avatar-uploader-row">
        <div class="avatar-preview">
          <el-avatar :size="64" :src="avatarPreview">
            {{ (profileForm.nickname || profileForm.username || 'U').slice(0, 1) }}
          </el-avatar>
        </div>
        <label class="upload-trigger">
          <el-icon :size="14"><Upload /></el-icon>
          <span>点击上传</span>
          <input
            type="file"
            accept="image/*"
            style="display: none"
            @change="handleAvatarChange"
          />
        </label>
      </div>
      <!-- 只读账号元信息：注册时间 / 最后登录时间 -->
      <div class="readonly-meta">
        <span class="meta-item">
          <el-icon :size="12"><Clock /></el-icon>
          注册于 {{ userInfo.createTime ? formatDateTime(userInfo.createTime) : '-' }}
        </span>
        <span class="meta-item">
          <el-icon :size="12"><Position /></el-icon>
          上次登录 {{ userInfo.lastLoginTime ? formatDateTime(userInfo.lastLoginTime) : '尚未登录' }}
        </span>
      </div>
      <el-form-item label="账号">
        <el-input v-model="profileForm.username" disabled />
      </el-form-item>
      <el-form-item label="用户名" prop="nickname">
        <el-input v-model="profileForm.nickname" placeholder="请输入用户名" />
      </el-form-item>
      <el-form-item label="手机号" prop="phone">
        <el-input v-model="profileForm.phone" placeholder="选填，11 位手机号" maxlength="11" />
      </el-form-item>
      <el-form-item label="邮箱" prop="email">
        <el-input v-model="profileForm.email" placeholder="选填，用于找回密码" maxlength="100" />
      </el-form-item>
      <el-form-item label="个性签名" prop="bio">
        <el-input
          v-model="profileForm.bio"
          type="textarea"
          :rows="2"
          placeholder="一句话介绍下自己，让卖家对你更有印象"
          maxlength="255"
          show-word-limit
        />
      </el-form-item>
      <el-form-item label="性别" prop="gender">
        <el-radio-group v-model="profileForm.gender">
          <el-radio :value="1">男</el-radio>
          <el-radio :value="2">女</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="profileModalVisible = false">取消</el-button>
      <el-button type="primary" @click="submitProfile">保存</el-button>
    </template>
  </el-dialog>

  <!-- 修改密码 -->
  <el-dialog
    v-model="passwordModalVisible"
    title="修改密码"
    width="420px"
    :close-on-click-modal="false"
    align-center
  >
    <el-form
      ref="passwordFormRef"
      :model="passwordForm"
      :rules="passwordRules"
      label-width="80px"
      label-position="right"
    >
      <el-form-item label="原密码" prop="oldPassword">
        <el-input
          v-model="passwordForm.oldPassword"
          type="password"
          placeholder="请输入原密码"
          show-password
        />
      </el-form-item>
      <el-form-item label="新密码" prop="newPassword">
        <el-input
          v-model="passwordForm.newPassword"
          type="password"
          placeholder="请输入新密码"
          show-password
        />
      </el-form-item>
      <el-form-item label="确认密码" prop="confirmPassword">
        <el-input
          v-model="passwordForm.confirmPassword"
          type="password"
          placeholder="请再次输入新密码"
          show-password
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="passwordModalVisible = false">取消</el-button>
      <el-button type="primary" @click="submitPassword">确认修改</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.profile-form { padding: 8px 0 0; }

.avatar-uploader-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 0 0 24px;
  padding: 0 0 20px;
  border-bottom: 1px dashed #eef0f3;
}

.avatar-preview {
  flex-shrink: 0;
  border: 2px solid #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border-radius: 50%;
}

.upload-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  background: #f5f7fa;
  border: 1px dashed #c0c4cc;
  border-radius: 6px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-trigger:hover {
  border-color: #ff6b35;
  color: #ff6b35;
  background: #fff7f2;
}

/* 只读账号元信息（注册时间 / 上次登录） */
.readonly-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin: 0 0 18px;
  padding: 10px 14px;
  background: #fafbfc;
  border: 1px dashed #eef0f3;
  border-radius: 6px;
  font-size: 12px;
  color: #888;
}
.readonly-meta .meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.readonly-meta .meta-item :deep(.el-icon) {
  color: #bbb;
}
</style>