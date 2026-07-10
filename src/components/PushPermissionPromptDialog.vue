<template>
  <DialogOverlay :open="open" padded z-index-class="z-[90]" @close="emit('dismiss')">
    <section
      ref="dialogRef"
      class="panel panel-pad dialog-card"
      data-dialog-root
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-permission-title"
      aria-describedby="push-permission-description"
      tabindex="-1"
    >
      <div class="flex items-start gap-4">
        <div
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary-container text-secondary dark:bg-secondary-container/40"
          aria-hidden="true"
        >
          <span class="material-symbols-outlined text-2xl">notifications</span>
        </div>
        <div class="min-w-0 flex-1">
          <h2 id="push-permission-title" class="dialog-title !mt-0">
            {{ mode === 'repair' ? '重新啟用推播通知' : '開啟推播通知' }}
          </h2>
          <p id="push-permission-description" class="dialog-description">
            {{ mode === 'repair'
              ? '這台裝置的通知連結需要更新，重新啟用後才能繼續收到推播通知。'
              : '可以在提案有留言或狀態更新時提醒你。你也可以之後在「設定」中調整通知類型。' }}
          </p>
        </div>
      </div>

      <div class="dialog-actions">
        <button
          type="button"
          class="button-secondary"
          :disabled="busy"
          @click="emit('dismiss')"
        >
          稍後
        </button>
        <button
          type="button"
          class="button-primary"
          :disabled="busy"
          data-autofocus
          @click="emit('enable')"
        >
          <BusyButtonContent
            :busy="busy"
            :label="mode === 'repair' ? '重新啟用' : '開啟通知'"
            busy-label="處理中..."
          />
        </button>
      </div>
    </section>
  </DialogOverlay>
</template>

<script setup lang="ts">
import { toRef } from 'vue';
import DialogOverlay from '@/components/ui/DialogOverlay.vue';
import BusyButtonContent from '@/components/ui/BusyButtonContent.vue';
import { useBodyScrollLock } from '@/composables/useBodyScrollLock';
import { useDialogFocus } from '@/composables/useDialogFocus';

const props = defineProps<{
  busy: boolean;
  mode?: 'permission' | 'repair';
  open: boolean;
}>();

const emit = defineEmits<{
  dismiss: [];
  enable: [];
}>();

useBodyScrollLock(toRef(props, 'open'));

const { dialogRef } = useDialogFocus(toRef(props, 'open'), {
  onClose: () => emit('dismiss'),
});
</script>
