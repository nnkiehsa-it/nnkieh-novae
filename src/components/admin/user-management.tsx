"use client";

import { MoreHorizontal } from "lucide-react";

import {
  isUserRestricted,
  responsibilityLabel,
  UserDetailsDialog,
} from "@/components/admin/user-details-dialog";
import { Button } from "@/components/ui/button";
import { DataList } from "@/components/ui/data-list";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAdminUsers } from "@/hooks/use-admin-console";
import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";
import type { AdminUser } from "@/hooks/use-admin-console";

const GRID = "minmax(10rem,1.4fr) 6rem 7.5rem 7.5rem minmax(7rem,1fr) 2.5rem";

export function UserManagement() {
  const { t } = useI18n();
  const state = useAdminUsers();

  function statusOf(user: AdminUser) {
    if (user.roles.includes("platform-admin")) return t("ui.adminConsole.platformAdmin");
    return isUserRestricted(user)
      ? t("ui.adminConsole.restricted")
      : t("ui.adminConsole.normal");
  }

  return (
    <>
      <DataList<AdminUser>
        columns={[
          { key: "user", label: t("ui.adminConsole.userColumn") },
          { key: "status", label: t("ui.adminConsole.statusColumn") },
          { key: "lastSeen", label: t("ui.adminConsole.lastSeenColumn") },
          { key: "registered", label: t("ui.adminConsole.registeredAtColumn") },
          { key: "scope", label: t("ui.adminConsole.scopeColumn") },
        ]}
        emptyLabel={t("ui.adminConsole.noUsers")}
        error={state.error}
        grid={GRID}
        hasMore={state.hasMore}
        loading={state.loading}
        onPageChange={(page) => void state.changePage(page)}
        onQueryChange={state.setQuery}
        onRowSelect={state.setSelected}
        onSearch={() => void state.load(state.query)}
        page={state.page}
        query={state.query}
        renderCell={(user, key) => {
          if (key === "user")
            return (
              <>
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {user.email ?? user.uid}
                </p>
              </>
            );
          if (key === "status")
            return (
              <span
                className={[
                  "inline-flex rounded-full px-2 py-1 text-xs font-medium",
                  isUserRestricted(user) && !user.roles.includes("platform-admin")
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-muted-foreground",
                ].join(" ")}
              >
                {statusOf(user)}
              </span>
            );
          if (key === "lastSeen")
            return user.lastSeenAt ? formatDate(user.lastSeenAt) : t("ui.adminConsole.neverSeen");
          if (key === "registered") return formatDate(user.createdAt);
          return responsibilityLabel(user, t);
        }}
        rowAction={(user) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={t("ui.common.moreActions")}
                size="icon-sm"
                variant="ghost"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => state.setSelected(user)}>
                {t("ui.adminConsole.viewDetails")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        rowKey={(user) => user.uid}
        rows={state.users}
        searchPlaceholder={t("ui.adminConsole.userSearchPlaceholder")}
      />
      <UserDetailsDialog
        busy={state.busy === state.selected?.uid}
        durationHours={state.durationHours}
        onClose={() => {
          state.setSelected(null);
          state.setReason("");
        }}
        onDurationHoursChange={state.setDurationHours}
        onReasonChange={state.setReason}
        onRestrictionChange={(mode) =>
          state.selected && void state.updateRestriction(state.selected, mode)
        }
        reason={state.reason}
        user={state.selected}
      />
    </>
  );
}
