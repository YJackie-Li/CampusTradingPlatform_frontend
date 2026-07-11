<script setup>
import TopNavbar from '@/components/TopNavbar.vue'
import SiteFooter from '@/components/SiteFooter.vue'
</script>

<template>
  <div class="user-layout">
    <TopNavbar />
    <main class="user-content">
      <router-view />
    </main>
    <SiteFooter />
  </div>
</template>

<style scoped>
.user-layout {
  min-height: 100vh;
  background: #f5f7fa;
  display: flex;
  flex-direction: column;
}

.user-content {
  flex: 1;
  padding: 18px 32px 32px;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}
</style>
