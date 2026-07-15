<template>
  <form class="space-y-2" autocomplete="off" @submit.prevent="submit">
    <div
      v-if="parentCommentId"
      class="flex items-center justify-between gap-3 px-1 text-xs font-semibold text-ink-500 dark:text-ink-400"
    >
      <span>正在回覆留言</span>
      <button
        type="button"
        class="button-toolbar h-8 min-h-8 w-8 rounded-full p-0"
        :disabled="submitting || uploading"
        title="取消回覆"
        aria-label="取消回覆"
        @click="handleClose"
      >
        <AppIcon name="close" :stroke-width="2.5" />
      </button>
    </div>

    <div class="overflow-hidden rounded-[var(--radius-inner)] bg-surface shadow-note transition-all duration-300 focus-within:ring-2 focus-within:ring-outline/25 dark:bg-surface">
      <div v-if="imageUrls.length" class="flex gap-2 px-3 pt-3">
        <div
          v-for="(url, index) in imageUrls"
          :key="url"
          class="relative h-20 w-20 overflow-hidden rounded-xl bg-ink-50 shadow-note dark:bg-ink-900"
        >
          <img :src="url" alt="留言附加圖片預覽" class="h-full w-full object-cover" />
          <button type="button" class="button-remove-image" aria-label="移除圖片" @click="removeImage(index)">
            <AppIcon name="close" :size="3" :stroke-width="2.5" />
          </button>
        </div>
      </div>

      <div class="flex items-end gap-1.5 p-2 pl-3">
        <img
          v-if="myPhotoUrl"
          :src="myPhotoUrl"
          alt="當前頭像"
          class="mb-1.5 h-7 w-7 shrink-0 rounded-full object-cover shadow-note"
        />

        <textarea
          v-if="!showPreview"
          :id="`comment-content-${composerId}`"
          ref="commentTextareaRef"
          v-model="commentContent"
          rows="1"
          class="max-h-32 min-h-11 min-w-0 flex-1 resize-none border-none bg-transparent px-1 py-3 font-sans text-base leading-5 text-ink-800 outline-none placeholder:text-ink-400 focus:ring-0 dark:text-ink-100 dark:placeholder:text-ink-500 md:text-sm"
          autocomplete="off"
          maxlength="2000"
          :placeholder="parentCommentId ? '留下你的回覆...' : '分享你的想法…'"
          :disabled="submitting"
        ></textarea>
        <div v-else class="max-h-32 min-h-11 min-w-0 flex-1 overflow-y-auto px-1 py-2.5 text-sm text-ink-800 dark:text-ink-100">
          <MarkdownRenderer v-if="contentWithImages.trim()" :content="contentWithImages" />
          <span v-else class="italic text-ink-400">沒有可預覽的內容</span>
        </div>

        <button
          type="button"
          class="button-toolbar h-10 min-h-10 w-10 shrink-0 rounded-full p-0"
          :disabled="uploading || imageUrls.length >= RATE_LIMITS.imageUploads.commentMaxImages"
          :title="uploading ? '圖片處理中...' : imageUrls.length >= RATE_LIMITS.imageUploads.commentMaxImages ? `留言最多 ${RATE_LIMITS.imageUploads.commentMaxImages} 張圖片` : '加入圖片'"
          aria-label="插入圖片"
          @click="commentFileInputRef?.click()"
        >
          <AppIcon name="image" />
        </button>
        <input
          ref="commentFileInputRef"
          type="file"
          accept="image/*"
          autocomplete="off"
          class="hidden"
          multiple
          @change="handleImagePicked"
        />
        <button
          type="button"
          class="button-toolbar h-10 min-h-10 w-10 shrink-0 rounded-full p-0"
          :title="showPreview ? '繼續編輯' : '預覽留言'"
          :aria-label="showPreview ? '繼續編輯' : '預覽留言'"
          @click="showPreview = !showPreview"
        >
          <AppIcon :name="showPreview ? 'edit' : 'preview'" />
        </button>
        <button
          type="submit"
          class="button-icon-filled h-10 min-h-10 w-10 shrink-0 bg-ink-900 text-white hover:bg-ink-800 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-ink-200"
          :disabled="submitting || uploading || (!commentContent.trim() && imageUrls.length === 0)"
          :title="submitting ? '傳送中...' : '送出留言'"
          aria-label="送出留言"
        >
          <AppIcon name="send" />
        </button>
      </div>
    </div>

    <p v-if="error || uploadError" class="pl-1.5 text-xs font-semibold text-error">
      錯誤：{{ error || uploadError }}
    </p>
  </form>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import MarkdownRenderer from '@/components/MarkdownRenderer.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { useMarkdownImageUpload } from '@/composables/useMarkdownImageUpload';
import { useSession } from '@/composables/useSession';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { RATE_LIMITS } from '@/generated/rate-limits';

const props = defineProps<{
  error: string;
  issueId?: string;
  parentCommentId?: string | null;
  submitting: boolean;
  targetId?: string;
}>();

const emit = defineEmits<{
  close: [];
  submit: [payload: { content: string; parentCommentId: string | null }];
}>();

const { user, customPhotoUrl } = useSession();
const { show } = useActionFeedback();
const myPhotoUrl = computed(() => customPhotoUrl.value || user.value?.photoURL || null);
const composerId = computed(() => props.issueId ?? props.targetId ?? 'default');

const commentContent = ref('');
const showPreview = ref(false);
const {
  fileInputRef: commentFileInputRef,
  handleImagePicked,
  contentWithImages,
  deleteUploadedImages,
  discardImages,
  imageUrls,
  removeImage,
  resetImages,
  textareaRef: commentTextareaRef,
  uploadError,
  uploadImagesAndBuildContent,
  uploading,
} = useMarkdownImageUpload(commentContent, {
  maxImages: RATE_LIMITS.imageUploads.commentMaxImages,
});
const submittedImages = ref<Awaited<ReturnType<typeof uploadImagesAndBuildContent>>['uploadedImages']>([]);

nextTick(() => {
  commentTextareaRef.value?.focus();
});

async function submit() {
  try {
    const uploadResult = await uploadImagesAndBuildContent();
    submittedImages.value = uploadResult.uploadedImages;

    emit('submit', {
      content: uploadResult.content,
      parentCommentId: props.parentCommentId ?? null,
    });
  } catch {
    uploadError.value = '圖片上傳失敗，請稍後再試。';
    show(uploadError.value, 'error');
  }
}

async function handleClose() {
  if (props.submitting || uploading.value) {
    return;
  }

  try {
    await discardImages();
    emit('close');
  } catch {
    uploadError.value = '圖片刪除失敗，請稍後再試。';
    show(uploadError.value, 'error');
  }
}

watch(
  () => props.submitting,
  (isSubmitting, wasSubmitting) => {
    if (!isSubmitting && wasSubmitting && !props.error) {
      commentContent.value = '';
      resetImages();
      submittedImages.value = [];
      showPreview.value = false;
    }
    if (!isSubmitting && wasSubmitting && props.error && submittedImages.value.length) {
      deleteUploadedImages(submittedImages.value);
      submittedImages.value = [];
    }
  },
);
</script>
