import { Check, CircleAlert } from "lucide-react";
import { ContentRenderer } from "@/components/content-renderer";
import { ContentResolutionNoticeSkeleton } from "@/components/content-resolution-notice-skeleton";
import { SkeletonReveal } from "@/components/ui/skeleton-reveal";
import { cn } from "@/lib/utils";

export type ContentResolutionTone = "error" | "success";

export function ContentResolutionNotice({
  content,
  fallbackAlt,
  reveal,
  separated = true,
  title,
  tone,
}: {
  content: string;
  fallbackAlt: string;
  reveal: boolean;
  separated?: boolean;
  title: string;
  tone: ContentResolutionTone;
}) {
  const Icon = tone === "error" ? CircleAlert : Check;
  return (
    <SkeletonReveal
      as="div"
      enabled={reveal}
      skeleton={<ContentResolutionNoticeSkeleton separated={separated} />}
    >
      <section
        aria-label={title}
        className={cn(
          "t-resolution-notice px-5 py-5 sm:px-7 sm:py-6",
          separated && "border-t",
          tone === "error"
            ? "bg-[var(--status-infeasible-bg)] text-[var(--status-infeasible-fg)]"
            : "bg-emerald-500/[0.055]",
        )}
        data-tone={tone}
      >
        <div
          className={cn(
            "mb-3 flex items-center gap-2 text-sm font-semibold",
            tone === "success" && "text-success",
          )}
        >
          <span
            className={cn(
              "grid size-6 place-items-center rounded-full",
              tone === "error" ? "bg-current/10" : "bg-success/12",
            )}
            data-resolution-icon
          >
            <Icon aria-hidden className="size-3.5" />
          </span>
          {title}
        </div>
        <ContentRenderer
          className="text-foreground"
          content={content}
          fallbackAlt={fallbackAlt}
        />
      </section>
    </SkeletonReveal>
  );
}
