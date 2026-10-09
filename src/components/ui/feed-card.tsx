import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { t } from "@/i18n";
import { CardContent, CardFooter, CardHeader } from "./card";
import { ProgressBar } from "./progress-bar";
import { Skeleton } from "./skeleton";

// One geometry for resolved feeds, route placeholders, and empty states.
export const feedGridClassName = "grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch";

export function FeedCard({
  children,
  footer,
  href,
  label,
  metadata,
  pending = false,
  title,
}: {
  children?: ReactNode;
  footer?: ReactNode;
  href?: string;
  label?: string;
  metadata: ReactNode;
  pending?: boolean;
  title: ReactNode;
}) {
  return (
    <div className="flex h-full min-w-0 flex-col">
      <CardHeader data-slot="feed-card-header" className="items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="min-h-7 font-semibold">
            {title}
          </div>
          <div className="mt-1.5 flex min-h-6 min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            {metadata}
          </div>
        </div>
        {href || pending ? <ArrowUpRight aria-hidden className="mt-1.5 size-4 shrink-0 text-muted-foreground" /> : null}
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
      {footer ? (
        <CardFooter data-slot="feed-card-footer" className="mt-auto flex-wrap gap-2">
          {footer}
        </CardFooter>
      ) : null}
      {href ? (
        // Detail navigation answers the click with a local sheet immediately;
        // the route is deliberately not prefetched just because this card was
        // visible. Content can arrive after the physical response has begun.
        <Link data-feed-card-link aria-label={label} className="absolute inset-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring" href={href} prefetch={false} />
      ) : null}
    </div>
  );
}

export function FeedProgress({ children, value }: { children: ReactNode; value?: number }) {
  return (
    <div className="space-y-2">
      {children}
      {value === undefined ? <Skeleton style={{height: "var(--f7-progressbar-height)"}} /> : <ProgressBar label={t("ui.issue.supportProgress")} percent={value} />}
    </div>
  );
}
