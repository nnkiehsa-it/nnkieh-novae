"use client";

import * as React from "react";
import { ShieldOff } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DecisionForm, type DecisionOption } from "@/components/ui/decision-sheet";
import { ListMutationRow, ListRow, ListSection, RowAction } from "@/components/ui/list";
import { ListNumberRow } from "@/components/ui/list-controls";
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
  if (user.roles.includes("platform-admin")) {
    labels.push(t("ui.adminConsole.platformAdmin"));
  }
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

function statusLabel(user: AdminUser, t: Translator) {
  if (!isUserRestricted(user)) return t("ui.adminConsole.normal");
  if (user.restrictedPermanently) return t("ui.adminConsole.permanentRestriction");
  return user.restrictedUntil
    ? t("ui.adminConsole.restrictedUntil", { date: formatDate(user.restrictedUntil) })
    : t("ui.adminConsole.restricted");
}

interface UserDetailsDialogProps {
  busy: boolean;
  durationHours: number;
  onClose: () => void;
  onDurationHoursChange: (hours: number) => void;
  onReasonChange: (reason: string) => void;
  onRestrictionChange: (mode: RestrictionMode) => void;
  reason: string;
  user: AdminUser | null;
}

/**
 * One member, read and acted on in the same sheet.
 *
 * The selected user is held for as long as the sheet is on screen, including
 * the frames it spends leaving: unmounting it with the selection is what used
 * to make the sheet vanish instead of sliding back down.
 */
export function UserDetailsDialog({
  busy,
  durationHours,
  onClose,
  onDurationHoursChange,
  onReasonChange,
  onRestrictionChange,
  reason,
  user,
}: UserDetailsDialogProps) {
  const { t } = useI18n();
  const [shown, setShown] = React.useState<AdminUser | null>(user);
  if (user && user !== shown) setShown(user);
  const subject = user ?? shown;
  if (!subject) return null;

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={Boolean(user)}>
      <DialogContent presentation="sheet">
        <DialogHeader>
          <DialogTitle>{subject.name}</DialogTitle>
          <DialogDescription>{subject.email ?? subject.uid}</DialogDescription>
        </DialogHeader>

        <ListSection>
          <ListRow label="UID" value={<span className="font-mono text-xs">{subject.uid}</span>} />
          <ListRow
            label={t("ui.adminConsole.registeredAtColumn")}
            value={formatDate(subject.createdAt)}
          />
          <ListRow
            label={t("ui.adminConsole.lastSeenColumn")}
            value={
              subject.lastSeenAt
                ? formatDate(subject.lastSeenAt)
                : t("ui.adminConsole.neverSeen")
            }
          />
          <ListRow label={t("ui.adminConsole.accountStatus")} value={statusLabel(subject, t)} />
          <ListRow
            label={t("ui.adminConsole.scopeColumn")}
            value={responsibilityLabel(subject, t)}
          />
        </ListSection>

        {subject.roles.includes("platform-admin") ? (
          <ListSection>
            <ListRow label={t("ui.adminConsole.platformAdminRestrictionNotice")} />
          </ListSection>
        ) : isUserRestricted(subject) ? (
          <ListSection header={t("ui.adminConsole.restrictionActiveTitle")}>
            <ListRow
              label={subject.restrictionReason || t("ui.adminConsole.noRestrictionReason")}
            />
            <ListMutationRow
              action={
                <RowAction
                  busy={busy}
                  icon={ShieldOff}
                  label={t("ui.adminConsole.clearRestriction")}
                  onClick={() => onRestrictionChange("clear")}
                  tone="destructive"
                />
              }
              label={t("ui.adminConsole.clearRestriction")}
            />
          </ListSection>
        ) : (
          <RestrictionDecision
            busy={busy}
            durationHours={durationHours}
            onDurationHoursChange={onDurationHoursChange}
            onReasonChange={onReasonChange}
            onRestrict={onRestrictionChange}
            reason={reason}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RestrictionDecision({
  busy,
  durationHours,
  onDurationHoursChange,
  onReasonChange,
  onRestrict,
  reason,
}: {
  busy: boolean;
  durationHours: number;
  onDurationHoursChange: (hours: number) => void;
  onReasonChange: (reason: string) => void;
  onRestrict: (mode: RestrictionMode) => void;
  reason: string;
}) {
  const { t } = useI18n();
  const [mode, setMode] = React.useState<RestrictionMode>("7d");
  const customValid =
    Number.isInteger(durationHours) && durationHours >= 1 && durationHours <= 87_600;
  const options: DecisionOption[] = [
    { label: t("ui.adminConsole.restriction7d"), value: "7d" },
    { label: t("ui.adminConsole.restriction30d"), value: "30d" },
    { label: t("ui.operations.restrictCustom"), value: "custom" },
    {
      label: t("ui.adminConsole.restrictionPermanent"),
      tone: "destructive",
      value: "permanent",
    },
  ];

  return (
    <DecisionForm
      busy={busy}
      note={{
        label: t("ui.adminConsole.restrictionReasonPlaceholder"),
        onChange: onReasonChange,
        required: true,
        value: reason,
      }}
      onSubmit={() => onRestrict(mode)}
      onValueChange={(value) => setMode(value as RestrictionMode)}
      options={options}
      sectionHeader={t("ui.adminConsole.restrictionTitle")}
      submitLabel={t("ui.adminConsole.restrictionApply")}
      submittable={mode !== "custom" || customValid}
      value={mode}
    >
      {mode === "custom" ? (
        <ListNumberRow
          label={t("ui.operations.restrictionHours")}
          max={87_600}
          min={1}
          onChange={onDurationHoursChange}
          unit={t("admin.unitHours")}
          value={durationHours}
        />
      ) : null}
    </DecisionForm>
  );
}
