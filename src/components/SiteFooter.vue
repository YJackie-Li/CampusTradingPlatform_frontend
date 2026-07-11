<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowUp } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

const isLoggedIn = computed(() => userStore.isLoggedIn)

// 备案号占位 —— 后续接入真实备案后填入实际链接
// ICP 备案：工信部备案号（例如 粤ICP备2026000000号-1）
// 公网安备案：公安部备案号（例如 粤公网安备 44010000000000号）
const icpBeian = {
  text: '津ICP备2026002669号-1',
  url: 'https://beian.miit.gov.cn/',
}
const wanganBeian = {
  text: '津公网安备12011602300887号',
  url: 'https://beian.mps.gov.cn/#/query/webSearch?code=12011602300887',
}

const handleTop = () =>
  window.scrollTo({ top: 0, behavior: 'smooth' })
</script>

<template>
  <footer class="site-footer">
    <!-- CTA 区（仅未登录时显示） -->
    <section v-if="!isLoggedIn" class="cta-section">
      <div class="cta-deco">
        <span class="deco-circle deco-circle-1"></span>
        <span class="deco-circle deco-circle-2"></span>
      </div>
      <h2 class="cta-title">还没加入校园淘物?</h2>
      <p class="cta-subtitle">注册账号，开启你的校园闲置好物之旅</p>
      <div class="cta-buttons">
        <el-button class="btn-register" round @click="router.push('/register')">
          立即注册
        </el-button>
        <el-button class="btn-login" round @click="router.push('/login')">
          已有账号？立即登录
        </el-button>
      </div>
      <button class="top-fab" title="回到顶部" @click="handleTop">
        <el-icon><ArrowUp /></el-icon>
      </button>
    </section>

    <!-- 备案区 -->
    <section class="beian-section">
      <div class="beian-inner">
        <p class="copyright">© 2026 Rigenketsu · 校园淘物. All Rights Reserved.</p>
        <p class="beian-list">
          <!-- ICP 备案号 -->
          <a
            class="beian-link"
            :href="icpBeian.url"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg viewBox="0 0 1024 1024" class="beian-gov-icon" aria-hidden="true">
              <path
                d="M512 64C264.96 64 64 264.96 64 512s200.96 448 448 448 448-200.96 448-448S759.04 64 512 64z m0 832c-212.08 0-384-171.92-384-384s171.92-384 384-384 384 171.92 384 384-171.92 384-384 384z"
                fill="currentColor"
              />
              <path
                d="M512 224c-159.04 0-288 128.96-288 288s128.96 288 288 288 288-128.96 288-288-128.96-288-288-288z m0 480c-106.04 0-192-85.96-192-192s85.96-192 192-192 192 85.96 192 192-85.96 192-192 192z"
                fill="currentColor"
              />
              <path
                d="M576 432h-128v160h64v-32h32v32h32v-160z m-64 32h32v32h-32v-32z"
                fill="currentColor"
              />
            </svg>
            {{ icpBeian.text }}
          </a>
          <!-- 公网安备案号 -->
          <a
            class="beian-link"
            :href="wanganBeian.url"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src="/gongan-beian.png"
              alt="公网安备案图标"
              class="beian-gongan-icon"
            />
            {{ wanganBeian.text }}
          </a>
        </p>
      </div>
    </section>
  </footer>
</template>

<style scoped>
.site-footer {
  margin-top: auto;
}

/* ========== CTA 区 ========== */
.cta-section {
  position: relative;
  background: linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 60%, #1a1a1a 100%);
  color: #fff;
  padding: 56px 24px 72px;
  text-align: center;
  overflow: hidden;
}
.cta-deco {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.deco-circle {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(
    circle at 30% 30%,
    rgba(255, 140, 90, 0.18),
    rgba(255, 107, 53, 0.04) 70%
  );
}
.deco-circle-1 {
  width: 280px;
  height: 280px;
  top: -80px;
  left: 10%;
}
.deco-circle-2 {
  width: 220px;
  height: 220px;
  bottom: -60px;
  right: 8%;
  background: radial-gradient(
    circle at 30% 30%,
    rgba(106, 130, 251, 0.18),
    rgba(99, 102, 241, 0.04) 70%
  );
}
.cta-title {
  position: relative;
  font-size: 26px;
  font-weight: 700;
  margin: 0 0 8px;
  letter-spacing: 2px;
}
.cta-subtitle {
  position: relative;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.65);
  margin: 0 0 24px;
}
.cta-buttons {
  position: relative;
  display: inline-flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}
.btn-register {
  background: linear-gradient(135deg, #ff8c5a 0%, #ff6b35 100%) !important;
  border: none !important;
  color: #fff !important;
  padding: 10px 28px !important;
  height: 40px !important;
  font-size: 14px !important;
  font-weight: 500 !important;
  box-shadow: 0 4px 12px rgba(255, 107, 53, 0.35) !important;
}
.btn-login {
  background: transparent !important;
  border: 1.5px solid rgba(255, 255, 255, 0.45) !important;
  color: #fff !important;
  padding: 10px 28px !important;
  height: 40px !important;
  font-size: 14px !important;
}
.btn-login:hover {
  border-color: #fff !important;
  background: rgba(255, 255, 255, 0.06) !important;
}

/* 回到顶部圆按钮 */
.top-fab {
  position: absolute;
  right: 38px;
  bottom: 24px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ff8c5a 0%, #ff6b35 100%);
  color: #fff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(255, 107, 53, 0.4);
  transition: transform 0.2s;
}
.top-fab:hover {
  transform: translateY(-2px) scale(1.05);
}

/* ========== 备案区 ========== */
.beian-section {
  background: #141414;
  color: rgba(255, 255, 255, 0.55);
  padding: 18px 24px;
}
.beian-inner {
  max-width: 1280px;
  margin: 0 auto;
  text-align: center;
}
.copyright {
  margin: 0 0 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  letter-spacing: 0.5px;
}
.beian-list {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 18px;
  font-size: 12px;
  flex-wrap: wrap;
  justify-content: center;
}
.beian-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.65);
  text-decoration: none;
  transition: color 0.2s;
}
.beian-link:hover {
  color: #ff8c5a;
}
.beian-gov-icon {
  width: 14px;
  height: 14px;
}
.police-badge {
  display: inline-flex;
  align-items: center;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 3px;
  padding: 1px 2px;
}
.beian-gov-icon {
  color: rgba(255, 140, 90, 0.85);
}
.beian-gongan-icon {
  height: 18px;
  width: auto;
  vertical-align: middle;
}
@media (max-width: 640px) {
  .cta-section { padding: 40px 16px 60px; }
  .cta-title { font-size: 22px; }
  .top-fab { right: 16px; bottom: 16px; width: 40px; height: 40px; }
}
</style>
