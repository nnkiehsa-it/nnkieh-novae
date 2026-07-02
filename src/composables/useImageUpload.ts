import { computed, ref } from 'vue';
import { useToast } from '@/composables/useToast';
import { processImageForUpload } from '@/lib/image-processing';
import { createImageUploadPolicy } from '@/services/uploads';

export interface UploadedImage {
  storagePath: string;
  uploadId: string;
  url: string;
  width: number;
  height: number;
}

export interface PreparedImage {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
}

export function useImageUpload() {
  const activeOperations = ref(0);
  const uploading = computed(() => activeOperations.value > 0);
  const uploadError = ref('');
  const { showToast } = useToast();

  function startOperation() {
    activeOperations.value += 1;
    uploadError.value = '';
  }

  function finishOperation() {
    activeOperations.value = Math.max(0, activeOperations.value - 1);
  }

  function reportError(error: unknown, fallback: string) {
    uploadError.value = error instanceof Error && error.message ? error.message : fallback;
    showToast(uploadError.value, 'error');
  }

  function revokePreparedImage(image: PreparedImage) {
    URL.revokeObjectURL(image.previewUrl);
  }

  async function prepareImage(file: File): Promise<PreparedImage | null> {
    startOperation();

    try {
      const processed = await processImageForUpload(file);
      const previewUrl = URL.createObjectURL(processed.file);

      return { ...processed, previewUrl };
    } catch (error) {
      reportError(error, '圖片處理失敗，請稍後再試。');
      return null;
    } finally {
      finishOperation();
    }
  }

  async function uploadPreparedImage(image: PreparedImage): Promise<UploadedImage | null> {
    startOperation();

    try {
      const { uploadId, storagePath, width, height } = await createImageUploadPolicy(
        image.file,
        image.width,
        image.height,
      );

      if (!uploadId || !storagePath) {
        throw new Error('上傳成功但未取得圖片網址');
      }

      return {
        storagePath,
        uploadId,
        url: `srp-upload://${uploadId}`,
        width,
        height,
      };
    } catch (error) {
      reportError(error, '圖片上傳失敗，請稍後再試。');
      return null;
    } finally {
      finishOperation();
    }
  }

  return {
    prepareImage,
    revokePreparedImage,
    uploadError,
    uploading,
    uploadPreparedImage,
  };
}
