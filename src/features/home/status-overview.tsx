"use client";

import Link from "next/link";
import { CaretRight, Lightbulb, Wrench } from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import { useI18n } from "@/i18n";
import { FACILITY_BUCKET_STATUSES, ISSUE_BUCKET_STATUSES } from "@/constants/statuses";
import { useCategories } from "@/hooks/use-categories";
import type { useHomeStatusCounts } from "@/hooks/use-home-status-counts";
import { feedHref } from "@/lib/feed-href";
import { statusColor, statusLabelKey, type ContentStatus } from "@/features/content/status";
import { AnimatedNumber } from "@/ui/animated-number";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/feedback";
import { Panel, SectionTitle } from "@/ui/panel";

interface Segment { count: number; status: ContentStatus }

function DomainStatus({ domain, href, icon: DomainIcon, label, loading, segments }: {
  domain: "facility" | "issue";
  href: string;
  icon: Icon;
  label: string;
  loading: boolean;
  segments: Segment[];
}) {
  const { t } = useI18n();
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  const shown = segments.filter((segment) => segment.count > 0);
  return (
    <Panel asChild className="grid gap-4" interactive>
      <Link href={href} prefetch={false}>
        <span className="flex items-center gap-3">
          <span aria-hidden className="grid size-10 place-items-center rounded-full bg-surface-raised"><DomainIcon className="size-5" weight="bold" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{label}</span>
            <span className="block text-sm tabular-nums text-ink-muted">{loading ? "—" : <AnimatedNumber value={total} />}</span>
          </span>
          <CaretRight aria-hidden className="size-4 text-ink-faint" weight="bold" />
        </span>
        {loading ? <Skeleton className="h-2.5 w-full rounded-full" /> : total === 0 ? (
          <span className="text-sm text-ink-muted">{t("ui.home.noActivity")}</span>
        ) : (
          <>
            <span aria-hidden className="flex h-2.5 gap-1 overflow-hidden rounded-full">
              {shown.map((segment) => (
                <span className="h-full rounded-full" key={segment.status} style={{ background: statusColor(segment.status), flexGrow: segment.count }} />
              ))}
            </span>
            <span className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
              {shown.map((segment) => (
                <span className="inline-flex items-center gap-1.5" key={segment.status}>
                  <span aria-hidden className="size-2 rounded-full" style={{ background: statusColor(segment.status) }} />
                  <span className="text-ink-muted">{t(statusLabelKey(domain, segment.status))}</span>
                  <span className="font-medium tabular-nums">{segment.count}</span>
                </span>
              ))}
            </span>
          </>
        )}
      </Link>
    </Panel>
  );
}

/** How many proposals and reports sit in each status, as a bar per domain. */
export function StatusOverview({ counts }: { counts: ReturnType<typeof useHomeStatusCounts> }) {
  const { t } = useI18n();
  const { facilitiesEnabled, issuesEnabled } = useCategories();
  if (!issuesEnabled && !facilitiesEnabled) return null;
  return (
    <section className="grid gap-3">
      <SectionTitle>{t("ui.home.overallStatus")}</SectionTitle>
      {counts.error ? (
        <Panel className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink-muted" role="alert">{t("ui.home.statusLoadFailed")}</p>
          <Button onClick={() => void counts.retry()} size="sm">{t("common.retry")}</Button>
        </Panel>
      ) : (
        <div className="grid gap-3">
          {issuesEnabled ? (
            <DomainStatus
              domain="issue"
              href={feedHref("issues")}
              icon={Lightbulb}
              label={t("ui.nav.issues")}
              loading={counts.loading}
              segments={[...ISSUE_BUCKET_STATUSES.active, ...ISSUE_BUCKET_STATUSES.closed].map((status) => ({ count: counts.issues[status], status }))}
            />
          ) : null}
          {facilitiesEnabled ? (
            <DomainStatus
              domain="facility"
              href={feedHref("facilities")}
              icon={Wrench}
              label={t("ui.home.facilitiesTitle")}
              loading={counts.loading}
              segments={[...FACILITY_BUCKET_STATUSES.active, ...FACILITY_BUCKET_STATUSES.closed].map((status) => ({ count: counts.facilities[status], status }))}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}
