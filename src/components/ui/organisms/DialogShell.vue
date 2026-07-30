<template>
  <DrawerRoot
    v-if="isSheet"
    :open="open"
    :modal="true"
    swipe-direction="down"
    @update:open="handleDrawerOpenChange"
  >
    <DrawerPortal>
      <Transition :name="transitionName" appear>
        <div
          v-if="open"
          class="dialog-overlay fixed inset-0 flex items-center justify-center"
          :class="[zIndexClass, overlayClass]"
          :data-backdrop="isFullScreen ? 'none' : 'dimmed'"
          :data-padding="paddingMode"
          data-presentation="sheet"
        >
          <DrawerOverlay force-mount class="dialog-backdrop" />
          <DrawerContent
            force-mount
            as="section"
            class="dialog-surface surface-card bottom-sheet-surface"
            :class="[paddedSurface ? 'surface-pad-lg' : '', surfaceClass]"
            data-dialog-root
            :role="role"
            aria-modal="true"
            :aria-busy="busy ? 'true' : undefined"
            :aria-labelledby="labelledBy || undefined"
            :aria-describedby="describedBy || undefined"
            @escape-key-down="handleDismissEvent($event, 'escape')"
            @pointer-down-outside="handleDismissEvent($event, 'overlay')"
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
    :open="open"
    :modal="true"
    @update:open="handleDialogOpenChange"
  >
    <DialogPortal>
      <Transition :name="transitionName" appear>
        <div
          v-if="open"
          class="dialog-overlay fixed inset-0 flex items-center justify-center"
          :class="[zIndexClass, overlayClass]"
          :data-backdrop="isFullScreen ? 'none' : 'dimmed'"
          :data-padding="paddingMode"
          :data-presentation="resolvedPresentation"
        >
          <DialogOverlay force-mount class="dialog-backdrop" />
          <DialogContent
            force-mount
            as="section"
            class="dialog-surface surface-card"
            :class="[paddedSurface ? 'surface-pad-lg' : '', surfaceClass]"
            data-dialog-root
            :role="role"
            aria-modal="true"
            :aria-busy="busy ? 'true' : undefined"
            :aria-labelledby="labelledBy || undefined"
            :aria-describedby="describedBy || undefined"
            @escape-key-down="handleDismissEvent($event, 'escape')"
            @pointer-down-outside="handleDismissEvent($event, 'overlay')"
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
import { computed } from 'vue';
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

function handleClose(reason: CloseReason = 'overlay') {
  if (props.closeable && !props.busy && !props.persistent) emit('close', reason);
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

useDialogThemeColor(computed(() => props.open), isFullScreen);

function handleDismissEvent(event: Event, reason: Extract<CloseReason, 'escape' | 'overlay'>) {
  pendingCloseReason = reason;
  if (!canDismiss.value) event.preventDefault();
}

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

useOverlayBack(computed(() => props.open && isSheet.value), () => handleClose('back'));
</script>
