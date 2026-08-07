<template>
  <Teleport to="body" :disabled="!mobileDocked">
    <form
      class="comment-composer space-y-2"
      :class="{ 'comment-composer-dock viewport-floating-inline': mobileDocked }"
      :style="mobileDocked ? { '--app-bottom-nav-gap': '0px', '--app-bottom-nav-height': '0px' } : undefined"
      autocomplete="off"
      :aria-disabled="disabled ? 'true' : undefined"
      @submit.prevent="submit"
    >
      <div
        v-if="parentCommentId"
        class="comment-composer__reply flex items-start justify-between gap-3 px-3 text-ink-500 dark:text-ink-400"
      >
        <div class="min-w-0 flex-1">
          <p class="truncate text-xs font-semibold leading-5">
            {{ t('comments.replying', { name: parentAuthorName }) }}
          </p>
          <p v-if="parentCommentPreview" class="truncate text-sm leading-5 text-ink-800 dark:text-ink-200">
            {{ parentCommentPreview }}
          </p>
        </div>
        <AppButton
          variant="toolbar"
          class="h-8 min-h-8 w-8 rounded-full p-0"
          :disabled="disabled || submitting || uploading"
          :title="t('comments.cancelReply')"
          :aria-label="t('comments.cancelReply')"
          @click="handleClose"
        >
          <AppIcon name="close" :stroke-width="2.5" />
        </AppButton>
      </div>

      <div class="control-frame">
        <div v-if="imageUrls.length" class="flex gap-2 px-3 pt-3">
          <EditorSurface
            v-for="(url, index) in imageUrls"
            :key="url"
            elevated
            tone="muted"
            class="relative h-20 w-20 overflow-hidden"
          >
            <DecodedImage
              :src="url"
              :alt="t('comments.commentAttachmentPreview')"
              class="h-full w-full"
              image-class="h-full w-full object-cover"
              loading="eager"
            />
            <ImageRemoveButton :aria-label="t('comments.removeImage')" @click="removeImage(index)" />
          </EditorSurface>
        </div>

        <div class="comment-composer__row flex items-end gap-1.5 p-2 pl-3">
          <DecodedImage
            v-if="myPhotoUrl"
            :src="myPhotoUrl"
            :alt="t('comments.currentAvatar')"
            class="mb-1.5 h-7 w-7 shrink-0 rounded-full shadow-control"
            image-class="h-full w-full rounded-full object-cover"
            :spinner-size="3"
          />

          <label :for="`comment-content-${composerId}`" class="sr-only">
            {{ t(disabled ? disabledPlaceholder : parentCommentId ? 'comments.leaveYourReply' : 'comments.shareYourThoughts') }}
          </label>
          <textarea
            :id="`comment-content-${composerId}`"
            ref="commentTextareaRef"
            v-model="commentContent"
            rows="1"
            class="max-h-32 min-h-11 min-w-0 flex-1 resize-none border-none bg-transparent px-1 py-3 font-sans text-base leading-5 text-ink-800 outline-none placeholder:text-ink-400 focus:ring-0 dark:text-ink-100 dark:placeholder:text-ink-500 md:text-sm"
            autocomplete="off"
            :maxlength="INPUT_LIMITS.comment"
            :placeholder="t(composerPlaceholder)"
            :disabled="disabled || submitting"
          ></textarea>

          <AppButton
            variant="toolbar"
            class="h-10 min-h-10 w-10 shrink-0 rounded-full p-0"
            :disabled="disabled || uploading || imageUrls.length >= RATE_LIMITS.imageUploads.commentMaxImages"
            :title="disabled
              ? t(disabledPlaceholder)
              : uploading
                ? t('comments.imageProcessing')
                : imageUrls.length >= RATE_LIMITS.imageUploads.commentMaxImages
                  ? t('comments.imageLimit', { count: RATE_LIMITS.imageUploads.commentMaxImages })
                  : t('comments.addImage')"
            :aria-label="t(disabled ? disabledPlaceholder : 'comments.insertImage')"
            @click="commentFileInputRef?.click()"
          >
            <AppIcon name="image" />
          </AppButton>
          <input
            ref="commentFileInputRef"
            type="file"
            accept="image/*"
            autocomplete="off"
            class="hidden"
            multiple
            :disabled="disabled"
            @change="handleImagePicked"
          />
          <AppButton
            type="submit"
            variant="icon-filled"
            class="h-10 min-h-10 w-10 shrink-0 bg-ink-900 text-white hover:bg-ink-800 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-ink-200"
            :disabled="disabled || submitting || uploading || (!commentContent.trim() && imageUrls.length === 0)"
            :title="t(disabled ? disabledPlaceholder : submitting ? 'comments.sending' : 'comments.postComment')"
            :aria-label="t(disabled ? disabledPlaceholder : 'comments.postComment')"
          >
            <AppIcon name="send" />
          </AppButton>
        </div>
      </div>

      <InlineMessage v-if="error || uploadError" class="pl-1.5">
        {{ t('comments.error', { message: t(error || uploadError) }) }}
      </InlineMessage>
    </form>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import InlineMessage from '@/components/ui/atoms/InlineMessage.vue';
import ImageRemoveButton from '@/components/ui/atoms/ImageRemoveButton.vue';
import DecodedImage from '@/components/ui/atoms/DecodedImage.vue';
import EditorSurface from '@/components/ui/molecules/EditorSurface.vue';
import { useMarkdownImageUpload } from '@/composables/useMarkdownImageUpload';
import { useSession } from '@/composables/useSession';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { useAuthorProfile } from '@/composables/useAuthorProfile';
import { RATE_LIMITS } from '@/generated/rate-limits';
import { INPUT_LIMITS } from '@/constants/input-limits';
import { useI18n, type MessageKey } from '@/i18n';

const props = withDefaults(defineProps<{
  disabled?: boolean;
  disabledPlaceholder?: MessageKey;
  error: string;
  issueId?: string;
  mobileDocked?: boolean;
  parentAuthorUid?: string;
  parentCommentPreview?: string;
  parentCommentId?: string | null;
  submitting: boolean;
  targetId?: string;
}>(), {
  disabled: false,
  disabledPlaceholder: 'comments.commentsAreCurrentlyDisabled',
  issueId: '',
  mobileDocked: false,
  parentAuthorUid: '',
  parentCommentPreview: '',
  parentCommentId: null,
  targetId: '',
});

const emit = defineEmits<{
  close: [];
  submit: [payload: { content: string; parentCommentId: string | null }];
}>();

const { user, customPhotoUrl } = useSession();
const { t } = useI18n();
const { show } = useActionFeedback();
const myPhotoUrl = computed(() => customPhotoUrl.value || user.value?.photoURL || null);
const parentAuthorProfile = useAuthorProfile(() => props.parentAuthorUid);
const parentAuthorName = computed(() => parentAuthorProfile.value.profile?.displayName || t('navigation.user'));
const composerId = computed(() => props.issueId || props.targetId || 'default');
const composerPlaceholder = computed<MessageKey>(() =>
  props.disabled
    ? props.disabledPlaceholder
    : props.parentCommentId
      ? 'comments.leaveYourReply'
      : 'comments.shareYourThoughts'
);

const commentContent = ref('');
const {
  fileInputRef: commentFileInputRef,
  handleImagePicked,
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

void nextTick(() => {
  if (!props.disabled) commentTextareaRef.value?.focus();
});

async function submit() {
  if (props.disabled) return;
  try {
    const uploadResult = await uploadImagesAndBuildContent();
    submittedImages.value = uploadResult.uploadedImages;

    emit('submit', {
      content: uploadResult.content,
      parentCommentId: props.parentCommentId ?? null,
    });
  } catch {
    uploadError.value = 'comments.imageUploadFailedPleaseTryAgainLater';
    show(uploadError.value, 'error');
  }
}

async function handleClose() {
  if (props.disabled || props.submitting || uploading.value) {
    return;
  }

  try {
    await discardImages();
    emit('close');
  } catch {
    uploadError.value = 'comments.imageDeletionFailedPleaseTryAgainLater';
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
    }
    if (!isSubmitting && wasSubmitting && props.error && submittedImages.value.length) {
      deleteUploadedImages(submittedImages.value);
      submittedImages.value = [];
    }
  },
);

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) commentTextareaRef.value?.blur();
  },
);
</script>
