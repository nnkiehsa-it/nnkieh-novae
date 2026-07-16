<template>
  <DialogOverlay :open="open" padded z-index-class="z-[110]" @close="handleClose">
    <section
      ref="dialogRef"
      class="panel panel-pad w-full max-w-lg"
      data-dialog-root
      role="dialog"
      aria-modal="true"
      :aria-labelledby="dialogTitleId"
      :aria-busy="saving ? 'true' : undefined"
      tabindex="-1"
    >
      <h3 :id="dialogTitleId" class="dialog-title">{{ step === 1 ? selectTitle : resultTitle }}</h3>
      <p class="dialog-description">{{ step === 1 ? selectDescription : resultDescription }}</p>

      <div class="mt-5 space-y-4">
        <div v-if="step === 1">
          <p class="field-label mb-2">下一個狀態</p>
          <div class="grid gap-2">
            <SelectionOptionButton
              v-for="option in options"
              :key="option.value"
              :label="option.label"
              :description="option.description"
              :selected="status === option.value"
              :disabled="saving"
              @select="status = option.value"
            />
          </div>
          <p
            v-if="statusWarnings[status]"
            class="mt-4 rounded-xl border border-warning/20 bg-warning-container/40 px-3 py-2 text-xs font-semibold leading-5 text-on-warning-container"
          >
            {{ statusWarnings[status] }}
          </p>
        </div>

        <div v-else class="space-y-2">
          <label class="field-label" :for="resultInputId">{{ resultLabel }}</label>
          <div class="overflow-hidden rounded-[var(--radius-inner)] border-0 bg-surface shadow-note transition-colors focus-within:ring-2 focus-within:ring-outline/25 dark:bg-surface">
            <textarea
              :id="resultInputId"
              v-model="result"
              class="block min-h-36 w-full resize-none bg-transparent px-4 py-3 text-base leading-6 text-ink-800 outline-none placeholder:text-ink-400 disabled:cursor-not-allowed disabled:text-ink-500 dark:text-ink-100 dark:placeholder:text-ink-500 md:text-sm"
              :maxlength="resultMaxLength"
              :placeholder="resultPlaceholder"
              :disabled="saving"
            ></textarea>
            <div class="flex items-center justify-end border-t border-ink-100 bg-ink-50/50 px-4 py-2 text-xs font-medium text-ink-500 dark:border-ink-800 dark:bg-ink-950/30 dark:text-ink-400">
              <span :class="{ 'text-error': result.length > resultWarningLength }">
                {{ result.length }} / {{ resultMaxLength }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <p v-if="localError || error" class="mt-3 text-xs font-semibold text-error">
        {{ localError || error }}
      </p>

      <div class="dialog-actions">
        <button type="button" class="button-secondary" :disabled="saving" @click="handleSecondary">
          {{ step === 1 ? '取消' : '返回' }}
        </button>
        <button type="button" class="button-primary" :disabled="saving || !status" @click="handlePrimary">
          <BusyButtonContent :busy="saving" :label="primaryLabel" busy-label="更新中" />
        </button>
      </div>
    </section>
  </DialogOverlay>
</template>

<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue';
import BusyButtonContent from '@/components/ui/BusyButtonContent.vue';
import DialogOverlay from '@/components/ui/DialogOverlay.vue';
import SelectionOptionButton from '@/components/ui/SelectionOptionButton.vue';
import { useBodyScrollLock } from '@/composables/useBodyScrollLock';
import { useDialogFocus } from '@/composables/useDialogFocus';

interface StatusOption {
  description: string;
  label: string;
  value: string;
}

const props = withDefaults(defineProps<{
  dialogTitleId: string;
  error?: string;
  initialResult?: string;
  initialStatus: string;
  open: boolean;
  options: StatusOption[];
  resultDescription: string;
  resultInputId: string;
  resultLabel: string;
  resultMaxLength: number;
  resultPlaceholder: string;
  resultRequiredError: string;
  resultStatuses: string[];
  resultTitle: string;
  resultWarningLength: number;
  saving?: boolean;
  selectDescription?: string;
  selectTitle: string;
  statusWarnings?: Record<string, string>;
}>(), {
  error: '',
  initialResult: '',
  saving: false,
  selectDescription: '請選擇下一個狀態。',
  statusWarnings: () => ({}),
});

const emit = defineEmits<{
  close: [];
  submit: [status: string, result: string];
}>();

const status = ref('');
const result = ref('');
const localError = ref('');
const step = ref(1);
const requiresResult = computed(() => props.resultStatuses.includes(status.value));
const primaryLabel = computed(() => step.value === 1 && requiresResult.value ? '下一步' : '確認');
const isOpen = toRef(props, 'open');

useBodyScrollLock(isOpen);
function handleClose() {
  if (!props.saving) emit('close');
}
const { dialogRef } = useDialogFocus(isOpen, { onClose: handleClose });

function handlePrimary() {
  localError.value = '';
  if (!status.value) return;
  if (step.value === 1 && requiresResult.value) {
    step.value = 2;
    return;
  }
  const trimmedResult = result.value.trim();
  if (requiresResult.value && !trimmedResult) {
    localError.value = props.resultRequiredError;
    return;
  }
  emit('submit', status.value, trimmedResult);
}

function handleSecondary() {
  if (step.value === 2) {
    step.value = 1;
    localError.value = '';
    return;
  }
  handleClose();
}

watch(
  () => [props.open, props.initialStatus, props.initialResult, props.options] as const,
  () => {
    if (!props.open) return;
    status.value = props.options.some((option) => option.value === props.initialStatus)
      ? props.initialStatus
      : props.options[0]?.value ?? '';
    result.value = props.initialResult;
    localError.value = '';
    step.value = 1;
  },
  { immediate: true },
);
</script>
