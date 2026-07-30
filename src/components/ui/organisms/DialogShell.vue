<template>
  <DialogOverlay
    :open="open"
    :no-padding="noPadding"
    :overlay-class="overlayClass"
    :padded="padded"
    :persistent="persistent"
    :presentation="resolvedPresentation"
    :transition-name="transitionName"
    :z-index-class="zIndexClass"
    @close="handleClose"
  >
    <section
      ref="dialogRef"
      class="dialog-surface surface-card"
      :class="[paddedSurface ? 'surface-pad-lg' : '', surfaceClass, { 'bottom-sheet-surface': isSheet, 'bottom-sheet-surface--dragging': dragging }]"
      :style="sheetStyle"
      data-dialog-root
      :role="role"
      aria-modal="true"
      :aria-busy="busy ? 'true' : undefined"
      :aria-labelledby="labelledBy || undefined"
      :aria-describedby="describedBy || undefined"
      tabindex="-1"
    >
      <div
        v-if="isSheet"
        class="bottom-sheet-handle-area"
        aria-hidden="true"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerCancel"
      >
        <span class="bottom-sheet-handle"></span>
      </div>
      <slot />
    </section>
  </DialogOverlay>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRef } from 'vue';
import DialogOverlay from '@/components/ui/molecules/DialogOverlay.vue';
import { useBodyScrollLock } from '@/composables/useBodyScrollLock';
import { useDialogFocus } from '@/composables/useDialogFocus';
import { useBottomSheetDrag } from '@/composables/useBottomSheetDrag';
import { useOverlayBack } from '@/composables/useOverlayBack';

const props = withDefaults(defineProps<{
  busy?: boolean;
  closeable?: boolean;
  describedBy?: string;
  labelledBy?: string;
  noPadding?: boolean;
  overlayClass?: string;
  open: boolean;
  padded?: boolean;
  paddedSurface?: boolean;
  persistent?: boolean;
  presentation?: 'adaptive' | 'dialog' | 'fullscreen' | 'sheet';
  role?: 'alertdialog' | 'dialog';
  surfaceClass?: string;
  transitionName?: string;
  zIndexClass?: string;
}>(), {
  busy: false,
  closeable: true,
  describedBy: '',
  labelledBy: '',
  noPadding: false,
  overlayClass: '',
  padded: true,
  paddedSurface: true,
  persistent: false,
  presentation: 'adaptive',
  role: 'dialog',
  surfaceClass: 'w-full max-w-lg',
  transitionName: 'dialog',
  zIndexClass: 'z-50',
});

const emit = defineEmits<{
  close: [reason?: 'back' | 'drag' | 'escape' | 'overlay'];
}>();

function handleClose(reason: 'back' | 'drag' | 'escape' | 'overlay' = 'overlay') {
  if (props.closeable && !props.busy && !props.persistent) emit('close', reason);
}

const isOpen = toRef(props, 'open');
const coarsePointer = ref(false);
let coarsePointerQuery: MediaQueryList | null = null;
function syncCoarsePointer() {
  coarsePointer.value = coarsePointerQuery?.matches ?? false;
}
const resolvedPresentation = computed(() => props.noPadding
  ? 'fullscreen'
  : props.presentation === 'adaptive'
  ? (coarsePointer.value ? 'sheet' : 'dialog')
  : props.presentation);
const isSheet = computed(() => resolvedPresentation.value === 'sheet');
const dragDisabled = computed(() => props.busy || props.persistent || !props.closeable || !isSheet.value);
const { dialogRef } = useDialogFocus(isOpen, { onClose: () => handleClose('escape') });
const { dragging, onPointerCancel, onPointerDown, onPointerMove, onPointerUp, style: sheetStyle } = useBottomSheetDrag({
  disabled: dragDisabled,
  onClose: () => handleClose('drag'),
  surface: dialogRef,
});

onMounted(() => {
  coarsePointerQuery = window.matchMedia('(max-width: 767px) and (pointer: coarse)');
  syncCoarsePointer();
  coarsePointerQuery.addEventListener('change', syncCoarsePointer);
});
onBeforeUnmount(() => coarsePointerQuery?.removeEventListener('change', syncCoarsePointer));

useBodyScrollLock(isOpen);
useOverlayBack(computed(() => isOpen.value && isSheet.value), () => handleClose('back'));
</script>
