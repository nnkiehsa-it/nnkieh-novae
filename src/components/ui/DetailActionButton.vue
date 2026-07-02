<template>
  <button
    type="button"
    class="button-secondary button-action"
    :class="[
      active ? 'text-red-600 dark:text-red-300' : '',
      danger ? 'text-error dark:text-error' : '',
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
}>(), {
  active: false,
  ariaLabel: '',
  danger: false,
  disabled: false,
  title: '',
});

const emit = defineEmits<{
  click: [];
}>();
</script>
