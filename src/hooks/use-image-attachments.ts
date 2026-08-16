"use client";

import * as React from "react";
import { toast } from "sonner";
import { processImageForUpload } from "@/lib/image-processing";
import {
  createImageUploadPolicies,
  deleteUploadedImages,
} from "@/services/uploads";
import type { ImageUploadTargetType } from "@/services/uploads";
import { useI18n } from "@/i18n";
import type { ImageUploadSettings } from "@/types/categories";

interface PreparedImage {
  file: File;
  height: number;
  previewUrl: string;
  width: number;
}

interface UploadedImage {
  height: number;
  storagePath: string;
  uploadId: string;
  url: string;
  width: number;
}

export function useImageAttachments(
  targetType: ImageUploadTargetType,
  settings: ImageUploadSettings,
) {
  const maxImages = targetType === "issue"
    ? settings.issueMaxImages
    : targetType === "facility"
      ? settings.facilityMaxImages
      : targetType === "announcement"
        ? settings.announcementMaxImages
        : settings.commentMaxImages;
  const { t } = useI18n();
  const [images, setImages] = React.useState<PreparedImage[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const imagesRef = React.useRef(images);

  React.useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  React.useEffect(
    () => () => {
      imagesRef.current.forEach((image) =>
        URL.revokeObjectURL(image.previewUrl),
      );
    },
    [],
  );

  const pick = React.useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      const remaining = Math.max(0, maxImages - imagesRef.current.length);
      if (remaining === 0) {
        toast.error(t("upload.imageLimit", { count: maxImages }));
        return;
      }
      setUploading(true);
      const prepared: PreparedImage[] = [];
      try {
        for (const file of Array.from(files).slice(0, remaining)) {
          const result = await processImageForUpload(file, settings);
          prepared.push({
            ...result,
            previewUrl: URL.createObjectURL(result.file),
          });
        }
        setImages((current) => [...current, ...prepared]);
        if (files.length > remaining)
          toast.error(t("upload.imageLimit", { count: maxImages }));
      } catch (error) {
        prepared.forEach((image) => URL.revokeObjectURL(image.previewUrl));
        toast.error(
          t(
            error instanceof Error
              ? error.message
              : "image.imageProcessingFailedPleaseTryAgainLater",
          ),
        );
      } finally {
        setUploading(false);
      }
    },
    [maxImages, settings, t],
  );

  const remove = React.useCallback((index: number) => {
    setImages((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  }, []);

  const clear = React.useCallback(() => {
    setImages((current) => {
      current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      return [];
    });
  }, []);

  const uploadAndAppend = React.useCallback(async (content: string) => {
    if (imagesRef.current.length === 0)
      return { content: content.trim(), uploaded: [] as UploadedImage[] };
    setUploading(true);
    let uploaded: UploadedImage[] = [];
    try {
      const policies = await createImageUploadPolicies(
        imagesRef.current.map(({ file, height, width }) => ({
          file,
          height,
          width,
        })),
        targetType,
      );
      uploaded = policies.map(({ height, storagePath, uploadId, width }) => ({
        height,
        storagePath,
        uploadId,
        url: `srp-upload://${uploadId}`,
        width,
      }));
      if (uploaded.length !== imagesRef.current.length)
        throw new Error("markdown.imageUploadFailed");
      const imageMarkdown = uploaded
        .map((image) => `![image|${image.width}x${image.height}](${image.url})`)
        .join("\n");
      const body = content.trimEnd();
      return {
        content: body ? `${body}\n\n${imageMarkdown}` : imageMarkdown,
        uploaded,
      };
    } catch (error) {
      if (uploaded.length > 0)
        await deleteUploadedImages(
          uploaded.map((image) => image.storagePath),
        ).catch(() => undefined);
      throw error;
    } finally {
      setUploading(false);
    }
  }, [targetType]);

  return { clear, images, pick, remove, uploadAndAppend, uploading };
}
