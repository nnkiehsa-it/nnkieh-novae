<template>
  <div class="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/70 p-4 text-ink-900 backdrop-blur-md dark:bg-ink-950/80 dark:text-ink-50">
    <div class="w-full max-w-md rounded-2xl bg-surface p-6 shadow-elevated border border-outline/20 flex flex-col gap-4 text-center">
      <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-container text-primary">
        <span class="material-symbols-outlined text-3xl">open_in_new</span>
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
          <span class="material-symbols-outlined text-lg">{{ copied ? 'check' : 'content_copy' }}</span>
          {{ copied ? '已複製新網址！' : '複製新網址' }}
        </button>
        <a
          href="https://nnkieh-novae.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          class="w-full button-secondary flex items-center justify-center gap-2 py-2.5 font-semibold text-sm"
        >
          <span class="material-symbols-outlined text-lg">arrow_forward</span>
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
