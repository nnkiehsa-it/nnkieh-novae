<template>
  <PopoverRoot :open="open" @update:open="handleOpenChange">
    <PopoverAnchor as-child>
      <div ref="rootRef" class="relative inline-block text-left">
        <slot name="trigger" :open="open" :toggle="toggle" />
      </div>
    </PopoverAnchor>

    <PopoverPortal>
      <Transition name="popover">
        <PopoverContent
          v-if="open"
          as-child
          align="end"
          :collision-padding="12"
          :side-offset="8"
          position-strategy="fixed"
          @close-auto-focus="handleCloseAutoFocus"
        >
          <DropdownPanel
            class="z-[120]"
            :class="panelClass"
            :size="size"
            :style="panelStyle"
            tabindex="-1"
            @click.stop
            @pointerdown.stop
          >
            <slot :close="close" />
          </DropdownPanel>
        </PopoverContent>
      </Transition>
    </PopoverPortal>
  </PopoverRoot>
</template>

<script setup lang="ts">
import { PopoverAnchor, PopoverContent, PopoverPortal, PopoverRoot } from 'reka-ui';
import { computed, nextTick, ref, useTemplateRef } from 'vue';
import DropdownPanel from '@/components/ui/molecules/DropdownPanel.vue';

const props = withDefaults(defineProps<{
  panelClass?: string;
  size?: 'compact' | 'default' | 'search';
  width?: number | 'content';
}>(), {
  panelClass: '',
  size: 'compact',
  width: 176,
});

const open = ref(false);
const rootRef = useTemplateRef<HTMLElement>('rootRef');
let triggerElement: HTMLElement | null = null;
let restoreFocusOnClose = true;
const panelStyle = computed(() => ({
  maxWidth: 'calc(100vw - 1.5rem)',
  transformOrigin: 'var(--reka-popover-content-transform-origin)',
  width: props.width === 'content' ? 'max-content' : `${props.width}px`,
}));

function resolveTriggerElement() {
  const root = rootRef.value;
  if (!root) return null;
  if (document.activeElement instanceof HTMLElement && root.contains(document.activeElement)) {
    return document.activeElement;
  }
  return root.querySelector<HTMLElement>(
    'button:not(:disabled), a[href], [role="button"], [tabindex]:not([tabindex="-1"])',
  );
}

function close(restoreFocus = true) {
  if (!open.value) return;
  restoreFocusOnClose = restoreFocus;
  open.value = false;
}

function toggle() {
  if (open.value) {
    close();
    return;
  }
  triggerElement = resolveTriggerElement();
  open.value = true;
}

function openMenu() {
  if (open.value) return;
  triggerElement = resolveTriggerElement();
  open.value = true;
}

function handleOpenChange(nextOpen: boolean) {
  if (nextOpen && !triggerElement) triggerElement = resolveTriggerElement();
  open.value = nextOpen;
}

function handleCloseAutoFocus(event: Event) {
  event.preventDefault();
  const focusTarget = restoreFocusOnClose ? triggerElement : null;
  triggerElement = null;
  restoreFocusOnClose = true;
  void nextTick(() => {
    if (focusTarget?.isConnected) focusTarget.focus({ preventScroll: true });
  });
}

defineExpose({ close, open: openMenu, toggle });

defineSlots<{
  default(props: { close: () => void }): unknown;
  trigger(props: { open: boolean; toggle: () => void }): unknown;
}>();
</script>
