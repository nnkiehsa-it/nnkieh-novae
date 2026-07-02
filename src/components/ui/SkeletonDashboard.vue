<template>
  <div class="space-y-5" aria-label="平台統計載入中" aria-busy="true">
    <header class="space-y-3 border-b border-ink-200/80 pb-5 dark:border-ink-800/80">
      <span class="block h-6 w-24 rounded-full bg-ink-200/60 animate-pulse dark:bg-ink-700/50"></span>
      <span class="block h-9 w-44 rounded bg-ink-200/60 animate-pulse dark:bg-ink-700/50"></span>
      <span class="block h-4 w-full max-w-md rounded bg-ink-200/60 animate-pulse dark:bg-ink-700/50"></span>
    </header>

    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article v-for="index in 4" :key="index" class="min-h-32 space-y-4 rounded-[1.25rem] border border-ink-200/90 bg-white p-5 shadow-note animate-pulse dark:border-ink-800/80 dark:bg-ink-900">
        <span class="block h-3 w-20 rounded bg-ink-200/60 dark:bg-ink-700/50"></span>
        <span class="block h-8 w-24 rounded bg-ink-200/60 dark:bg-ink-700/50"></span>
        <span class="block h-4 w-32 rounded bg-ink-200/60 dark:bg-ink-700/50"></span>
      </article>
    </section>

    <section class="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]">
      <div class="grid gap-5">
        <section class="dashboard-surface animate-pulse">
          <div class="flex items-center justify-between gap-4">
            <div class="space-y-2">
              <span class="block h-5 w-32 rounded bg-ink-200/60 dark:bg-ink-700/50"></span>
              <span class="block h-3.5 w-44 rounded bg-ink-200/60 dark:bg-ink-700/50"></span>
            </div>
            <span class="h-7 w-16 rounded-full bg-ink-200/60 dark:bg-ink-700/50"></span>
          </div>
          <div class="mt-4 space-y-px overflow-hidden rounded-2xl border border-ink-200/80 dark:border-ink-800/80">
            <div v-for="row in 4" :key="row" class="flex items-center gap-4 px-4 py-3">
              <span class="h-4 w-24 rounded bg-ink-200/60 dark:bg-ink-700/50"></span>
              <span class="h-2.5 flex-1 rounded-full bg-ink-200/60 dark:bg-ink-700/50"></span>
              <span class="h-4 w-10 rounded bg-ink-200/60 dark:bg-ink-700/50"></span>
            </div>
          </div>
        </section>

        <section class="dashboard-surface animate-pulse">
          <div class="flex items-center justify-between gap-4">
            <div class="space-y-2">
              <span class="block h-5 w-32 rounded bg-ink-200/60 dark:bg-ink-700/50"></span>
              <span class="block h-3.5 w-48 rounded bg-ink-200/60 dark:bg-ink-700/50"></span>
            </div>
            <span class="h-7 w-20 rounded-full bg-ink-200/60 dark:bg-ink-700/50"></span>
          </div>
          <div class="mt-4 space-y-px overflow-hidden rounded-2xl border border-ink-200/80 dark:border-ink-800/80">
            <div v-for="row in 3" :key="row" class="grid grid-cols-[1fr_5rem_5rem_4rem] items-center gap-3 px-4 py-3">
              <span class="h-4 rounded bg-ink-200/60 dark:bg-ink-700/50"></span>
              <span class="h-4 rounded bg-ink-200/60 dark:bg-ink-700/50"></span>
              <span class="h-4 rounded bg-ink-200/60 dark:bg-ink-700/50"></span>
              <span class="h-4 rounded bg-ink-200/60 dark:bg-ink-700/50"></span>
            </div>
          </div>
        </section>
      </div>

      <div class="grid gap-5">
        <section v-for="index in 2" :key="index" class="dashboard-surface min-h-52 animate-pulse">
          <div class="space-y-2">
            <span class="block h-5 w-32 rounded bg-ink-200/60 dark:bg-ink-700/50"></span>
            <span class="block h-3.5 w-40 rounded bg-ink-200/60 dark:bg-ink-700/50"></span>
          </div>
          <div class="mt-6 space-y-5">
            <div v-for="row in 3" :key="row" class="flex items-center gap-3">
              <span class="h-4 w-14 rounded bg-ink-200/60 dark:bg-ink-700/50"></span>
              <span class="h-2.5 flex-1 rounded-full bg-ink-200/60 dark:bg-ink-700/50"></span>
              <span class="h-5 w-10 rounded bg-ink-200/60 dark:bg-ink-700/50"></span>
            </div>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>
