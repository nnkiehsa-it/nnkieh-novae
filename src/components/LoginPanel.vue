<template>
  <section class="panel panel-pad relative mx-auto my-8 flex max-w-2xl flex-col items-center justify-center overflow-hidden px-6 py-12 text-center sm:px-12">
    <DecorativeGlow size="md" />

    <div class="relative z-10 flex max-w-md flex-col items-center space-y-6">
      <span class="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-950 text-white shadow-lg dark:bg-ink-50 dark:text-ink-950" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-8 w-8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
        </svg>
      </span>

      <div class="space-y-3">
        <h2 class="text-2xl font-bold tracking-tight text-ink-950 dark:text-ink-50 sm:text-3xl">歡迎使用學生學權提案平台</h2>
        <p class="text-sm leading-relaxed text-ink-500 dark:text-ink-400">
          這是一個專屬於學生的權益倡議與溝通平台。<br>請先使用您的
          <span class="font-semibold text-primary">校內 Google 帳號 (@{{ allowedDomain || '未設定環境變數' }})</span>
          進行登入以瀏覽並參與提案。
        </p>
      </div>

      <div class="flex w-full flex-col items-center gap-3">
        <GoogleLoginButton :loading="loading" @login="login" />

        <p v-if="error" class="mt-2 max-w-sm rounded-lg border border-error/20 bg-error-container px-3 py-1.5 text-xs font-medium text-on-error-container">
          {{ error }}
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import DecorativeGlow from '@/components/ui/DecorativeGlow.vue';
import GoogleLoginButton from '@/components/ui/GoogleLoginButton.vue';
import { useSession } from '@/composables/useSession';

const { allowedDomain, error, loading, login } = useSession();
</script>
