"use client";

import Link from "next/link";
import { CheckCircle, Gavel, Warning, Wrench } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { useCategories } from "@/hooks/use-categories";
import { usePlatformAttention } from "@/hooks/use-platform-attention";
import type { useHomeStatusCounts } from "@/hooks/use-home-status-counts";
import { useSession } from "@/hooks/use-session";
import { feedHref } from "@/lib/feed-href";
import { Chip } from "@/ui/chip";
import { Skeleton } from "@/ui/feedback";
import { Panel, SectionTitle } from "@/ui/panel";

interface Todo {
  chip: React.ReactNode;
  href: string;
  key: string;
  text: string;
}

/** Sums one status over the categories this person manages, and names the first that has any. */
function managedTotal<Status extends string>(
  byCategory: Record<string, Record<Status, number>>,
  status: Status,
  manages: (categoryId: string) => boolean,
) {
  let total = 0;
  let first: string | null = null;
  for (const [categoryId, counts] of Object.entries(byCategory)) {
    if (!manages(categoryId) || !counts[status]) continue;
    total += counts[status];
    first ??= categoryId;
  }
  return { first, total };
}

/**
 * What is waiting on the person signed in: proposals to review, facility
 * reports nobody has picked up, and background work that is failing. Shown
 * only to people with something they could be responsible for.
 */
export function TodoCards({ counts }: { counts: ReturnType<typeof useHomeStatusCounts> }) {
  const { t } = useI18n();
  const session = useSession();
  const categories = useCategories();
  const platform = usePlatformAttention();
  const managesIssues = categories.issuesEnabled && categories.activeIssueCategories.some((category) => session.canManageIssueCategory(category.id));
  const managesFacilities = categories.facilitiesEnabled && categories.activeFacilityCategories.some((category) => session.canManageFacilityCategory(category.id));
  if (!managesIssues && !managesFacilities && !platform.allowed) return null;

  const review = managedTotal(counts.issuesByCategory, "under-review", session.canManageIssueCategory);
  const pending = managedTotal(counts.facilitiesByCategory, "pending", session.canManageFacilityCategory);
  const todos: Todo[] = [
    ...(managesIssues && review.total ? [{
      chip: <Chip tone="caution"><Gavel weight="bold" />{t("ui.home.todoReviewChip")}</Chip>,
      href: feedHref("issues", review.first),
      key: "review",
      text: t("ui.home.todoReview", { count: review.total }),
    }] : []),
    ...(managesFacilities && pending.total ? [{
      chip: <Chip tone="info"><Wrench weight="bold" />{t("ui.home.todoFacilityChip")}</Chip>,
      href: feedHref("facilities", pending.first),
      key: "facility",
      text: t("ui.home.todoFacility", { count: pending.total }),
    }] : []),
    ...(platform.failing ? [{
      chip: <Chip tone="danger"><Warning weight="bold" />{t("ui.home.todoSystemChip")}</Chip>,
      href: "/admin/system",
      key: "system",
      text: t("ui.home.todoSystem", { count: platform.failing }),
    }] : []),
  ];

  return (
    <section className="grid gap-3">
      <SectionTitle>{t("ui.home.todoTitle")}</SectionTitle>
      {counts.loading ? (
        <Panel className="grid gap-3"><Skeleton className="h-7 w-20 rounded-chip" /><Skeleton className="h-5 w-4/5" /></Panel>
      ) : todos.length ? todos.map((todo) => (
        <Panel asChild interactive key={todo.key}>
          <Link href={todo.href} prefetch={false}>
            <p className="text-[1.0625rem] leading-9">
              <span className="mr-2 inline-flex align-middle">{todo.chip}</span>
              {todo.text}
            </p>
          </Link>
        </Panel>
      )) : (
        <Panel>
          <p className="text-[1.0625rem] leading-9">
            <span className="mr-2 inline-flex align-middle"><Chip tone="positive"><CheckCircle weight="bold" />{t("ui.home.todoClearChip")}</Chip></span>
            {t("ui.home.todoClear")}
          </p>
        </Panel>
      )}
    </section>
  );
}
