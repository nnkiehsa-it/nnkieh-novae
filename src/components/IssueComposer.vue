<template>
  <EntryComposerShell
    v-model:entry-title="form.title"
    v-model:content="form.content"
    v-model:show-preview="showPreview"
    eyebrow="issue.startANewProposal"
    :title="t('issue.addToCategory', { category: t(categoryLabel) })"
    title-input-id="issue-title"
    title-label="issue.proposalTitle"
    :title-max-length="INPUT_LIMITS.title"
    :title-warning-length="27"
    title-placeholder="issue.giveYourProposalAClearTitle"
    editor-textarea-id="issue-content"
    editor-label="common.detailedDescription"
    editor-placeholder="issue.enterDetailedDescriptionHere"
    :images="editorImages"
    :max-images="RATE_LIMITS.imageUploads.issueMaxImages"
    max-images-label="issue.proposal"
    hint="issue.itIsRecommendedToMakePreciseProposals"
    submit-label="common.confirmPublish"
    :busy="submitting"
    :state="feedbackPhase"
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
import EntryComposerShell from '@/components/ui/organisms/EntryComposerShell.vue';
import { INPUT_LIMITS } from '@/constants/input-limits';
import { RATE_LIMITS } from '@/generated/rate-limits';
import { useIssueComposerForm } from '@/composables/useIssueComposerForm';
import type { IssueRecord, WritableIssueCategory } from '@/types';
import { useI18n } from '@/i18n';

const props = defineProps<{
  category: WritableIssueCategory;
  categoryLabel: string;
}>();

const emit = defineEmits<{
  close: [];
  submitted: [issue: IssueRecord];
}>();
const { t } = useI18n();

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
  feedbackPhase,
  handleClose,
  submit,
} = useIssueComposerForm({
  category: toRef(props, 'category'),
  onClose: () => emit('close'),
  onSubmitted: (issue) => emit('submitted', issue),
});

const editorImages = computed(() =>
  imageUrls.value.map((src, index) => ({
    alt: t('issue.proposalAttachedImagePreview'),
    key: `${src}:${index}`,
    src,
  })),
);

function removeEditorImage(key: string) {
  const index = editorImages.value.findIndex((image) => image.key === key);
  if (index >= 0) void removeImage(index);
}
</script>
