<template>
  <div class="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/70 p-4 text-ink-900 backdrop-blur-md dark:bg-ink-950/80 dark:text-ink-50">
    <div class="w-full max-w-md rounded-2xl bg-surface p-6 shadow-elevated border border-outline/20 flex flex-col gap-4 text-center">
      <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-container text-primary">
        <!-- 內嵌 SVG 代替 Material Font 以避免快取載入延遲 -->
        <svg class="h-7 w-7 animate-pulse" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
        </svg>
      </div>
      <h2 class="text-xl font-bold tracking-tight text-on-surface">服務已搬遷新址</h2>
      <p class="text-sm text-ink-500 leading-relaxed dark:text-ink-300">
        親愛的使用者您好，本平台已正式搬遷至新網址：<br>
        <span class="font-semibold text-primary select-all break-all text-base block mt-2">nnkieh-novae.vercel.app</span>
      </p>
      <p class="text-xs text-ink-400 leading-relaxed">
        為避免資料同步與連線問題，您可以將手上這版應用程式（PWA）或書籤刪除，並前往新網址重新安裝最新版本。
      </p>
      <div class="mt-2 flex flex-col gap-2">
        <button
          @click="copyUrl"
          class="w-full button-primary flex items-center justify-center gap-2 py-2.5 font-semibold text-sm cursor-pointer"
        >
          <!-- 複製按鈕內嵌 SVG -->
          <svg v-if="copied" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          <svg v-else class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          {{ copied ? '已複製新網址！' : '複製新網址' }}
        </button>
        <a
          href="https://nnkieh-novae.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          class="w-full button-secondary flex items-center justify-center gap-2 py-2.5 font-semibold text-sm"
        >
          <!-- 跳轉按鈕內嵌 SVG -->
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
          直接前往新網站
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const copied = ref(false);

async function copyUrl() {
  try {
    await navigator.clipboard.writeText('https://nnkieh-novae.vercel.app');
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (err) {
    // 降級處理
    const el = document.createElement('textarea');
    el.value = 'https://nnkieh-novae.vercel.app';
    document.body.appendChild(el);
    el.select();
    try {
      document.execCommand('copy');
      copied.value = true;
    } catch (e) {
      console.error('Copy failed', e);
    }
    document.body.removeChild(el);
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  }
}
</script>
