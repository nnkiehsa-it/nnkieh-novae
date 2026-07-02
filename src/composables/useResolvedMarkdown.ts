import { computed, onBeforeUnmount, ref, toValue, watch, type MaybeRefOrGetter } from 'vue';
import {
  extractMarkdownImages,
  getUploadIdFromUri,
  getUploadIdsFromMarkdown,
  replaceMarkdownImageSources,
} from '@/lib/markdown-images';
import { resolveUploadImageUrls } from '@/services/uploads';
import type { MarkdownImageRecord } from '@/types';

export function useResolvedMarkdown(content: MaybeRefOrGetter<string>) {
  const resolvedUrls = ref<Record<string, string>>({});
  const expiresAtByUploadId = ref<Record<string, number>>({});
  const resolveErrors = ref<Record<string, string>>({});
  const isResolving = ref(false);
  let requestToken = 0;

  const rawContent = computed(() => toValue(content) || '');
  const resolvedContent = computed(() =>
    replaceMarkdownImageSources(rawContent.value, resolvedUrls.value, { unresolvedUpload: 'remove' }),
  );
  const images = computed<MarkdownImageRecord[]>(() =>
    extractMarkdownImages(rawContent.value)
      .map((image) => {
        const uploadId = image.uploadId ?? getUploadIdFromUri(image.src) ?? undefined;
        if (!uploadId) {
          return image;
        }

        const resolvedSrc = resolvedUrls.value[uploadId];
        const fullSrc = resolvedUrls.value[uploadId];
        return {
          ...image,
          fullSrc,
          uploadId,
          isUploadResolved: Boolean(resolvedSrc),
          resolveError: resolveErrors.value[uploadId],
          src: resolvedSrc || '',
        };
      }),
  );
  const unresolvedImages = computed(() => images.value.filter((image) => image.uploadId && !image.src));
  const uploadIds = computed(() => getUploadIdsFromMarkdown(rawContent.value));

  watch(
    uploadIds,
    async (ids) => {
      const token = ++requestToken;
      if (ids.length === 0) {
        resolvedUrls.value = {};
        resolveErrors.value = {};
        isResolving.value = false;
        return;
      }

      isResolving.value = true;
      try {
        const result = await resolveUploadImageUrls(ids);
        if (token !== requestToken) return;
        resolvedUrls.value = result.urls;
        expiresAtByUploadId.value = result.expiresAtByUploadId;
        resolveErrors.value = result.errors ?? {};
      } catch {
        if (token !== requestToken) return;
        resolvedUrls.value = {};
        expiresAtByUploadId.value = {};
        resolveErrors.value = Object.fromEntries(ids.map((id) => [id, 'resolve-failed']));
      } finally {
        if (token === requestToken) {
          isResolving.value = false;
        }
      }
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    requestToken += 1;
  });

  async function refreshUploadImageUrl(uploadId: string) {
    const token = ++requestToken;
    try {
      const result = await resolveUploadImageUrls([uploadId], { forceRefresh: true });
      if (token !== requestToken) return;
      resolvedUrls.value = {
        ...resolvedUrls.value,
        ...result.urls,
      };
      expiresAtByUploadId.value = {
        ...expiresAtByUploadId.value,
        ...result.expiresAtByUploadId,
      };
      resolveErrors.value = {
        ...resolveErrors.value,
        ...(result.errors ?? {}),
      };
    } catch {
      if (token !== requestToken) return;
      resolveErrors.value = {
        ...resolveErrors.value,
        [uploadId]: 'resolve-failed',
      };
    }
  }

  return {
    expiresAtByUploadId,
    images,
    isResolving,
    refreshUploadImageUrl,
    resolvedContent,
    resolveErrors,
    resolvedUrls,
    unresolvedImages,
  };
}
