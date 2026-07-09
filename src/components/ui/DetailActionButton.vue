<template>
  <button
    type="button"
    class="button-secondary button-action"
    :class="[
      active ? 'button-action--active' : '',
      danger ? 'text-error dark:text-error' : '',
      compact ? '!h-8 !min-h-0 !gap-1 !px-2.5 text-xs' : '',
    ]"
    :disabled="disabled"
    :title="title || label"
    :aria-label="ariaLabel || label"
    @click="emit('click')"
  >
    <slot />
    <span>{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  active?: boolean;
  ariaLabel?: string;
  danger?: boolean;
  disabled?: boolean;
  label: string;
  title?: string;
  compact?: boolean;
}>(), {
  active: false,
  ariaLabel: '',
  danger: false,
  disabled: false,
  title: '',
  compact: false,
});

const emit = defineEmits<{
  click: [];
}>();
</script>
