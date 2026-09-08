"use client";

import type { ReactNode } from "react";
import { Hand, Heart, Inbox, MessageCircle, RefreshCw } from "lucide-react";
import { useI18n } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FeedCard, FeedProgress, feedGridClassName } from "@/components/ui/feed-card";
import { ContentTransition } from "@/components/motion/state-transition";
import { StaggerItem, StaggerList } from "@/components/motion/stagger";
import { cn } from "@/lib/utils";

export type FeedKind = "issue" | "facility" | "announcement";

function FeedPlaceholder({ kind, showProgress }: { kind: FeedKind; showProgress: boolean }) {
  const { t } = useI18n();
  const Reaction = kind === "announcement" ? Heart : Hand;
  return (
    <FeedCard
      pending
      title={<Skeleton className="h-7 w-3/5" />}
      metadata={<><Skeleton className="size-6 shrink-0 rounded-full" /><Skeleton className="h-3 w-16" /><span aria-hidden>·</span><Skeleton className="h-3 w-12" /></>}
      footer={<>
        {kind !== "announcement" ? <Skeleton className="h-6 w-20 rounded-full" /> : null}
        {kind === "facility" ? <Skeleton className="h-4 w-24" /> : null}
        <Button className="ml-auto opacity-100" disabled size="sm" variant="ghost"><Reaction /><Skeleton className="h-3 w-5" /></Button>
        {kind === "announcement" ? <Button className="opacity-100" disabled size="sm" variant="ghost"><MessageCircle /><Skeleton className="h-3 w-4" /></Button> : kind === "issue" ? <MessageCircle className="size-3.5 text-muted-foreground" /> : null}
      </>}
    >
      {kind === "issue" && showProgress ? <FeedProgress><div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{t('ui.issue.supportProgress')}</span><Skeleton className="h-4 w-14" /></div></FeedProgress> : null}
    </FeedCard>
  );
}

const SKELETON_SLOT_COUNT = 3;

export function FeedList<T extends { id: string }>({
  empty,
  error,
  items,
  kind,
  loading,
  onRetry,
  renderItem,
  showProgress = true,
}: {
  empty?: { action?: ReactNode; description: string; title: string };
  error?: string;
  items: readonly T[];
  kind: FeedKind;
  loading: boolean;
  onRetry?: () => void;
  renderItem?: (item: T) => ReactNode;
  showProgress?: boolean;
}) {
  const { t } = useI18n();
  const pending = loading && !items.length;
  const count = items.length || (pending ? SKELETON_SLOT_COUNT : 1);
  const state = pending ? "loading" : items.length ? "content" : error ? "error" : "empty";
  return (
    <StaggerList aria-busy={pending} className={feedGridClassName} data-state-transition={state}>
      {Array.from({ length: count }, (_, index) => {
        const item = items[index];
        const contentIdentity = pending ? "loading" : item ? item.id : state;
        return (
          // These keys identify physical card slots. Entity-local state stays
          // keyed inside, while each frame survives loading/empty/data changes.
          <StaggerItem className="h-full" key={index}>
            <Card className={cn("group relative h-full gap-0 p-0", pending ? "route-card-skeleton" : item ? "t-card" : undefined)} data-feed-slot={index} data-resize-motion="">
              <ContentTransition identity={contentIdentity}>
                {item ? <div className="h-full">{renderItem?.(item)}</div> : pending ? (
                  <FeedPlaceholder kind={kind} showProgress={showProgress} />
                ) : (
                  <FeedCard
                    title={<h2>{error ? t('ui.common.loadFailed') : empty?.title}</h2>}
                    metadata={<><Inbox className="size-4 shrink-0" /><span className="text-sm leading-6">{error || empty?.description}</span></>}
                    footer={error ? <Button onClick={onRetry} variant="outline"><RefreshCw />{t('ui.common.reload')}</Button> : empty?.action}
                  />
                )}
              </ContentTransition>
            </Card>
          </StaggerItem>
        );
      })}
    </StaggerList>
  );
}
