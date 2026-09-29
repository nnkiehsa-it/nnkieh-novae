"use client";

import { useLayoutEffect, useRef } from "react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { useComposerDraft } from "@/hooks/use-composer-draft";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { readComposerDraft, removeComposerDraft } from "@/lib/composer-draft";
import { INPUT_LIMITS } from "@/constants/input-limits";
import { useImageAttachments } from "@/hooks/use-image-attachments";
import { useCategories } from "@/hooks/use-categories";
import { deleteUploadedImages, type ImageUploadTargetType } from "@/services/uploads";

export function useDiscussionComposer(
  uid: string | undefined,
  targetKey: string,
  parentCommentId: string | null,
  onCreate: (content: string, parentCommentId: string | null) => Promise<void>,
  media: { targetType: ImageUploadTargetType; scopeId: string; maxImages: number },
) {
  const { t } = useI18n();
  const draft = useComposerDraft(uid, `discussion:${JSON.stringify([targetKey, parentCommentId])}`);
  const feedback = useActionFeedback();
  const categories = useCategories();
  const images = useImageAttachments(media.targetType, categories.imageUploads, media.maxImages, media.scopeId);
  const clearImages = images.clear;
  useLayoutEffect(() => { clearImages(); }, [clearImages, draft.key]);
  const submitting = useRef(false);
  const latest = useRef({ key: draft.key, content: draft.value.content });
  useLayoutEffect(() => {
    latest.current = { key: draft.key, content: draft.value.content };
  }, [draft.key, draft.value.content]);

  async function submit() {
    const content = draft.value.content;
    const key = draft.key;
    if (submitting.current || images.uploading || !images.withinLimit
      || (!content.trim() && images.images.length === 0) || content.length > INPUT_LIMITS.comment) return;
    submitting.current = true;
    let uploaded: Awaited<ReturnType<typeof images.uploadAndAppend>>["uploaded"] = [];
    let committed = false;
    try {
      await feedback.run(async () => {
        const result = await images.uploadAndAppend(content);
        uploaded = result.uploaded;
        await onCreate(result.content, parentCommentId);
        committed = true;
        if (latest.current.key === key) images.clear();
        const persisted = key ? readComposerDraft(key) : null;
        // A remounted composer or a new edit may already own this storage entry.
        if (persisted && persisted.content !== content) return;
        if (latest.current.key === key && latest.current.content === content) draft.clear();
        else if (key && latest.current.key !== key) removeComposerDraft(key);
      });
    } catch (error) {
      if (!committed && uploaded.length) await deleteUploadedImages(uploaded.map((image) => image.storagePath)).catch(() => undefined);
      toast.error(error instanceof Error ? error.message : t("ui.discussion.submitFailed"));
    } finally {
      submitting.current = false;
    }
  }

  return {
    busy: feedback.busy || images.uploading,
    images,
    content: draft.value.content,
    feedbackState: feedback.state,
    status: draft.restored ? "restored" as const : draft.saved ? "saved" as const : "unavailable" as const,
    update: (content: string) => {
      latest.current = { key: draft.key, content };
      draft.update({ content });
    },
    submit,
  };
}
