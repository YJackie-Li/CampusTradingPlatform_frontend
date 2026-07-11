import http from './http'

// ===== 认证状态枚举 =====
// 0-未认证 1-已通过 2-已驳回
export const VERIFY_STATUS = {
  UNVERIFIED: 0,
  VERIFIED: 1,
  REJECTED: 2,
}

export const verifyStatusText = (s) =>
  ({
    0: '未认证',
    1: '已认证',
    2: '已驳回',
  }[s] ?? '-')

export const verifyStatusTagType = (s) =>
  ({
    0: 'warning',
    1: 'success',
    2: 'danger',
  }[s] || 'info')

// ===== 人员类型 =====
// 1-学生 2-教师 3-其他
export const PERSON_TYPE = {
  STUDENT: 1,
  TEACHER: 2,
  OTHER: 3,
}

export const personTypeText = (t) =>
  ({
    1: '学生',
    2: '教师',
    3: '其他',
  }[t] ?? '-')

// ===== D 端接口 =====

// 实时校验(注册页输入时调用,无需登录)
export const quickCheckVerify = (data) =>
  http.post('/verify/quick-check', data)

// 提交/重新认证(已登录)
export const submitVerify = (data) =>
  http.post('/verify/submit', data)

// 查询当前用户认证状态
export const getVerifyStatus = () =>
  http.get('/verify/status')

// ===== A 端接口(白名单管理) =====
export const getAdminCampusPersonPage = (params) =>
  http.get('/admin/campus-person/page', { params })

export const createAdminCampusPerson = (data) =>
  http.post('/admin/campus-person', data)

export const updateAdminCampusPerson = (id, data) =>
  http.put(`/admin/campus-person/${id}`, data)

export const deleteAdminCampusPerson = (id) =>
  http.delete(`/admin/campus-person/${id}`)
