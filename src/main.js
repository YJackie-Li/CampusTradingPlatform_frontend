import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import App from './App.vue'
import router from './router'
import './styles/index.css'
import { useUserStore } from './stores/user'
import { connectChatWs } from './utils/websocket'

const app = createApp(App)

// 注册所有 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus)

app.mount('#app')

// 启动后：如果有 token，主动刷新一次 profile（让 userInfo 与服务端对齐），
// 并尝试连上 WebSocket 让未读消息能实时推送过来。
const userStore = useUserStore()
if (userStore.token) {
  userStore.fetchProfile().catch(() => {
    // 401 等情况由 http 拦截器统一处理
  })
  connectChatWs(userStore.token)
}
