"use client";

import * as React from "react";
import { toast } from "sonner";
import { useCategories } from "@/hooks/use-categories";
import { useImageAttachments } from "@/hooks/use-image-attachments";
import { useComposerDraft } from "@/hooks/use-composer-draft";
import { useSession } from "@/hooks/use-session";
import { deleteUploadedImages } from "@/services/uploads";
import { INPUT_LIMITS } from "@/constants/input-limits";

export function useComposerBase(targetType: "announcement" | "facility" | "issue", scope: string = targetType, requestedCategory = "") {
  const session = useSession();
  const draft = useComposerDraft(session.user?.uid, scope);
  const [saving, setSaving] = React.useState(false);
  const [succeeded, setSucceeded] = React.useState(false);
  const submitting = React.useRef(false);
  const categories = useCategories();
  const categoryId = targetType === "facility"
    ? (categories.facilityCategories.find((item) => item.id === draft.value.category)?.id
      ?? categories.facilityCategories.find((item) => item.id === requestedCategory)?.id
      ?? categories.facilityCategories.find((item) => item.isDefault)?.id ?? "")
    : requestedCategory;
  const maxImages = targetType === "announcement" ? categories.features.announcementMaxImages
    : (targetType === "issue" ? categories.issueCategories : categories.facilityCategories)
      .find((item) => item.id === categoryId)?.maxImages ?? 0;
  const images = useImageAttachments(targetType, categories.imageUploads, maxImages, categoryId);
  const { title, content } = draft.value;

  async function withUploads(
    create: (content: string) => Promise<string>,
    navigate: (href: string) => void,
    fallbackMessage: string,
  ) {
    if (submitting.current || images.uploading || !images.withinLimit) return;
    submitting.current = true;
    setSaving(true);
    setSucceeded(false);
    let uploaded: Awaited<ReturnType<typeof images.uploadAndAppend>>["uploaded"] = [];
    let committed = false;
    try {
      const result = await images.uploadAndAppend(content);
      uploaded = result.uploaded;
      const href = await create(result.content);
      committed = true;
      draft.clear();
      images.clear();
      setSucceeded(true);
      navigate(href);
    } catch (caught) {
      if (!committed && uploaded.length > 0) {
        await deleteUploadedImages(uploaded.map((image) => image.storagePath)).catch(() => undefined);
      }
      toast.error(caught instanceof Error ? caught.message : fallbackMessage);
    } finally {
      // A completed composer is consumed even while its destination is still loading.
      if (!committed) submitting.current = false;
      setSaving(false);
    }
  }

  return {
    title, content, draft, images, saving, succeeded, withUploads,
    categoryId,
    contentWithinLimit: content.length <= INPUT_LIMITS.content && images.withinLimit,
    setTitle: (value: string) => draft.update({ title: value }),
    setContent: (value: string) => draft.update({ content: value }),
  };
}
