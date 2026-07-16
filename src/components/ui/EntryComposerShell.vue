<template>
  <DialogOverlay :open="open" @close="requestClose">
    <section
      ref="dialogRef"
      class="entry-composer panel panel-pad flex h-full w-full flex-col overflow-hidden rounded-none border-none md:fixed md:inset-0 md:h-screen md:max-h-screen md:rounded-none md:border-none"
      data-dialog-root
      tabindex="-1"
    >
      <div class="flex shrink-0 items-center justify-between border-b border-ink-200 pb-4 dark:border-ink-800">
        <div class="min-w-0">
          <span class="text-xs font-semibold tracking-wide text-ink-500 dark:text-ink-400">{{ eyebrow }}</span>
          <h2 class="mt-1 text-xl font-semibold tracking-[0.015em] text-ink-950 dark:text-ink-50">{{ title }}</h2>
        </div>
        <button
          type="button"
          class="button-dialog-close shrink-0"
          :disabled="blocked"
          title="關閉"
          aria-label="關閉"
          @click="requestClose"
        >
          <AppIcon name="close" :size="5" :stroke-width="2.5" />
        </button>
      </div>

      <form
        class="entry-composer__scroll mt-5 flex min-h-0 flex-1 flex-col space-y-5 overflow-y-auto md:overflow-hidden"
        autocomplete="off"
        @submit.prevent="emit('submit')"
      >
        <CountedTextField
          v-model="entryTitle"
          :input-id="titleInputId"
          :label="titleLabel"
          :max-length="titleMaxLength"
          :warning-length="titleWarningLength"
          :placeholder="titlePlaceholder"
          autofocus
          :required="titleRequired"
          :disabled="busy"
        />

        <CountedTextField
          v-if="locationInputId"
          v-model="location"
          :input-id="locationInputId"
          :label="locationLabel"
          :max-length="locationMaxLength"
          :warning-length="locationWarningLength"
          :placeholder="locationPlaceholder"
          :disabled="busy"
        />

        <MarkdownImageEditor
          v-model:content="content"
          v-model:show-preview="showPreview"
          class="flex min-h-0 min-h-[220px] flex-1 flex-col"
          :textarea-id="editorTextareaId"
          :label="editorLabel"
          :placeholder="editorPlaceholder"
          :images="images"
          :max-images="maxImages"
          :max-images-label="maxImagesLabel"
          :max-length="INPUT_LIMITS.content"
          :warning-length="900"
          :preview-content="content"
          :uploading="uploading"
          :disabled="busy"
          :busy-label="busy ? '圖片上傳中...' : '圖片壓縮中...'"
          editor-class="flex-1 min-h-[180px]"
          textarea-class="h-full min-h-[180px]"
          preview-class="flex-1 min-h-[180px]"
          :split="true"
          @image-picked="emit('imagePicked', $event)"
          @remove-image="emit('removeImage', $event)"
        />

        <p v-if="error" class="mt-2 shrink-0 text-xs font-semibold text-error">
          錯誤：{{ error }}
        </p>

        <div class="entry-composer__footer">
          <p class="entry-composer__hint">{{ hint }}</p>
          <div class="entry-composer__actions">
            <button
              type="button"
              class="entry-composer__action button-secondary"
              :disabled="blocked"
              @click="requestClose"
            >
              取消
            </button>
            <button
              type="submit"
              class="entry-composer__action button-secondary"
              :disabled="blocked || submitDisabled"
              :aria-busy="busy || undefined"
            >
              <BusyButtonContent :busy="busy" :label="submitLabel" :busy-label="busyLabel" />
            </button>
          </div>
        </div>
      </form>
    </section>
  </DialogOverlay>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import BusyButtonContent from '@/components/ui/BusyButtonContent.vue';
import CountedTextField from '@/components/ui/CountedTextField.vue';
import DialogOverlay from '@/components/ui/DialogOverlay.vue';
import MarkdownImageEditor, { type MarkdownEditorImage } from '@/components/ui/MarkdownImageEditor.vue';
import { INPUT_LIMITS } from '@/constants/input-limits';
import { useBodyScrollLock } from '@/composables/useBodyScrollLock';
import { useDialogFocus } from '@/composables/useDialogFocus';

const entryTitle = defineModel<string>('entryTitle', { required: true });
const content = defineModel<string>('content', { required: true });
const location = defineModel<string>('location', { default: '' });
const showPreview = defineModel<boolean>('showPreview', { required: true });

const props = withDefaults(defineProps<{
  busy?: boolean;
  busyLabel?: string;
  editorLabel: string;
  editorPlaceholder?: string;
  editorTextareaId: string;
  error?: string;
  eyebrow: string;
  hint: string;
  images: MarkdownEditorImage[];
  locationInputId?: string;
  locationLabel?: string;
  locationMaxLength?: number;
  locationPlaceholder?: string;
  locationWarningLength?: number;
  maxImages: number;
  maxImagesLabel: string;
  open: boolean;
  submitDisabled?: boolean;
  submitLabel: string;
  title: string;
  titleInputId: string;
  titleLabel: string;
  titleMaxLength: number;
  titlePlaceholder?: string;
  titleRequired?: boolean;
  titleWarningLength: number;
  uploading?: boolean;
}>(), {
  busy: false,
  busyLabel: '發布中',
  editorPlaceholder: '',
  error: '',
  locationInputId: '',
  locationLabel: '地點',
  locationMaxLength: 120,
  locationPlaceholder: '',
  locationWarningLength: 108,
  submitDisabled: false,
  titlePlaceholder: '',
  titleRequired: false,
  uploading: false,
});

const emit = defineEmits<{
  close: [];
  imagePicked: [event: Event];
  removeImage: [key: string];
  submit: [];
}>();

const blocked = computed(() => props.busy || props.uploading);
const isOpen = toRef(props, 'open');
useBodyScrollLock(isOpen);

function requestClose() {
  if (!blocked.value) emit('close');
}

const { dialogRef } = useDialogFocus(isOpen, { onClose: requestClose });
</script>
