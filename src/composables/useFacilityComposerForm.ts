import { computed, reactive, ref, toRef, watch, type Ref } from 'vue';
import { useMarkdownImageUpload } from '@/composables/useMarkdownImageUpload';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { createFacility } from '@/services/facilities';
import { RATE_LIMITS } from '@/generated/rate-limits';
import type { FacilityRecord } from '@/types';
import { getDefaultFacilityCategoryId } from '@/composables/useCategories';

export function useFacilityComposerForm(open: Ref<boolean>, onClose: () => void, onSubmitted: (facility: FacilityRecord) => void) {
  const form = reactive({ categoryId: getDefaultFacilityCategoryId(), title: '', location: '', content: '' });
  const images = useMarkdownImageUpload(toRef(form, 'content'), { maxImages: RATE_LIMITS.imageUploads.facilityMaxImages });
  const submitting = ref(false);
  const error = ref('');
  const showPreview = ref(false);
  const { show, start } = useActionFeedback();

  function reset() {
    form.categoryId = getDefaultFacilityCategoryId(); form.title = ''; form.location = ''; form.content = ''; error.value = ''; showPreview.value = false; images.resetImages();
  }
  watch(open, (value) => { if (!value) reset(); });

  async function close() {
    if (submitting.value || images.uploading.value) return;
    try {
      await images.discardImages();
      onClose();
    } catch {
      images.uploadError.value = 'comments.imageDeletionFailedPleaseTryAgainLater';
      show(images.uploadError.value, 'error');
    }
  }

  async function submit() {
    if (!form.categoryId) {
      error.value = 'facility.selectCategory';
      show(error.value, 'error');
      return;
    }
    if (!form.title.trim()) {
      error.value = 'facility.pleaseEnterAQuestionTitle';
      show(error.value, 'error');
      return;
    }
    if (!form.location.trim()) {
      error.value = 'facility.enterTheFacilityLocation';
      show(error.value, 'error');
      return;
    }
    if (!images.contentWithImages.value.trim()) {
      error.value = 'facility.pleaseEnterADetailedDescriptionOrAddAnImage';
      show(error.value, 'error');
      return;
    }
    submitting.value = true;
    const feedback = start('facility.submittingFacilityReport');
    let uploaded: Awaited<ReturnType<typeof images.uploadImagesAndBuildContent>>['uploadedImages'] = [];
    try {
      if (images.imageUrls.value.length > 0) feedback.update('facility.uploadingImages');
      const result = await images.uploadImagesAndBuildContent();
      uploaded = result.uploadedImages;
      feedback.update('facility.creatingFacilityReport');
      const facility = await createFacility({ categoryId: form.categoryId, title: form.title.trim(), location: form.location.trim(), content: result.content });
      reset(); onSubmitted(facility); onClose(); feedback.succeed('facility.facilityReportSubmitted');
    } catch (caught) {
      if (uploaded.length) await images.deleteUploadedImages(uploaded);
      error.value = caught instanceof Error ? caught.message : 'facility.sendingFailed';
      feedback.fail(error.value);
    } finally { submitting.value = false; }
  }

  return {
    editorImages: computed(() => images.imageUrls.value.map((src, index) => ({ src, alt: 'facility.facilityAttachmentPreview', key: `${src}:${index}` }))),
    error,
    form,
    images,
    showPreview,
    submitting,
    close,
    submit,
  };
}
