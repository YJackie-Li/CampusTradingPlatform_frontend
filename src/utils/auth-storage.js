// 登录态存储：使用 sessionStorage 而不是 localStorage，
// 目的是让同一浏览器多个标签页可以登录不同账号互不干扰。
//
// 浏览器同源策略下 localStorage 是全标签共享的，第二个标签登录会
// 把第一个标签里的 token / userInfo 整个覆盖。
// sessionStorage 按标签页隔离，关掉标签自动失效，演示场景刚好合适。
//
// 注意：不要在别处直接读 localStorage 里的 token / userInfo，
// 一律走 getToken / getUserInfo / setAuth / clearAuth 这几个方法。
const TOKEN_KEY = 'token'
const USER_KEY = 'userInfo'

const storage = (() => {
  if (typeof window === 'undefined') return null
  try {
    // 某些隐私模式下 sessionStorage 写入会抛错；兜底用内存对象
    const test = '__auth_probe__'
    window.sessionStorage.setItem(test, test)
    window.sessionStorage.removeItem(test)
    return window.sessionStorage
  } catch {
    return null
  }
})()

// 内存兜底：sessionStorage 不可用时（极少见）保持单标签内可用，
// 跨标签还是只读到自己那份，不会出现互相覆盖。
const memoryStore = new Map()

function getItem(key) {
  if (storage) return storage.getItem(key)
  return memoryStore.has(key) ? memoryStore.get(key) : null
}
function setItem(key, value) {
  if (storage) storage.setItem(key, value)
  else memoryStore.set(key, value)
}
function removeItem(key) {
  if (storage) storage.removeItem(key)
  else memoryStore.delete(key)
}

export function getToken() {
  return getItem(TOKEN_KEY) || ''
}

export function getUserInfo() {
  const raw = getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function setAuth(token, userInfo) {
  if (token) setItem(TOKEN_KEY, token)
  if (userInfo != null) setItem(USER_KEY, JSON.stringify(userInfo))
}

/**
 * 清本地登录态（token + userInfo）。
 * 注意：不要连带清掉别的标签页的 —— 本来就互不可见，所以这里没做广播。
 */
export function clearAuth() {
  removeItem(TOKEN_KEY)
  removeItem(USER_KEY)
}
