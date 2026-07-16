import { computed, reactive, ref, toRef, watch, type Ref } from 'vue';
import { useMarkdownImageUpload } from '@/composables/useMarkdownImageUpload';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { createFacility } from '@/services/facilities';
import { RATE_LIMITS } from '@/generated/rate-limits';
import type { FacilityRecord } from '@/types';

export function useFacilityComposerForm(open: Ref<boolean>, onClose: () => void, onSubmitted: (facility: FacilityRecord) => void) {
  const form = reactive({ title: '', location: '', content: '' });
  const images = useMarkdownImageUpload(toRef(form, 'content'), { maxImages: RATE_LIMITS.imageUploads.facilityMaxImages });
  const submitting = ref(false);
  const error = ref('');
  const showPreview = ref(false);
  const { show, start } = useActionFeedback();

  function reset() {
    form.title = ''; form.location = ''; form.content = ''; error.value = ''; showPreview.value = false; images.resetImages();
  }
  watch(open, (value) => { if (!value) reset(); });

  async function close() {
    if (submitting.value || images.uploading.value) return;
    try {
      await images.discardImages();
      onClose();
    } catch {
      images.uploadError.value = '圖片刪除失敗，請稍後再試。';
      show(images.uploadError.value, 'error');
    }
  }

  async function submit() {
    if (!form.title.trim()) {
      error.value = '請輸入問題標題。';
      show(error.value, 'error');
      return;
    }
    if (!form.location.trim()) {
      error.value = '請輸入設備地點。';
      show(error.value, 'error');
      return;
    }
    if (!images.contentWithImages.value.trim()) {
      error.value = '請輸入詳細說明或加入圖片。';
      show(error.value, 'error');
      return;
    }
    submitting.value = true;
    const feedback = start('正在送出設備案件');
    let uploaded: Awaited<ReturnType<typeof images.uploadImagesAndBuildContent>>['uploadedImages'] = [];
    try {
      if (images.imageUrls.value.length > 0) feedback.update('正在上傳圖片');
      const result = await images.uploadImagesAndBuildContent();
      uploaded = result.uploadedImages;
      feedback.update('正在建立設備案件');
      const facility = await createFacility({ title: form.title.trim(), location: form.location.trim(), content: result.content });
      reset(); onSubmitted(facility); onClose(); feedback.succeed('設備已送出');
    } catch (caught) {
      if (uploaded.length) await images.deleteUploadedImages(uploaded);
      error.value = caught instanceof Error ? caught.message : '送出失敗。';
      feedback.fail(error.value);
    } finally { submitting.value = false; }
  }

  return {
    editorImages: computed(() => images.imageUrls.value.map((src, index) => ({ src, alt: '設備附加圖片預覽', key: `${src}:${index}` }))),
    error,
    form,
    images,
    showPreview,
    submitting,
    close,
    submit,
  };
}
