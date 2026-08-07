<template>
  <button
    :type="type"
    :class="['max-w-full', variantClass, sizeClass, { 'button-toolbar--active': active && variant === 'toolbar', 'w-full': block, 'app-button--stateful': resolvedState !== 'idle' }]"
    :disabled="disabled || resolvedState !== 'idle'"
    :aria-busy="resolvedState === 'busy' ? 'true' : undefined"
  >
    <BusyButtonContent v-if="resolvedState !== 'idle'" :state="resolvedState" :spinner-size="spinnerSize">
      <slot />
    </BusyButtonContent>
    <slot v-else />
  </button>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import BusyButtonContent from '@/components/ui/atoms/BusyButtonContent.vue';
import { useActionFeedback } from '@/composables/useActionFeedback';

type ButtonSize = 'sm' | 'md' | 'lg';
type ButtonVariant =
  | 'contextual'
  | 'danger'
  | 'danger-icon'
  | 'icon'
  | 'icon-filled'
  | 'icon-pill'
  | 'icon-pill-filled'
  | 'primary'
  | 'secondary'
  | 'toolbar';

const props = withDefaults(defineProps<{
  active?: boolean;
  block?: boolean;
  busy?: boolean;
  disabled?: boolean;
  spinnerSize?: number;
  state?: 'idle' | 'busy' | 'success';
  size?: ButtonSize;
  type?: 'button' | 'reset' | 'submit';
  variant?: ButtonVariant;
}>(), {
  active: false,
  block: false,
  busy: false,
  disabled: false,
  size: 'md',
  type: 'button',
  variant: 'secondary',
  spinnerSize: 4,
  state: 'idle',
});

const { actionPhase } = useActionFeedback();
const hadActiveOperation = ref(false);
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

const variantClass = computed(() => ({
  contextual: 'button-contextual',
  danger: 'button-danger',
  'danger-icon': 'button-danger-icon',
  icon: 'button-icon',
  'icon-filled': 'button-icon-filled',
  'icon-pill': 'button-icon-pill',
  'icon-pill-filled': 'button-icon-pill-filled',
  primary: 'button-primary',
  secondary: 'button-secondary',
  toolbar: 'button-toolbar',
})[props.variant]);

const sizeClass = computed(() => ({
  sm: props.variant === 'toolbar' ? 'h-8 min-h-8 text-xs' : 'h-9 min-h-9 text-xs',
  md: '',
  lg: 'min-h-12 px-5',
})[props.size]);
</script>
