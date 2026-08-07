<template>
  <DrawerRoot
    v-if="isSheet"
    :open="rootOpen"
    :modal="true"
    swipe-direction="down"
    @update:open="handleDrawerOpenChange"
  >
    <DrawerPortal>
      <Transition :name="transitionName" appear @after-leave="handleAfterLeave">
        <div
          v-if="visible"
          class="dialog-overlay fixed inset-0 flex items-center justify-center"
          :class="[zIndexClass, overlayClass]"
          :data-backdrop="isFullScreen ? 'none' : 'dimmed'"
          :data-padding="paddingMode"
          data-presentation="sheet"
        >
          <div class="dialog-backdrop" aria-hidden="true">
            <img
              v-if="backdropSnapshotUrl"
              class="dialog-backdrop__snapshot"
              :src="backdropSnapshotUrl"
              alt=""
            >
          </div>
          <DrawerOverlay force-mount class="dialog-backdrop-behavior" />
          <DrawerContent
            force-mount
            as="section"
            class="dialog-surface dialog-surface--panel surface-card bottom-sheet-surface"
            :class="[paddedSurface ? 'surface-pad-lg' : '', surfaceClass]"
            data-dialog-root
            :role="role"
            aria-modal="true"
            :aria-busy="busy ? 'true' : undefined"
            :aria-labelledby="labelledBy || undefined"
            :aria-describedby="describedBy || undefined"
            @escape-key-down="handleDismissEvent($event, 'escape')"
            @pointer-down-outside="handleDismissEvent($event, 'overlay')"
            @close-auto-focus="handleCloseAutoFocus"
            @focusin="keepFocusedControlVisible"
          >
            <DrawerTitle class="sr-only" aria-hidden="true">{{ labelledBy }}</DrawerTitle>
            <DrawerDescription v-if="describedBy" class="sr-only" aria-hidden="true">{{ describedBy }}</DrawerDescription>
            <DrawerHandle class="bottom-sheet-handle-area" aria-hidden="true">
              <span class="bottom-sheet-handle"></span>
            </DrawerHandle>
            <slot />
          </DrawerContent>
        </div>
      </Transition>
    </DrawerPortal>
  </DrawerRoot>

  <DialogRoot
    v-else
    :open="rootOpen"
    :modal="true"
    @update:open="handleDialogOpenChange"
  >
    <DialogPortal>
      <Transition :name="transitionName" appear @after-leave="handleAfterLeave">
        <div
          v-if="visible"
          class="dialog-overlay fixed inset-0 flex items-center justify-center"
          :class="[zIndexClass, overlayClass]"
          :data-backdrop="isFullScreen ? 'none' : 'dimmed'"
          :data-padding="paddingMode"
          :data-presentation="resolvedPresentation"
        >
          <div class="dialog-backdrop" aria-hidden="true">
            <img
              v-if="backdropSnapshotUrl"
              class="dialog-backdrop__snapshot"
              :src="backdropSnapshotUrl"
              alt=""
            >
          </div>
          <DialogOverlay force-mount class="dialog-backdrop-behavior" />
          <DialogContent
            force-mount
            as="section"
            class="dialog-surface dialog-surface--panel surface-card"
            :class="[paddedSurface ? 'surface-pad-lg' : '', surfaceClass]"
            data-dialog-root
            :role="role"
            aria-modal="true"
            :aria-busy="busy ? 'true' : undefined"
            :aria-labelledby="labelledBy || undefined"
            :aria-describedby="describedBy || undefined"
            @escape-key-down="handleDismissEvent($event, 'escape')"
            @pointer-down-outside="handleDismissEvent($event, 'overlay')"
            @close-auto-focus="handleCloseAutoFocus"
            @focusin="keepFocusedControlVisible"
          >
            <DialogTitle class="sr-only" aria-hidden="true">{{ labelledBy }}</DialogTitle>
            <DialogDescription v-if="describedBy" class="sr-only" aria-hidden="true">{{ describedBy }}</DialogDescription>
            <slot />
          </DialogContent>
        </div>
      </Transition>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DrawerContent,
  DrawerDescription,
  DrawerHandle,
  DrawerOverlay,
  DrawerPortal,
  DrawerRoot,
  DrawerTitle,
} from 'reka-ui';
import { useMediaQuery } from '@vueuse/core';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useDialogThemeColor } from '@/composables/useDialogThemeColor';
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

type CloseReason = 'back' | 'drag' | 'escape' | 'overlay';
type DrawerOpenChangeDetails = { reason?: string };

let pendingCloseReason: CloseReason = 'overlay';
let shouldRestoreFocus = false;
let focusScrollFrame: number | null = null;
let openRequestVersion = 0;
const rootOpen = ref(false);
const visible = ref(false);
const restoreFocusTarget = ref<HTMLElement | null>(null);
const backdropSnapshotUrl = ref<string | null>(null);

watch(
  () => props.open,
  (nextOpen, previousOpen) => {
    if (nextOpen && !previousOpen) {
      captureRestoreFocusTarget();
      void openWhenBackdropReady();
    }
    if (!nextOpen && previousOpen) {
      openRequestVersion += 1;
      shouldRestoreFocus = true;
      visible.value = false;
    }
  },
  { immediate: true },
);

function clearBackdropSnapshot() {
  if (backdropSnapshotUrl.value) URL.revokeObjectURL(backdropSnapshotUrl.value);
  backdropSnapshotUrl.value = null;
}

async function captureBackdropSnapshot() {
  if (typeof document === 'undefined' || isFullScreen.value) return null;
  const appRoot = document.querySelector<HTMLElement>('#app');
  if (!appRoot) return null;

  try {
    const { domToBlob } = await import('modern-screenshot');
    const blob = await domToBlob(appRoot, { scale: 0.5 });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
      return url;
    } catch {
      URL.revokeObjectURL(url);
      return null;
    }
  } catch {
    return null;
  }
}

async function openWhenBackdropReady() {
  const requestVersion = ++openRequestVersion;
  clearBackdropSnapshot();
  const snapshotUrl = await captureBackdropSnapshot();
  if (requestVersion !== openRequestVersion || !props.open) {
    if (snapshotUrl) URL.revokeObjectURL(snapshotUrl);
    return;
  }

  backdropSnapshotUrl.value = snapshotUrl;
  rootOpen.value = true;
  visible.value = true;
}

function handleAfterLeave() {
  if (visible.value) return;
  rootOpen.value = false;
  clearBackdropSnapshot();
  restoreFocus();
}

function handleClose(reason: CloseReason = 'overlay') {
  if (!props.closeable || props.busy || props.persistent) return;
  shouldRestoreFocus = true;
  emit('close', reason);
}

const coarsePointer = useMediaQuery('(max-width: 767px) and (pointer: coarse)');
const mobileViewport = useMediaQuery('(max-width: 767px)');
const resolvedPresentation = computed(() => props.noPadding
  ? 'fullscreen'
  : props.presentation === 'adaptive'
  ? (coarsePointer.value ? 'sheet' : 'dialog')
  : props.presentation);
const isSheet = computed(() => resolvedPresentation.value === 'sheet');
const isFullScreen = computed(() => props.noPadding || (!props.padded && mobileViewport.value));
const paddingMode = computed(() => {
  if (props.noPadding) return 'none';
  return props.padded ? 'padded' : 'responsive';
});
const canDismiss = computed(() => props.closeable && !props.busy && !props.persistent);

useDialogThemeColor(visible, isFullScreen);

function handleDismissEvent(event: Event, reason: Extract<CloseReason, 'escape' | 'overlay'>) {
  pendingCloseReason = reason;
  if (!canDismiss.value) event.preventDefault();
}

function captureRestoreFocusTarget() {
  if (typeof document === 'undefined') return;
  const activeElement = document.activeElement;
  restoreFocusTarget.value = activeElement instanceof HTMLElement && activeElement !== document.body
    ? activeElement
    : null;
}

function handleCloseAutoFocus(event: Event) {
  event.preventDefault();
  shouldRestoreFocus = true;
}

function restoreFocus() {
  if (!shouldRestoreFocus) return;
  shouldRestoreFocus = false;
  const target = restoreFocusTarget.value;
  restoreFocusTarget.value = null;
  void nextTick(() => {
    if (target?.isConnected) target.focus({ preventScroll: true });
  });
}

function keepFocusedControlVisible(event: FocusEvent) {
  const target = event.target;
  if (!(target instanceof HTMLElement) || focusScrollFrame !== null) return;
  focusScrollFrame = requestAnimationFrame(() => {
    focusScrollFrame = null;
    target.scrollIntoView({ block: 'nearest' });
  });
}

onBeforeUnmount(() => {
  openRequestVersion += 1;
  clearBackdropSnapshot();
  if (focusScrollFrame !== null) cancelAnimationFrame(focusScrollFrame);
});

function handleDialogOpenChange(nextOpen: boolean) {
  if (!nextOpen) handleClose(pendingCloseReason);
  pendingCloseReason = 'overlay';
}

function handleDrawerOpenChange(nextOpen: boolean, details?: DrawerOpenChangeDetails) {
  if (!nextOpen) {
    const reason: CloseReason = details?.reason === 'swipe'
      ? 'drag'
      : details?.reason === 'escape-key'
        ? 'escape'
        : pendingCloseReason;
    handleClose(reason);
  }
  pendingCloseReason = 'overlay';
}

useOverlayBack(computed(() => visible.value && isSheet.value), () => handleClose('back'));
</script>
