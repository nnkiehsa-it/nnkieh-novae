<template>
  <button
    :type="type"
    :class="['max-w-full', variantClass, sizeClass, { 'button-toolbar--active': active && variant === 'toolbar', 'w-full': block, 'app-button--stateful': state !== 'idle' }]"
    :disabled="disabled || state !== 'idle'"
    :aria-busy="state === 'busy' ? 'true' : undefined"
  >
    <BusyButtonContent v-if="state !== 'idle'" :state="state" :spinner-size="spinnerSize">
      <slot />
    </BusyButtonContent>
    <slot v-else />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import BusyButtonContent from '@/components/ui/atoms/BusyButtonContent.vue';

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
  disabled?: boolean;
  spinnerSize?: number;
  state?: 'idle' | 'busy' | 'success';
  size?: ButtonSize;
  type?: 'button' | 'reset' | 'submit';
  variant?: ButtonVariant;
}>(), {
  active: false,
  block: false,
  disabled: false,
  size: 'md',
  type: 'button',
  variant: 'secondary',
  spinnerSize: 4,
  state: 'idle',
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
