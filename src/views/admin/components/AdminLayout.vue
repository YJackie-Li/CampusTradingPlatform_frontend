<script setup>
import AdminSidebar from './AdminSidebar.vue'
import AdminHeader from './AdminHeader.vue'
import SiteFooter from '@/components/SiteFooter.vue'
</script>

<template>
  <div class="admin-layout">
    <AdminSidebar />
    <div class="admin-main">
      <AdminHeader />
      <main class="admin-content">
        <router-view />
      </main>
      <SiteFooter />
    </div>
  </div>
</template>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: #f5f7fa;
}

.admin-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.admin-content {
  flex: 1;
  padding: 18px 24px 32px;
  overflow-x: hidden;
}
</style>
