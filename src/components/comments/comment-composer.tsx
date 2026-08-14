"use client";

import { Send } from "lucide-react";
import { t as translate } from "@/i18n";
import { useSession } from "@/hooks/use-session";
import { ActionFeedbackIcon } from "@/components/ui/action-feedback-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function CommentComposer({
  busy,
  content,
  feedbackState = "idle",
  onChange,
  onSubmit,
  reply = false,
}: {
  busy: boolean;
  content: string;
  feedbackState?: "idle" | "loading" | "success";
  onChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  reply?: boolean;
}) {
  const session = useSession();
  const displayName = session.user?.displayName || translate("ui.common.schoolMember");
  const photoUrl = session.customPhotoUrl || session.user?.photoURL || undefined;
  const submitLabel = reply ? translate("ui.discussion.reply") : translate("ui.discussion.submit");

  return (
    <div className="grid gap-2">
      <div className="flex items-end gap-2 rounded-2xl border bg-muted/35 p-1.5 shadow-[var(--shadow-control)] transition-[background-color,border-color,box-shadow] duration-150 focus-within:border-ring/45 focus-within:bg-background focus-within:ring-2 focus-within:ring-ring/20">
        <Avatar className="mb-0.5 size-9 border bg-background">
          <AvatarImage alt={displayName} src={photoUrl} />
          <AvatarFallback>{displayName.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <Textarea
          aria-label={reply ? translate("ui.discussion.replyInput") : translate("ui.discussion.commentInput")}
          autoFocus={reply}
          className="max-h-40 min-h-10 flex-1 resize-none border-0 bg-transparent px-1 py-2.5 shadow-none focus-visible:ring-0"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && content.trim() && !busy) {
              event.preventDefault();
              void onSubmit();
            }
          }}
          placeholder={reply ? translate("ui.discussion.replyPlaceholder") : translate("ui.discussion.commentPlaceholder")}
          rows={1}
          value={content}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={submitLabel}
              className="mb-0.5 shrink-0"
              disabled={!content.trim() || busy}
              onClick={() => void onSubmit()}
              size="icon-sm"
            >
              {busy ? (
                <ActionFeedbackIcon
                  className="[&>svg]:size-4"
                  size="sm"
                  state={feedbackState === "success" ? "success" : "loading"}
                />
              ) : <Send />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{submitLabel}</TooltipContent>
        </Tooltip>
      </div>
      <span className="sr-only">{translate("ui.discussion.submitShortcut")}</span>
    </div>
  );
}
