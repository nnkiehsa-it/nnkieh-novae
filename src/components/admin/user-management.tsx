"use client";

import { useMemo } from "react";
import { MoreHorizontal, Search } from "lucide-react";

import {
  isUserRestricted,
  responsibilityLabel,
  UserDetailsDialog,
} from "@/components/admin/user-details-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ErrorState } from "@/components/ui/page-state";
import { useAdminUsers } from "@/hooks/use-admin-console";
import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";

export function UserManagement() {
  const { t } = useI18n();
  const {
    busy,
    error,
    load,
    loading,
    query,
    reason,
    selected,
    setQuery,
    setReason,
    setSelected,
    updateRestriction,
    users,
  } = useAdminUsers();
  const restrictedCount = useMemo(
    () => users.filter((user) => isUserRestricted(user)).length,
    [users],
  );

  if (error && users.length === 0) {
    return <ErrorState error={error} onRetry={() => void load(query)} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {t("ui.adminConsole.usersTab")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("ui.adminConsole.usersDescription")}
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          {t("ui.adminConsole.userCount", {
            count: users.length,
            restricted: restrictedCount,
          })}
        </div>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void load(query);
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("ui.adminConsole.userSearchPlaceholder")}
            value={query}
          />
        </div>
        <Button disabled={loading} type="submit" variant="secondary">
          {loading ? <LoadingSpinner /> : t("ui.common.search")}
        </Button>
      </form>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="hidden grid-cols-[minmax(10rem,1.4fr)_6rem_7.5rem_7.5rem_minmax(7rem,1fr)_2.5rem] gap-3 border-b bg-muted/35 px-4 py-2.5 text-xs font-medium text-muted-foreground lg:grid">
          <span>{t("ui.adminConsole.userColumn")}</span>
          <span>{t("ui.adminConsole.statusColumn")}</span>
          <span>{t("ui.adminConsole.lastSeenColumn")}</span>
          <span>{t("ui.adminConsole.registeredAtColumn")}</span>
          <span>{t("ui.adminConsole.scopeColumn")}</span>
          <span />
        </div>

        {users.length === 0 && !loading ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            {t("ui.adminConsole.noUsers")}
          </div>
        ) : (
          <div className="divide-y">
            {users.map((user) => {
              const restricted = isUserRestricted(user);
              const platformAdmin = user.roles.includes("platform-admin");
              return (
                <div
                  className="relative grid gap-3 px-4 py-3 pr-14 lg:grid-cols-[minmax(10rem,1.4fr)_6rem_7.5rem_7.5rem_minmax(7rem,1fr)_2.5rem] lg:items-center lg:pr-4"
                  key={user.uid}
                >
                  <button
                    className="min-w-0 text-left"
                    onClick={() => setSelected(user)}
                    type="button"
                  >
                    <p className="truncate text-sm font-medium">{user.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {user.email ?? user.uid}
                    </p>
                  </button>
                  <div className="hidden lg:block">
                    <span
                      className={[
                        "inline-flex rounded-full px-2 py-1 text-xs font-medium",
                        platformAdmin
                          ? "bg-muted text-foreground"
                          : restricted
                          ? "bg-destructive/10 text-destructive"
                          : "bg-muted text-muted-foreground",
                      ].join(" ")}
                    >
                      {platformAdmin
                        ? t("ui.adminConsole.platformAdmin")
                        : restricted
                          ? t("ui.adminConsole.restricted")
                          : t("ui.adminConsole.normal")}
                    </span>
                  </div>
                  <span className="hidden text-xs text-muted-foreground lg:block">
                    {user.lastSeenAt
                      ? formatDate(user.lastSeenAt)
                      : t("ui.adminConsole.neverSeen")}
                  </span>
                  <span className="hidden text-xs text-muted-foreground lg:block">
                    {formatDate(user.createdAt)}
                  </span>
                  <span className="hidden truncate text-xs text-muted-foreground lg:block">
                    {responsibilityLabel(user, t)}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="absolute right-3 top-3 lg:static" aria-label={t("ui.common.moreActions")} size="icon-sm" variant="ghost">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setSelected(user)}>
                        {t("ui.adminConsole.viewDetails")}
                      </DropdownMenuItem>
                      {restricted && !platformAdmin ? (
                        <DropdownMenuItem
                          disabled={busy === user.uid}
                          onSelect={() => void updateRestriction(user, "clear")}
                        >
                          {t("ui.adminConsole.clearRestriction")}
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <dl className="grid gap-x-4 gap-y-3 text-xs sm:grid-cols-3 lg:hidden">
                    <div>
                      <dt className="text-muted-foreground">{t("ui.adminConsole.statusColumn")}</dt>
                      <dd className="mt-1 font-medium">
                        {platformAdmin
                          ? t("ui.adminConsole.platformAdmin")
                          : restricted
                            ? t("ui.adminConsole.restricted")
                            : t("ui.adminConsole.normal")}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t("ui.adminConsole.lastSeenColumn")}</dt>
                      <dd className="mt-1">
                        {user.lastSeenAt
                          ? formatDate(user.lastSeenAt)
                          : t("ui.adminConsole.neverSeen")}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t("ui.adminConsole.registeredAtColumn")}</dt>
                      <dd className="mt-1">{formatDate(user.createdAt)}</dd>
                    </div>
                    <div className="sm:col-span-3">
                      <dt className="text-muted-foreground">{t("ui.adminConsole.scopeColumn")}</dt>
                      <dd className="mt-1">{responsibilityLabel(user, t)}</dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <UserDetailsDialog
        busy={busy === selected?.uid}
        onClose={() => {
          setSelected(null);
          setReason("");
        }}
        onReasonChange={setReason}
        onRestrictionChange={(mode) => selected && void updateRestriction(selected, mode)}
        reason={reason}
        user={selected}
      />
    </div>
  );
}
