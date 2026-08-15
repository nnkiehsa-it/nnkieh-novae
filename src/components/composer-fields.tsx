"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import * as React from "react";
import { Bold, Heading1, Heading2, ImagePlus, Italic, List, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { INPUT_LIMITS } from "@/constants/input-limits";

export function ComposerField({
  attachments,
  content,
  contentLabel,
  onContentChange,
  onPickImages,
  onRemoveImage,
  onTitleChange,
  placeholder,
  title,
  titleLabel,
  titlePlaceholder,
}: {
  attachments: Array<{ height: number; previewUrl: string; width: number }>;
  content: string;
  contentLabel: string;
  onContentChange: (value: string) => void;
  onPickImages: (files: FileList | null) => void;
  onRemoveImage: (index: number) => void;
  onTitleChange: (value: string) => void;
  placeholder: string;
  title: string;
  titleLabel: string;
  titlePlaceholder: string;
}) {
  useLocaleSubscription();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const wrapSelection = React.useCallback(
    (before: string, after = before) => {
      const field = textareaRef.current;
      if (!field) return;
      const start = field.selectionStart;
      const end = field.selectionEnd;
      const selected = content.slice(start, end);
      const next = `${content.slice(0, start)}${before}${selected}${after}${content.slice(end)}`;
      onContentChange(next);
      requestAnimationFrame(() => {
        field.focus();
        field.setSelectionRange(start + before.length, end + before.length);
      });
    },
    [content, onContentChange],
  );

  const tools = [
    { after: "**", before: "**", icon: Bold, label: translate('ui.composer.bold') },
    { after: "_", before: "_", icon: Italic, label: translate('ui.composer.italic') },
    { after: "", before: "# ", icon: Heading1, label: translate('ui.composer.headingLarge') },
    { after: "", before: "## ", icon: Heading2, label: translate('ui.composer.heading') },
    { after: "", before: "- ", icon: List, label: translate('ui.composer.list') },
  ];

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="composer-title">{titleLabel}</Label>
          <span
            className={cn(
              "text-xs tabular-nums",
              title.length > INPUT_LIMITS.title
                ? "font-medium text-destructive"
                : "text-muted-foreground",
            )}
          >
            {title.length} / {INPUT_LIMITS.title}
          </span>
        </div>
        <Input
          id="composer-title"
          maxLength={INPUT_LIMITS.title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder={titlePlaceholder}
          value={title}
        />
      </div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="composer-content">{contentLabel}</Label>
          <span
            className={cn(
              "text-xs tabular-nums",
              content.length > INPUT_LIMITS.content
                ? "font-medium text-destructive"
                : "text-muted-foreground",
            )}
          >
            {content.length} / {INPUT_LIMITS.content}
          </span>
        </div>
        <div className="overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-control)] focus-within:ring-2 focus-within:ring-ring/30">
          <div className="flex items-center gap-0.5 border-b bg-muted/40 p-1.5">
            {tools.map(({ after, before, icon: Icon, label }) => (
              <Tooltip key={label}>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={label}
                    onClick={() => wrapSelection(before, after)}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <Icon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            ))}
            <div className="mx-1 h-4 w-px bg-border" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={translate('ui.composer.addImage')}
                  onClick={() => fileRef.current?.click()}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <ImagePlus />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{translate('ui.composer.addImage')}</TooltipContent>
            </Tooltip>
            <input
              ref={fileRef}
              accept="image/*"
              className="sr-only"
              multiple
              onChange={(event) => {
                onPickImages(event.target.files);
                event.target.value = "";
              }}
              type="file"
            />
          </div>
          <Textarea
            ref={textareaRef}
            className="min-h-52 resize-y rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"
            id="composer-content"
            maxLength={INPUT_LIMITS.content}
            onChange={(event) => onContentChange(event.target.value)}
            placeholder={placeholder}
            value={content}
          />
        </div>
      </div>
      {attachments.length > 0 ? (
        <div className="flex snap-x gap-2 overflow-x-auto pb-1">
          {attachments.map((image, index) => (
            <div
              className="group relative aspect-[4/3] w-32 shrink-0 snap-start overflow-hidden rounded-xl border bg-muted"
              key={image.previewUrl}
            >
              <img
                alt={translate('ui.composer.attachmentPreview')}
                className="size-full object-cover"
                height={image.height}
                src={image.previewUrl}
                width={image.width}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={translate('ui.common.delete')}
                    className={cn(
                      "absolute right-1.5 top-1.5 bg-card/88 backdrop-blur-sm",
                    )}
                    onClick={() => onRemoveImage(index)}
                    size="icon-xs"
                    type="button"
                    variant="outline"
                  >
                    <Trash2 />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{translate('ui.common.delete')}</TooltipContent>
              </Tooltip>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
