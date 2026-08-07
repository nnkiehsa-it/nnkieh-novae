<template>
  <span class="busy-button-content relative inline-grid place-items-center" :class="`is-${resolvedState}`">
    <span class="col-start-1 row-start-1 inline-flex items-center justify-center gap-2 transition-[opacity,transform] duration-200" :class="resolvedState === 'idle' ? 'opacity-100' : 'pointer-events-none opacity-0'">
      <slot>{{ t(label) }}</slot>
    </span>
    <span class="col-start-1 row-start-1 inline-flex items-center justify-center transition-[opacity,transform] duration-200" :class="resolvedState === 'busy' ? 'opacity-100' : 'pointer-events-none opacity-0 scale-90'" aria-hidden="true">
      <LoadingSpinner :size="spinnerSize" class="busy-button-spinner shrink-0" />
    </span>
    <span class="col-start-1 row-start-1 inline-flex items-center justify-center transition-[opacity,transform] duration-200" :class="resolvedState === 'success' ? 'opacity-100 scale-100' : 'pointer-events-none opacity-0 scale-75'" aria-hidden="true">
      <AppIcon name="check" :size="5" :stroke-width="2.4" aria-hidden="true" />
    </span>
  </span>
</template>

<script setup lang="ts">
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import LoadingSpinner from '@/components/ui/atoms/LoadingSpinner.vue';
import { computed, ref, watch } from 'vue';
import { useI18n } from '@/i18n';
import { useActionFeedback } from '@/composables/useActionFeedback';

const { t } = useI18n();
const { actionPhase } = useActionFeedback();
const hadActiveOperation = ref(false);

const props = withDefaults(defineProps<{
  busy?: boolean;
  label?: string;
  busyLabel?: string;
  spinnerSize?: number;
  state?: 'idle' | 'busy' | 'success';
}>(), {
  busy: false,
  label: '',
  busyLabel: '',
  spinnerSize: 4,
  state: 'idle',
});

watch(() => props.busy, (busy) => {
  if (busy) hadActiveOperation.value = true;
});
watch(actionPhase, (phase) => {
  if (phase === 'idle') hadActiveOperation.value = false;
});

const resolvedState = computed(() => {
  if (props.state !== 'idle') return props.state;
  if (props.busy) return actionPhase.value;
  return hadActiveOperation.value && actionPhase.value === 'success' ? 'success' : 'idle';
});
</script>

<style scoped>
.busy-button-spinner {
  box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 24%, transparent);
  animation: busy-spinner-ring 1.2s ease-out infinite;
}

.busy-button-content.is-success .busy-button-spinner {
  animation: none;
}

@keyframes busy-spinner-ring {
  60%, 100% { box-shadow: 0 0 0 0.3rem transparent; }
}

@media (prefers-reduced-motion: reduce) {
  .busy-button-spinner { animation: none; }
}
</style>
