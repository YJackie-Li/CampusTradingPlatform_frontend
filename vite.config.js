import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 33333,
    strictPort: false,
    open: false,
    // 把所有 /api/** 请求转发到后端，避免浏览器跨域；
    // /static/upload/** 也要转发，否则浏览器去 33333 端口找图片会 404
    // /ws/** 必须转发：SockJS 同时走 WebSocket 与 XHR 回退
    // （xhr_streaming / xhr / xhr_send 等子路径都会落到这里）
    // 后端实际地址以 application.yml 的 server.port 为准（默认 8080）
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/static/upload': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
