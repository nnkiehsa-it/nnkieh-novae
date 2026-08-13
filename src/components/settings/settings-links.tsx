"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import Link from "next/link";
import type * as React from "react";
import {
  ExternalLink,
  Gauge,
  Github,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ManagementLinks({
  canManage,
  canViewDashboard,
}: {
  canManage: boolean;
  canViewDashboard: boolean;
}) {
  useLocaleSubscription();
  if (!canManage && !canViewDashboard) return null;
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="pb-1 pt-5">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4 text-muted-foreground" />{translate('ui.settings.adminTools')}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y !p-0">
        {canViewDashboard ? (
          <SettingLink
            description={translate('ui.settings.dashboardDescription')}
            href="/dashboard"
            icon={<Gauge />}
            label={translate('ui.nav.dashboard')}
          />
        ) : null}
        {canManage ? (
          <SettingLink
            description={translate('ui.settings.managementDescription')}
            href="/admin/management"
            icon={<ShieldCheck />}
            label={translate('ui.admin.title')}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ResourceLinks() {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="pb-1 pt-5">
        <CardTitle className="text-base">{translate('ui.settings.resources')}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y !p-0">
        <SettingLink
          description={translate('ui.settings.websiteDescription')}
          external
          href="https://tavricccc.github.io/novae-website/"
          icon={<ExternalLink />}
          label={translate('ui.settings.website')}
        />
        <SettingLink
          description={translate('ui.settings.sourceDescription')}
          external
          href="https://github.com/tavricccc/novae"
          icon={<Github />}
          label="GitHub"
        />
        <button
          className="flex w-full items-center gap-3 rounded-xl px-5 py-4 text-left transition-colors hover:bg-[var(--surface-hover)] active:bg-[var(--surface-active)] sm:px-7"
          onClick={() => window.location.reload()}
          type="button"
        >
          <SettingLinkContent
            description={translate('ui.settings.restartDescription')}
            icon={<RefreshCcw />}
            label={translate('ui.settings.restart')}
          />
        </button>
      </CardContent>
    </Card>
  );
}

function SettingLink({
  description,
  external = false,
  href,
  icon,
  label,
}: {
  description: string;
  external?: boolean;
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  const content = (
    <SettingLinkContent description={description} icon={icon} label={label} />
  );
  return external ? (
    <a
      className="flex items-center gap-3 rounded-xl px-5 py-4 transition-colors hover:bg-[var(--surface-hover)] active:bg-[var(--surface-active)] sm:px-7"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {content}
    </a>
  ) : (
    <Link
      className="flex items-center gap-3 rounded-xl px-5 py-4 transition-colors hover:bg-[var(--surface-hover)] active:bg-[var(--surface-active)] sm:px-7"
      href={href}
    >
      {content}
    </Link>
  );
}

function SettingLinkContent({
  description,
  icon,
  label,
}: {
  description: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <>
      <span className="grid size-9 place-items-center rounded-xl bg-muted text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <span className="flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {description}
        </span>
      </span>
      <ExternalLink className="size-3.5 text-muted-foreground" />
    </>
  );
}
