<template>
  <DialogShell
    :open="open"
    :busy="blocked"
    :padded="false"
    labelled-by="entry-composer-title"
    surface-class="entry-composer flex h-full w-full flex-col overflow-hidden rounded-none border-none md:fixed md:inset-0 md:h-screen md:max-h-screen md:rounded-none md:border-none"
    @close="requestClose"
  >
    <div class="flex shrink-0 items-center justify-between border-b border-ink-200 pb-4 dark:border-ink-800">
      <div class="min-w-0">
        <span class="text-xs font-semibold tracking-wide text-ink-500 dark:text-ink-400">{{ t(eyebrow) }}</span>
        <h2 id="entry-composer-title" class="mt-1 text-xl font-semibold tracking-[0.015em] text-ink-950 dark:text-ink-50">{{ t(title) }}</h2>
      </div>
      <AppButton
        variant="icon"
        class="shrink-0"
        :disabled="blocked"
        :title="t('common.close')"
        :aria-label="t('common.close')"
        @click="requestClose"
      >
        <AppIcon name="close" :size="5" :stroke-width="2.5" />
      </AppButton>
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

      <slot name="fields" />

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
        :busy-label="t(busy ? 'common.processingContent' : 'comments.addImage')"
        editor-class="flex-1 min-h-[180px]"
        textarea-class="h-full min-h-[180px]"
        preview-class="flex-1 min-h-[180px]"
        :split="true"
        @image-picked="emit('imagePicked', $event)"
        @remove-image="emit('removeImage', $event)"
      />

      <InlineMessage v-if="error" class="mt-2 shrink-0">
        {{ t('common.errorError', { error: t(error) }) }}
      </InlineMessage>

      <div class="entry-composer__footer">
        <p class="entry-composer__hint">{{ t(hint) }}</p>
        <div class="entry-composer__actions">
          <AppButton
            variant="secondary"
            class="entry-composer__action"
            :disabled="blocked"
            @click="requestClose"
          >
            {{ t('issue.cancel') }}
          </AppButton>
          <AppButton
            type="submit"
            variant="secondary"
            class="entry-composer__action"
            :disabled="blocked || submitDisabled"
            :aria-busy="busy || undefined"
          >
            <BusyButtonContent :busy="busy" :label="t(submitLabel)" :busy-label="t(busyLabel)" />
          </AppButton>
        </div>
      </div>
    </form>
  </DialogShell>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import BusyButtonContent from '@/components/ui/atoms/BusyButtonContent.vue';
import InlineMessage from '@/components/ui/atoms/InlineMessage.vue';
import CountedTextField from '@/components/ui/molecules/CountedTextField.vue';
import DialogShell from '@/components/ui/organisms/DialogShell.vue';
import MarkdownImageEditor, { type MarkdownEditorImage } from '@/components/ui/organisms/MarkdownImageEditor.vue';
import { INPUT_LIMITS } from '@/constants/input-limits';
import { useI18n } from '@/i18n';

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
  busyLabel: 'common.publish',
  editorPlaceholder: '',
  error: '',
  locationInputId: '',
  locationLabel: 'facility.place',
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
const { t } = useI18n();
function requestClose() {
  if (!blocked.value) emit('close');
}

</script>
