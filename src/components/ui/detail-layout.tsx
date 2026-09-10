"use client";

import type { ReactNode } from "react";
import { ArrowLeft, Clock3, Hand, Heart, RefreshCw } from "lucide-react";
import { useI18n } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DetailCardHeader, DetailCardBody } from "@/components/ui/detail-card";
import { ContentTransition, StateTransition } from "@/components/motion/state-transition";
import { StaggerItem, StaggerList } from "@/components/motion/stagger";
import type { FeedKind } from "@/components/ui/feed-list";

export interface DetailPanel { key: string; content: ReactNode }

function DetailPlaceholder({ kind }: { kind: FeedKind }) {
  return <>
    <DetailCardHeader badges={<><Skeleton className="h-6 w-20 rounded-full" />{kind !== "announcement" ? <Skeleton className="h-6 w-16 rounded-full" /> : null}</>} title={<Skeleton className="h-9 w-3/5" />} metadata={<Skeleton className="h-4 w-40" />} />
    <DetailCardBody><div className="space-y-3"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div></DetailCardBody>
  </>;
}

export function DetailLayout({
  after,
  content,
  discussion,
  dock = false,
  error,
  kind,
  loading,
  onRetry,
  panels,
  toolbar,
}: {
  after?: ReactNode;
  content?: ReactNode;
  discussion?: ReactNode;
  dock?: boolean;
  error?: string;
  kind: FeedKind;
  loading: boolean;
  onRetry?: () => void;
  panels?: DetailPanel[];
  toolbar?: ReactNode;
}) {
  const { t } = useI18n();
  const Reaction = kind === "announcement" ? Heart : Hand;
  const pendingPanels: DetailPanel[] = [{ key: "reaction", content: <>
    <div className="flex min-h-5 items-center justify-between gap-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-5 w-14" /></div>
    {kind === "issue" ? <Skeleton className="h-2 w-full" /> : null}
    <Button className="mx-auto opacity-100" disabled size="icon-lg" variant="ghost"><Reaction /></Button>
  </> }];
  if (kind === "issue") pendingPanels.push({ key: "timeline", content: <>
    <div className="flex items-center gap-2"><Clock3 className="size-4" /><p className="text-sm font-medium">{t('ui.issue.timeline')}</p></div>
    <div className="space-y-3">{Array.from({ length: 3 }, (_, index) => <div className="space-y-1.5" key={index}><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-28" /></div>)}</div>
  </> });
  return (
    <StateTransition identity={loading ? "loading" : error ? "error" : "content"}>
      <div className={dock ? "detail-with-discussion-composer space-y-5" : "space-y-5"}>
        {toolbar || <div className="flex h-9 items-center"><Button aria-label={t('ui.common.back')} onClick={() => window.history.back()} size="icon" variant="ghost"><ArrowLeft /></Button></div>}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
          <article className="min-w-0 space-y-4">
            <Card className="gap-0 overflow-hidden py-0" data-detail-card="content" aria-busy={loading}>
              <ContentTransition identity={loading ? "loading" : error ? "error" : "content"}>
                {loading ? <DetailPlaceholder kind={kind} /> : error ? <div className="space-y-4 p-5"><h1 className="text-xl font-semibold">{t('ui.common.loadFailed')}</h1><p className="text-sm text-muted-foreground">{error}</p><Button onClick={onRetry} variant="outline"><RefreshCw />{t('ui.common.reload')}</Button></div> : content}
              </ContentTransition>
            </Card>
            {discussion}
          </article>
          <aside className="lg:sticky lg:top-6">
            <StaggerList className="space-y-3">
              {(error ? [] : panels ?? pendingPanels).map((panel) => (
                <StaggerItem key={panel.key}>
                  <Card className="gap-4 p-5" data-detail-card={panel.key}>
                    <ContentTransition identity={loading ? "loading" : "content"}>{panel.content}</ContentTransition>
                  </Card>
                </StaggerItem>
              ))}
            </StaggerList>
          </aside>
        </div>
        {after}
      </div>
    </StateTransition>
  );
}
