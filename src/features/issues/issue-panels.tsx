"use client";

import * as React from "react";
import { motion } from "motion/react";
import { HandHeart, UsersThree } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import type { IssueRecord } from "@/types";
import { formatDate } from "@/lib/format";
import type { getIssueOperationTimeItems } from "@/lib/issue-timeline";
import { timing } from "@/lib/motion-timing";
import { Person } from "@/features/content/person";
import { ReactionButton } from "@/features/content/reaction";
import { AnimatedNumber } from "@/ui/animated-number";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/feedback";
import { ListGroup, ListRow } from "@/ui/list";
import { Panel } from "@/ui/panel";
import { Sheet } from "@/ui/sheet";

interface Supporter { displayName: string; photoUrl: string | null; uid: string }

function SupportersSheet({ error, loading, onLoad, supporters }: { error: string; loading: boolean; onLoad: () => void; supporters: Supporter[] }) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => { setOpen(true); onLoad(); }} size="sm" variant="ghost"><UsersThree />{t("ui.issue.supporters")}</Button>
      <Sheet onOpenChange={setOpen} open={open} title={t("ui.issue.supporters")}>
        {loading ? (
          <div className="grid gap-4">
            {[0, 1, 2].map((row) => <div className="flex items-center gap-3" key={row}><Skeleton className="size-9 rounded-full" /><Skeleton className="h-4 w-28" /></div>)}
          </div>
        ) : error ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-ink-muted">{t("ui.common.loadFailed")}</span>
            <Button onClick={onLoad} size="sm">{t("ui.common.reload")}</Button>
          </div>
        ) : (
          <ListGroup label={t("ui.issue.supporters")}>
            {supporters.map((supporter) => (
              <ListRow key={supporter.uid} label={<Person name={supporter.displayName} photoUrl={supporter.photoUrl} />} />
            ))}
          </ListGroup>
        )}
      </Sheet>
    </>
  );
}

/** How far a proposal is from its goal, and the reader's own support. */
export function SupportPanel({ burst, canViewSupporters, issue, onLoadSupporters, onSupport, supportOpen, supportProgress, supporters, supportersError, supportersLoading, supporting }: {
  burst: number;
  canViewSupporters: boolean;
  issue: IssueRecord;
  onLoadSupporters: () => void;
  onSupport: () => void;
  supportOpen: boolean;
  supportProgress: number;
  supporters: Supporter[];
  supportersError: string;
  supportersLoading: boolean;
  supporting: boolean;
}) {
  const { t } = useI18n();
  const label = issue.isOwnIssue ? t("ui.issue.ownSupport")
    : issue.currentUserSupported ? t("ui.issue.cancelSupport")
      : supportOpen ? t("ui.issue.support") : t("ui.issue.supportClosed");
  return (
    <Panel className="grid gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-ink-muted">{t("ui.issue.supportProgress")}</p>
        <p className="text-2xl font-semibold tabular-nums">
          <AnimatedNumber value={issue.supportCount} />
          {issue.supportGoal ? <span className="text-base text-ink-faint"> / {issue.supportGoal}</span> : null}
        </p>
      </div>
      {issue.supportGoal ? (
        <div className="h-2 overflow-hidden rounded-full bg-surface-pressed">
          <motion.span
            animate={{ scaleX: supportProgress / 100 }}
            className="block h-full origin-left rounded-full bg-contrast"
            initial={false}
            transition={timing("sheet")}
          />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ReactionButton
          active={issue.currentUserSupported === true}
          burst={burst}
          busy={supporting}
          disabled={issue.isOwnIssue || !supportOpen}
          icon={HandHeart}
          label={label}
          onClick={onSupport}
        />
        {canViewSupporters ? (
          <SupportersSheet error={supportersError} loading={supportersLoading} onLoad={onLoadSupporters} supporters={supporters} />
        ) : null}
      </div>
    </Panel>
  );
}

/** When each step of a proposal happened, oldest first. */
export function Timeline({ items }: { items: ReturnType<typeof getIssueOperationTimeItems> }) {
  const { t } = useI18n();
  return (
    <Panel className="grid gap-4">
      <h2 className="text-sm font-medium text-ink-muted">{t("ui.issue.timeline")}</h2>
      <ol className="grid">
        {items.map((item, index) => (
          <li className="grid grid-cols-[1rem_1fr] gap-3 pb-4 last:pb-0" key={item.label}>
            <span className="flex flex-col items-center">
              <span className="mt-1.5 size-2.5 rounded-full bg-contrast" />
              {index < items.length - 1 ? <span className="mt-1 w-px flex-1 bg-line" /> : null}
            </span>
            <span>
              <span className="block text-[0.9375rem] font-medium">{t(item.shortLabel)}</span>
              <span className="block text-sm text-ink-muted">{formatDate(item.value)}</span>
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
