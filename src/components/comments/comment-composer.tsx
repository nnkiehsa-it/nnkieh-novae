"use client";

import { LoaderCircle, Send, X } from "lucide-react";
import { t as translate } from "@/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function CommentComposer({
  busy,
  content,
  main = false,
  onCancel,
  onChange,
  onSubmit,
  reply = false,
  separated = false,
}: {
  busy: boolean;
  content: string;
  main?: boolean;
  onCancel?: () => void;
  onChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  reply?: boolean;
  separated?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid gap-3 bg-muted/25 p-4 sm:p-5",
        main ? separated && "border-t" : "border-y sm:ml-11",
      )}
    >
      {reply ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{translate("ui.discussion.replying")}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={translate("ui.common.cancel")}
                onClick={onCancel}
                size="icon-xs"
                variant="ghost"
              >
                <X />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{translate("ui.common.cancel")}</TooltipContent>
          </Tooltip>
        </div>
      ) : null}
      <Textarea
        aria-label={reply ? translate("ui.discussion.replyInput") : translate("ui.discussion.commentInput")}
        autoFocus={reply}
        className={cn("resize-y bg-background", main ? "min-h-24" : "min-h-20")}
        onChange={(event) => onChange(event.target.value)}
        placeholder={reply ? translate("ui.discussion.replyPlaceholder") : translate("ui.discussion.commentPlaceholder")}
        value={content}
      />
      <div className="flex justify-end">
        <Button
          disabled={!content.trim() || busy}
          onClick={() => void onSubmit()}
          size="sm"
        >
          {busy ? <LoaderCircle className="t-spinner" /> : <Send />}
          {reply ? translate("ui.discussion.reply") : translate("ui.discussion.submit")}
        </Button>
      </div>
    </div>
  );
}
