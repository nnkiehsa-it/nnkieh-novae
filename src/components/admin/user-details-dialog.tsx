"use client";

import { ShieldOff, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AdminUser, RestrictionMode } from "@/hooks/use-admin-console";
import { useI18n, type TranslationParams } from "@/i18n";
import { formatDate } from "@/lib/format";

export function isUserRestricted(user: AdminUser) {
  return user.restrictedPermanently
    || Boolean(user.restrictedUntil && user.restrictedUntil.getTime() > Date.now());
}

type Translator = (key: string, params?: TranslationParams) => string;

export function responsibilityLabel(user: AdminUser, t: Translator) {
  const labels: string[] = [];
  if (user.roles.includes("announcement-manager")) {
    labels.push(t("ui.adminConsole.announcementScope"));
  }
  if (user.managedIssueCategoryIds.length > 0) {
    labels.push(t("ui.adminConsole.issueScope", { count: user.managedIssueCategoryIds.length }));
  }
  if (user.managedFacilityCategoryIds.length > 0) {
    labels.push(t("ui.adminConsole.facilityScope", { count: user.managedFacilityCategoryIds.length }));
  }
  return labels.length > 0 ? labels.join(" · ") : "—";
}

interface UserDetailsDialogProps {
  busy: boolean;
  onClose: () => void;
  onReasonChange: (reason: string) => void;
  onRestrictionChange: (mode: RestrictionMode) => void;
  reason: string;
  user: AdminUser | null;
}

export function UserDetailsDialog({
  busy,
  onClose,
  onReasonChange,
  onRestrictionChange,
  reason,
  user,
}: UserDetailsDialogProps) {
  const { t } = useI18n();
  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={Boolean(user)}>
      {user ? (
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserRound className="size-4 text-muted-foreground" />
              {user.name}
            </DialogTitle>
            <DialogDescription>{user.email ?? user.uid}</DialogDescription>
          </DialogHeader>

          <div className="divide-y rounded-xl border">
            {[
              ["Email", user.email ?? "—"],
              ["UID", user.uid],
              [t("ui.adminConsole.registeredAtColumn"), formatDate(user.createdAt)],
              [
                t("ui.adminConsole.accountStatus"),
                isUserRestricted(user)
                  ? user.restrictedPermanently
                    ? t("ui.adminConsole.permanentRestriction")
                    : user.restrictedUntil
                      ? t("ui.adminConsole.restrictedUntil", { date: formatDate(user.restrictedUntil) })
                      : t("ui.adminConsole.restricted")
                  : t("ui.adminConsole.normal"),
              ],
              [t("ui.adminConsole.scopeColumn"), responsibilityLabel(user, t)],
            ].map(([label, value]) => (
              <div className="grid grid-cols-[7rem_1fr] gap-4 px-4 py-3 text-sm" key={label}>
                <span className="text-muted-foreground">{label}</span>
                <span className="break-all">{value}</span>
              </div>
            ))}
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {t("ui.adminConsole.permissions")}
            </p>
            <div className="flex flex-wrap gap-2">
              {user.roles.length === 0
                && user.managedIssueCategoryIds.length === 0
                && user.managedFacilityCategoryIds.length === 0 ? (
                  <span className="text-sm text-muted-foreground">
                    {t("ui.adminConsole.noPermissions")}
                  </span>
                ) : (
                  <>
                    {user.roles.map((role) => (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs" key={role}>
                        {role}
                      </span>
                    ))}
                    {user.managedIssueCategoryIds.map((id) => (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs" key={`issue-${id}`}>
                        {t("ui.adminConsole.issueTag", { id })}
                      </span>
                    ))}
                    {user.managedFacilityCategoryIds.map((id) => (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs" key={`facility-${id}`}>
                        {t("ui.adminConsole.facilityTag", { id })}
                      </span>
                    ))}
                  </>
                )}
            </div>
          </div>

          {isUserRestricted(user) ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
              <div className="flex items-start gap-3">
                <ShieldOff className="mt-0.5 size-4 text-destructive" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {t("ui.adminConsole.restrictionActiveTitle")}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {user.restrictionReason || t("ui.adminConsole.noRestrictionReason")}
                  </p>
                  <Button
                    className="mt-3"
                    disabled={busy}
                    onClick={() => onRestrictionChange("clear")}
                    size="sm"
                    variant="outline"
                  >
                    {t("ui.adminConsole.clearRestriction")}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border p-4">
              <div>
                <p className="text-sm font-medium">
                  {t("ui.adminConsole.restrictionTitle")}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t("ui.adminConsole.restrictionDescription")}
                </p>
              </div>
              <Input
                maxLength={500}
                onChange={(event) => onReasonChange(event.target.value)}
                placeholder={t("ui.adminConsole.restrictionReasonPlaceholder")}
                value={reason}
              />
              <div className="flex flex-wrap gap-2">
                {([
                  ["7d", t("ui.adminConsole.restriction7d")],
                  ["30d", t("ui.adminConsole.restriction30d")],
                  ["permanent", t("ui.adminConsole.restrictionPermanent")],
                ] as Array<[RestrictionMode, string]>).map(([mode, label]) => (
                  <Button
                    disabled={busy}
                    key={mode}
                    onClick={() => onRestrictionChange(mode)}
                    size="sm"
                    variant={mode === "permanent" ? "destructive" : "secondary"}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
