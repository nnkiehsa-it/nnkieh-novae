<template>
  <EntryComposerShell
    v-model:entry-title="title"
    v-model:content="content"
    v-model:show-preview="showPreview"
    eyebrow="announcement.postNewCampusAnnouncements"
    title="announcement.announcementContent"
    title-input-id="announcement-title"
    title-label="announcement.announcementTitle"
    :title-max-length="INPUT_LIMITS.title"
    :title-warning-length="27"
    title-placeholder="announcement.pleaseEnterTheAnnouncementTitle"
    title-required
    editor-textarea-id="announcement-content"
    editor-label="announcement.contentDescription"
    editor-placeholder="announcement.enterAnnouncementDetailsHere"
    :images="editorImages"
    :max-images="maxImages"
    max-images-label="announcement.announcement"
    hint="announcement.publishDescription"
    submit-label="announcement.publishAnnouncement"
    :busy="submitting"
    :state="feedbackPhase"
    :uploading="uploading"
    :error="error || uploadError"
    :submit-disabled="!title.trim() || (!content.trim() && editorImages.length === 0)"
    @close="handleClose"
    @image-picked="handleEditorImagePicked"
    @remove-image="removeEditorImage"
    @submit="submit"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import EntryComposerShell from '@/components/ui/organisms/EntryComposerShell.vue';
import { INPUT_LIMITS } from '@/constants/input-limits';
import { RATE_LIMITS } from '@/generated/rate-limits';
import { useMarkdownImageUpload } from '@/composables/useMarkdownImageUpload';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { createAnnouncement } from '@/services/announcements';
import { deleteUploadedImages } from '@/services/uploads';
import type { UploadedImage } from '@/composables/useImageUpload';
import type { AnnouncementRecord } from '@/types';
import { useI18n } from '@/i18n';

const emit = defineEmits<{
  close: [];
  submitted: [announcement: AnnouncementRecord];
}>();
const { t } = useI18n();
const { start } = useActionFeedback();
const feedbackPhase = ref<'idle' | 'busy' | 'success'>('idle');

const title = ref('');
const content = ref('');
const showPreview = ref(false);
const submitting = ref(false);
const error = ref('');
const maxImages = RATE_LIMITS.imageUploads.announcementMaxImages;
const {
  discardImages,
  handleImagePicked,
  imageUrls,
  removeImage,
  resetImages,
  uploadError,
  uploadImagesAndBuildContent,
  uploading,
} = useMarkdownImageUpload(content, {
  getRemainingSlots: () => maxImages - editorImages.value.length,
  maxImages,
});

const editorImages = computed(() =>
  imageUrls.value.map((src, index) => ({
    alt: t('announcement.announcementAttachmentPreview'),
    index,
    key: `new:${src}:${index}`,
    src,
  })),
);

function buildMarkdownImage(image: { url: string; width?: number; height?: number }) {
  const size = image.width && image.height ? `|${image.width}x${image.height}` : '';
  return `![image${size}](${image.url})`;
}

function buildAnnouncementContent(uploadedImages: UploadedImage[]) {
  const text = content.value.trimEnd();
  const images = uploadedImages.map(buildMarkdownImage).join('\n');
  if (!images) return text;
  return text ? `${text}\n\n${images}` : images;
}

function resetForm() {
  title.value = '';
  content.value = '';
  showPreview.value = false;
  error.value = '';
  resetImages();
}

function removeEditorImage(key: string) {
  const image = editorImages.value.find((candidate) => candidate.key === key);
  if (image) void removeImage(image.index);
}

async function handleClose() {
  if (submitting.value || uploading.value) return;
  await discardImages();
  emit('close');
}

function handleEditorImagePicked(event: Event) {
  const target = event.target as HTMLInputElement;
  if (editorImages.value.length >= maxImages) {
    uploadError.value = t('upload.imageLimit', { count: maxImages });
    target.value = '';
    return;
  }
  void handleImagePicked(event);
}

async function submit() {
  if (submitting.value || uploading.value) return;
  submitting.value = true;
  error.value = '';
  const feedback = start('announcement.publishingAnnouncement');
  feedbackPhase.value = 'busy';
  let uploadedImages: UploadedImage[] = [];
  try {
    const uploadResult = await uploadImagesAndBuildContent();
    uploadedImages = uploadResult.uploadedImages;
    const announcement = await createAnnouncement({
      title: title.value.trim(),
      content: buildAnnouncementContent(uploadedImages),
    });
    feedback.succeed('announcement.announcementHasBeenReleased');
    feedbackPhase.value = 'success';
    await feedback.complete();
    resetForm();
    emit('submitted', announcement);
  } catch (caught) {
    if (uploadedImages.length) {
      await deleteUploadedImages(uploadedImages.map((image) => image.storagePath)).catch(() => undefined);
    }
    error.value = caught instanceof Error ? caught.message : 'announcement.announcementPublishingFailed';
    feedback.fail(error.value);
  } finally {
    feedbackPhase.value = 'idle';
    submitting.value = false;
  }
}
</script>
