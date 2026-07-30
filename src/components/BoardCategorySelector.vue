<template>
  <DropdownMenu
    class="!block min-w-0"
    panel-class="min-w-[11rem]"
    size="default"
    width="content"
  >
    <template #trigger="{ open, toggle }">
      <button
        type="button"
        class="flex max-w-full items-center text-ink-950 dark:text-ink-50"
        :class="variant === 'mobile-header'
          ? 'h-10 gap-1 text-2xl font-semibold leading-tight tracking-[0.015em]'
          : 'gap-1.5 text-2xl font-semibold tracking-[0.015em]'"
        :title="selectorLabel"
        :aria-label="selectorLabel"
        :aria-expanded="open"
        @click="toggle"
      >
        <span class="truncate">{{ label }}</span>
        <AppIcon
          name="chevron-down"
          :size="variant === 'mobile-header' ? 4.5 : 5"
          class="shrink-0 transition-transform"
          :class="{ 'rotate-180': open }"
        />
      </button>
    </template>

    <template #default="{ close }">
      <div class="dropdown-label mb-1.5 whitespace-nowrap">{{ selectorLabel }}</div>
      <div class="space-y-0.5">
        <button
          v-for="option in options"
          :key="option.value"
          type="button"
          class="dropdown-item justify-between gap-4 whitespace-nowrap"
          :class="{ 'button-toolbar--active': option.value === modelValue }"
          @click="select(option.value, close)"
        >
          <span>{{ option.label }}</span>
          <SelectionMark :selected="option.value === modelValue" />
        </button>
      </div>
    </template>
  </DropdownMenu>
</template>

<script setup lang="ts">
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import SelectionMark from '@/components/ui/atoms/SelectionMark.vue';
import DropdownMenu from '@/components/ui/molecules/DropdownMenu.vue';

defineProps<{
  label: string;
  modelValue: string;
  options: ReadonlyArray<{ label: string; value: string }>;
  selectorLabel: string;
  variant: 'desktop-heading' | 'mobile-header';
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

function select(value: string, close: () => void) {
  close();
  emit('update:modelValue', value);
}
</script>
