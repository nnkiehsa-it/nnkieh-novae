<template>
  <DialogOverlay :open="open" padded>
    <section
      ref="dialogRef"
      class="panel panel-pad dialog-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-update-title"
      data-dialog-root
      tabindex="-1"
    >
      <div class="flex items-start gap-4">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-container text-primary dark:bg-primary-container/40" aria-hidden="true">
          <AppIcon name="refresh" :size="6" :stroke-width="1.8" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="dialog-eyebrow">應用程式更新</p>
          <h2 id="app-update-title" class="dialog-title">有新版本可用</h2>
          <p class="dialog-description">目前版本已停止使用，請更新以取得最新內容並繼續操作。</p>
        </div>
      </div>
      <div class="dialog-actions">
        <button type="button" class="button-primary" :disabled="busy" data-autofocus @click="emit('reload')">
          <BusyButtonContent :busy="Boolean(busy)" label="更新" busy-label="更新中" />
        </button>
      </div>
    </section>
  </DialogOverlay>
</template>

<script setup lang="ts">
import { toRef } from 'vue';
import DialogOverlay from '@/components/ui/DialogOverlay.vue';
import BusyButtonContent from '@/components/ui/BusyButtonContent.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { useBodyScrollLock } from '@/composables/useBodyScrollLock';
import { useDialogFocus } from '@/composables/useDialogFocus';

const props = defineProps<{
  busy?: boolean;
  open: boolean;
}>();

const emit = defineEmits<{
  reload: [];
}>();

useBodyScrollLock(toRef(props, 'open'));
const { dialogRef } = useDialogFocus(toRef(props, 'open'), {
  onClose: () => undefined,
});
</script>
