<template>
  <EntryComposerShell
    v-model:entry-title="form.title"
    v-model:location="form.location"
    v-model:content="form.content"
    v-model:show-preview="showPreview"
    :open="open"
    eyebrow="回報設備問題"
    title="新增設備案件"
    title-input-id="facility-title"
    title-label="問題標題"
    :title-max-length="INPUT_LIMITS.title"
    :title-warning-length="27"
    title-placeholder="簡短描述設備問題..."
    location-input-id="facility-location"
    location-label="地點"
    :location-max-length="INPUT_LIMITS.facilityLocation"
    :location-warning-length="108"
    location-placeholder="例如：教學大樓 3 樓 301 教室"
    editor-textarea-id="facility-content"
    editor-label="詳細說明"
    editor-placeholder="描述目前情況..."
    :images="editorImages"
    :max-images="RATE_LIMITS.imageUploads.facilityMaxImages"
    max-images-label="設備"
    hint="請確認問題地點與說明後再送出。"
    submit-label="確認發布"
    :busy="submitting"
    :uploading="images.uploading.value"
    :error="error || images.uploadError.value"
    @close="close"
    @image-picked="images.handleImagePicked"
    @remove-image="removeImage"
    @submit="submit"
  />
</template>

<script setup lang="ts">
import { toRef } from 'vue';
import EntryComposerShell from '@/components/ui/EntryComposerShell.vue';
import { INPUT_LIMITS } from '@/constants/input-limits';
import { RATE_LIMITS } from '@/generated/rate-limits';
import { useFacilityComposerForm } from '@/composables/useFacilityComposerForm';
import type { FacilityRecord } from '@/types';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; submitted: [facility: FacilityRecord] }>();
const { editorImages, error, form, images, showPreview, submitting, close, submit } = useFacilityComposerForm(
  toRef(props, 'open'),
  () => emit('close'),
  (facility) => emit('submitted', facility),
);

function removeImage(key: string) {
  const index = editorImages.value.findIndex((image) => image.key === key);
  if (index >= 0) void images.removeImage(index);
}
</script>
