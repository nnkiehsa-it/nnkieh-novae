<template>
  <EntryComposerShell
    v-model:entry-title="form.title"
    v-model:content="form.content"
    v-model:show-preview="showPreview"
    :open="open"
    eyebrow="發起新提案"
    :title="`發布至「${categoryLabel}」`"
    title-input-id="issue-title"
    title-label="提案標題"
    :title-max-length="INPUT_LIMITS.title"
    :title-warning-length="27"
    title-placeholder="為您的提案取個明確的標題..."
    editor-textarea-id="issue-content"
    editor-label="詳細說明"
    editor-placeholder="在此輸入詳細說明..."
    :images="editorImages"
    :max-images="RATE_LIMITS.imageUploads.issueMaxImages"
    max-images-label="提案"
    hint="建議提出精確的提案。"
    submit-label="確認發布"
    :busy="submitting"
    :uploading="uploading"
    :error="error || uploadError"
    @close="handleClose"
    @image-picked="handleImagePicked"
    @remove-image="removeEditorImage"
    @submit="submit"
  />
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue';
import EntryComposerShell from '@/components/ui/EntryComposerShell.vue';
import { INPUT_LIMITS } from '@/constants/input-limits';
import { RATE_LIMITS } from '@/generated/rate-limits';
import { useIssueComposerForm } from '@/composables/useIssueComposerForm';
import type { IssueRecord, WritableIssueCategory } from '@/types';

const props = defineProps<{
  open: boolean;
  category: WritableIssueCategory;
  categoryLabel: string;
}>();

const emit = defineEmits<{
  close: [];
  submitted: [issue: IssueRecord];
}>();

const {
  form,
  handleImagePicked,
  imageUrls,
  removeImage,
  uploadError,
  uploading,
  submitting,
  showPreview,
  error,
  handleClose,
  submit,
} = useIssueComposerForm(toRef(props, 'open'), {
  category: toRef(props, 'category'),
  onClose: () => emit('close'),
  onSubmitted: (issue) => emit('submitted', issue),
});

const editorImages = computed(() =>
  imageUrls.value.map((src, index) => ({
    alt: '提案附加圖片預覽',
    key: `${src}:${index}`,
    src,
  })),
);

function removeEditorImage(key: string) {
  const index = editorImages.value.findIndex((image) => image.key === key);
  if (index >= 0) void removeImage(index);
}
</script>
