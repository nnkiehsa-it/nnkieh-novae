<template>
  <div v-if="mobile" class="relative inline-block text-left">
    <slot name="trigger" :open="sheetOpen" :toggle="toggleSheet" />
    <DialogShell
      :open="sheetOpen"
      presentation="sheet"
      padded
      :padded-surface="false"
      :labelled-by="titleId"
      surface-class="adaptive-action-sheet"
      @close="closeSheet"
    >
      <header class="action-sheet-header">
        <h2 :id="titleId" class="action-sheet-title">{{ title }}</h2>
      </header>
      <div class="action-sheet-actions scrollbar-subtle max-h-[min(60dvh,28rem)] overflow-y-auto">
        <slot :close="closeSheet" />
      </div>
    </DialogShell>
  </div>
  <DropdownMenu
    v-else
    ref="dropdownRef"
    :panel-class="panelClass"
    :size="size"
    :width="width"
  >
    <template #trigger="slotProps"><slot name="trigger" v-bind="slotProps" /></template>
    <template #default="slotProps"><slot v-bind="slotProps" /></template>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
import { ref, useId, watch } from 'vue';
import DropdownMenu from '@/components/ui/molecules/DropdownMenu.vue';
import DialogShell from '@/components/ui/organisms/DialogShell.vue';

const props = withDefaults(defineProps<{
  panelClass?: string;
  size?: 'compact' | 'default' | 'search';
  title: string;
  width?: number;
}>(), {
  panelClass: '',
  size: 'compact',
  width: 176,
});

const titleId = `adaptive-action-${useId()}`;
const mobile = useMediaQuery('(max-width: 767px) and (pointer: coarse)');
const sheetOpen = ref(false);
const dropdownRef = ref<InstanceType<typeof DropdownMenu> | null>(null);

function closeSheet() { sheetOpen.value = false; }
function toggleSheet() { sheetOpen.value = !sheetOpen.value; }
function open() {
  if (mobile.value) sheetOpen.value = true;
  else dropdownRef.value?.open();
}

watch(mobile, (isMobile) => {
  if (!isMobile) sheetOpen.value = false;
});

defineExpose({ close: closeSheet, open });
defineSlots<{
  default(props: { close: () => void }): unknown;
  trigger(props: { open: boolean; toggle: () => void }): unknown;
}>();
</script>
