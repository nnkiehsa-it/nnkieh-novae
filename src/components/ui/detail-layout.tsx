"use client";

import type { ReactNode } from "react";
import { Clock3, Hand, Heart, RefreshCw } from "lucide-react";
import { Icon } from "framework7-react";
import { useI18n } from "@/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DetailCardHeader, DetailCardBody } from "@/components/ui/detail-card";
import { ContentTransition, StateTransition } from "@/components/motion/state-transition";
import { StaggerItem, StaggerList } from "@/components/motion/stagger";
import type { FeedKind } from "@/components/ui/feed-list";
import { useCloseRouteOverlay } from "@/components/detail-sheet";
import { SecondaryToolbar } from "@/components/detail-toolbar";
import { ToolbarButton } from "./toolbar-button";
import { Timeline } from "./timeline";

export interface DetailPanel { key: string; content: ReactNode; className?: string }

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
  const closeRecord = useCloseRouteOverlay();
  const Reaction = kind === "announcement" ? Heart : Hand;
  const pendingPanels: DetailPanel[] = [{ key: "reaction", content: <>
    <div className="flex min-h-5 items-center justify-between gap-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-5 w-14" /></div>
    {kind === "issue" ? <Skeleton className="h-2 w-full" /> : null}
    <Button className="mx-auto opacity-100" disabled size="icon-lg" variant="ghost"><Reaction /></Button>
  </> }];
  if (kind === "issue") pendingPanels.push({ key: "timeline", content: <div className="grid gap-5">
    <div className="flex items-center gap-2"><Clock3 className="size-4" /><p className="text-sm font-medium">{t('ui.issue.timeline')}</p></div>
    <Timeline items={Array.from({ length: 3 }, (_, index) => ({key: String(index), title: <Skeleton className="h-4 w-20" />, content: <Skeleton className="h-4 w-28" />}))} />
  </div> });
  return (
    <div className={dock ? "detail-with-discussion-composer" : undefined}>
      {/* The controls of a record stay where they are while the record travels
          under them, the way the controls of a list do. They ride outside the
          state transition because they are the one part of the screen that does
          not change when the record finishes loading -- and because that
          transition clips itself while it animates its height, which a sticky
          header inside it would be caught by. */}
      <header className="detail-header">
        {toolbar || <SecondaryToolbar backLabel={t('common.close')} onBack={closeRecord ?? (() => undefined)} backDisabled={!closeRecord}
          actions={<ToolbarButton aria-label={t('common.share')} disabled><Icon f7="square_arrow_up" aria-hidden="true" /></ToolbarButton>} />}
      </header>
      <StateTransition className="space-y-5 p-4" identity={loading ? "loading" : error ? "error" : "content"}>
        <div className="grid gap-4">
          <article className="min-w-0 space-y-4">
            <Card className="gap-0 overflow-hidden py-0" data-detail-card="content" aria-busy={loading}>
              <ContentTransition identity={loading ? "loading" : error ? "error" : "content"}>
                {loading ? <DetailPlaceholder kind={kind} /> : error ? <div className="space-y-4 p-5"><h1 className="text-xl font-semibold">{t('ui.common.loadFailed')}</h1><p className="text-sm text-muted-foreground">{error}</p><Button onClick={onRetry} variant="outline"><RefreshCw />{t('ui.common.reload')}</Button></div> : content}
              </ContentTransition>
            </Card>
          </article>
          <aside className="lg:sticky lg:top-6">
            <StaggerList className="space-y-3">
              {(error ? [] : panels ?? pendingPanels).map((panel) => (
                <StaggerItem key={panel.key}>
                  <Card className={panel.className} data-detail-card={panel.key}>
                    <CardContent><ContentTransition identity={loading ? "loading" : "content"}>{panel.content}</ContentTransition></CardContent>
                  </Card>
                </StaggerItem>
              ))}
            </StaggerList>
          </aside>
        </div>
        {discussion}
        {after}
      </StateTransition>
    </div>
  );
}
