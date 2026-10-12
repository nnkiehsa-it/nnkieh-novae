"use client";

import Link from "next/link";
import type { Icon } from "@phosphor-icons/react";
import { CaretRight, ClockCounterClockwise, FolderOpen, Gauge, HardDrives, SlidersHorizontal, UsersThree } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { ADMIN_GROUPS, allowedAdminRoutes, type AdminAccess, type AdminGroup } from "@/lib/admin-routes";
import { Panel, SectionTitle } from "@/ui/panel";

const SECTIONS: Record<string, { icon: Icon; summaryKey: string }> = {
  "/admin/audit": { icon: ClockCounterClockwise, summaryKey: "admin.summary.audit" },
  "/admin/content": { icon: FolderOpen, summaryKey: "admin.summary.content" },
  "/admin/people": { icon: UsersThree, summaryKey: "admin.summary.people" },
  "/admin/platform": { icon: SlidersHorizontal, summaryKey: "admin.summary.platform" },
  "/admin/policies": { icon: Gauge, summaryKey: "admin.summary.policies" },
  "/admin/system": { icon: HardDrives, summaryKey: "admin.summary.system" },
};

const GROUP_LABEL_KEYS: Record<AdminGroup, string> = {
  content: "admin.groupContent",
  people: "admin.groupPeople",
  system: "admin.groupSystem",
};

/** Every section this reader may enter, grouped, with a sentence on what each one is for. */
export function SectionDirectory({ access }: { access: AdminAccess }) {
  const { t } = useI18n();
  const routes = allowedAdminRoutes(access);
  return (
    <div className="grid gap-6">
      {ADMIN_GROUPS.map((group) => {
        const inGroup = routes.filter((route) => route.group === group);
        if (inGroup.length === 0) return null;
        return (
          <section className="grid gap-2" key={group}>
            <SectionTitle>{t(GROUP_LABEL_KEYS[group])}</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {inGroup.map((route) => {
                const { icon: SectionIcon, summaryKey } = SECTIONS[route.href];
                return (
                  <Panel asChild interactive key={route.href}>
                    <Link className="flex items-start gap-4" href={route.href}>
                      <SectionIcon aria-hidden className="mt-0.5 size-6 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-medium">{t(route.labelKey)}</span>
                        <span className="mt-1 block text-sm leading-relaxed text-ink-muted">{t(summaryKey)}</span>
                      </span>
                      <CaretRight aria-hidden className="mt-1 size-4 shrink-0 text-ink-faint" weight="bold" />
                    </Link>
                  </Panel>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
