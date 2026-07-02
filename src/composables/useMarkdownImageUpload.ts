import { computed, onBeforeUnmount, ref, type Ref } from 'vue';
import { useImageUpload, type PreparedImage, type UploadedImage } from '@/composables/useImageUpload';
import { useToast } from '@/composables/useToast';
import { deleteUploadedImage } from '@/services/uploads';

interface MarkdownImageUploadOptions {
  getRemainingSlots?: () => number;
  maxImages: number;
}

export function useMarkdownImageUpload(content: Ref<string>, options: MarkdownImageUploadOptions) {
  const fileInputRef = ref<HTMLInputElement | null>(null);
  const textareaRef = ref<HTMLTextAreaElement | null>(null);
  const imageAttachments = ref<PreparedImage[]>([]);
  const { prepareImage, revokePreparedImage, uploading, uploadError, uploadPreparedImage } = useImageUpload();
  const { showToast } = useToast();
  const imageUrls = computed(() => imageAttachments.value.map((image) => image.previewUrl));

  function buildContentWithImages(images: Array<Pick<UploadedImage, 'url' | 'width' | 'height'>>) {
    const text = content.value.trimEnd();
    const markdownImages = images
      .map((image) => `![image|${image.width}x${image.height}](${image.url})`)
      .join('\n');

    if (!markdownImages) {
      return text;
    }

    return text ? `${text}\n\n${markdownImages}` : markdownImages;
  }

  const contentWithImages = computed(() => {
    return buildContentWithImages(
      imageAttachments.value.map((image) => ({
        url: image.previewUrl,
        width: image.width,
        height: image.height,
      })),
    );
  });

  async function handleImagePicked(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = Array.from(target.files ?? []);
    if (files.length === 0) return;

    const remainingSlots = options.getRemainingSlots?.() ?? options.maxImages - imageAttachments.value.length;
    if (remainingSlots <= 0) {
      uploadError.value = `最多只能上傳 ${options.maxImages} 張圖片。`;
      showToast(uploadError.value, 'error');
      target.value = '';
      return;
    }

    const pickedFiles = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      uploadError.value = `最多只能上傳 ${options.maxImages} 張圖片。`;
      showToast(uploadError.value, 'error');
    }

    const preparedImages: PreparedImage[] = [];
    for (const file of pickedFiles) {
      const preparedImage = await prepareImage(file);
      if (preparedImage) {
        preparedImages.push(preparedImage);
      }
    }
    target.value = '';

    if (preparedImages.length === 0) return;

    imageAttachments.value = [...imageAttachments.value, ...preparedImages];

    requestAnimationFrame(() => {
      textareaRef.value?.focus();
    });
  }

  async function removeImage(index: number) {
    const image = imageAttachments.value[index];
    imageAttachments.value = imageAttachments.value.filter((_, imageIndex) => imageIndex !== index);

    if (!image) return;

    revokePreparedImage(image);
  }

  function resetImages() {
    imageAttachments.value.forEach((image) => revokePreparedImage(image));
    imageAttachments.value = [];
    uploadError.value = '';
  }

  async function discardImages() {
    resetImages();
  }

  async function deleteUploadedImages(images: UploadedImage[]) {
    await Promise.allSettled(images.map((image) => deleteUploadedImage(image.storagePath)));
  }

  async function uploadImagesAndBuildContent() {
    const uploadResults = await Promise.all(
      imageAttachments.value.map((image) => uploadPreparedImage(image)),
    );
    const uploadedImages = uploadResults.filter((image): image is UploadedImage => image !== null);

    if (uploadedImages.length !== imageAttachments.value.length) {
      await deleteUploadedImages(uploadedImages);
      throw new Error('圖片上傳失敗');
    }

    return {
      content: buildContentWithImages(uploadedImages),
      uploadedImages,
    };
  }

  onBeforeUnmount(resetImages);

  return {
    contentWithImages,
    deleteUploadedImages,
    discardImages,
    fileInputRef,
    handleImagePicked,
    imageUrls,
    removeImage,
    resetImages,
    textareaRef,
    uploadError,
    uploadImagesAndBuildContent,
    uploading,
  };
}
