<template>
  <div class="relative z-30 inline-block text-left">
    <button
      ref="triggerRef"
      type="button"
      class="button-toolbar h-8 w-8 rounded-full p-0"
      :class="{ 'text-ink-800 dark:text-ink-100': isOpen }"
      :title="title"
      :aria-label="title"
      @click="isOpen = !isOpen"
    >
      <AppIcon name="more-horizontal" :size="4.5" :stroke-width="1.8" />
    </button>

    <Teleport to="body">
      <transition name="popover">
        <div
          v-if="isOpen"
          ref="dropdownRef"
          class="popover-panel popover-panel--compact fixed z-[100] w-44 origin-top-right"
          :style="dropdownStyle"
        >
          <div>
            <button
              type="button"
              class="menu-item menu-item-danger"
              :disabled="deleteDisabled"
              @click.stop="select('delete')"
            >
              <AppIcon name="trash" :size="3" />
              <span>{{ deleteLabel }}</span>
            </button>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { useClickOutside } from '@/composables/useClickOutside';
import { useDropdownPosition } from '@/composables/useDropdownPosition';

withDefaults(defineProps<{
  deleteDisabled?: boolean;
  deleteLabel?: string;
  title?: string;
}>(), {
  deleteDisabled: false,
  deleteLabel: '刪除公告',
  title: '管理',
});

const emit = defineEmits<{
  delete: [];
  'dropdown-open': [open: boolean];
}>();

const isOpen = ref(false);
const triggerRef = ref<HTMLButtonElement | null>(null);
const dropdownRef = ref<HTMLDivElement | null>(null);
const { dropdownStyle } = useDropdownPosition(
  triggerRef,
  isOpen,
  { fallbackHeight: 96, width: 176 },
  dropdownRef,
);

useClickOutside(isOpen, [triggerRef, dropdownRef], () => {
  isOpen.value = false;
});

function select(action: 'delete') {
  isOpen.value = false;
  emit('delete');
}

watch(isOpen, (open) => {
  emit('dropdown-open', open);
});
</script>
