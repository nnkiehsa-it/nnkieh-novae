"use client";

import {
  isUserRestricted,
  responsibilityLabel,
  UserDetailsDialog,
} from "@/components/admin/user-details-dialog";
import { RecordList } from "@/components/ui/record-list";
import { useAdminUsers } from "@/hooks/use-admin-console";
import { useI18n, type TranslationParams } from "@/i18n";
import { formatRelativeTime } from "@/lib/format";
import type { AdminUser } from "@/hooks/use-admin-console";

type Translator = (key: string, params?: TranslationParams) => string;

/**
 * One person, as small as a person can honestly be written.
 *
 * A member used to be a row of five columns, which meant five stacked labelled
 * fields on anything narrower than a desktop and a great deal of empty width on
 * a desktop. What an administrator scans for is a name, whether the account is
 * in an unusual state, and how recently it was used; the rest of the record
 * opens in the sheet. Two of these fit across a card, so the list is a third of
 * the height it was.
 */
function PersonRow({
  onSelect,
  selected,
  t,
  user,
}: {
  onSelect: (user: AdminUser) => void;
  selected: boolean;
  t: Translator;
  user: AdminUser;
}) {
  const administrator = user.roles.includes("platform-admin");
  const restricted = !administrator && isUserRestricted(user);
  const responsibility = responsibilityLabel(user, t);

  return (
    <button
      className="t-row flex min-w-0 flex-col gap-0.5 py-[var(--row-padding-block)] text-left"
      data-selected={selected}
      onClick={() => onSelect(user)}
      type="button"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-medium">{user.name}</span>
        {administrator || restricted ? (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              restricted ? "bg-destructive/10 text-destructive" : "bg-tint text-tint-foreground"
            }`}
          >
            {restricted ? t("ui.adminConsole.restricted") : t("ui.adminConsole.platformAdmin")}
          </span>
        ) : null}
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {user.lastSeenAt ? formatRelativeTime(user.lastSeenAt) : t("ui.adminConsole.neverSeen")}
        </span>
      </span>
      <span className="flex min-w-0 items-center gap-3 text-xs text-muted-foreground">
        <span className="truncate">{user.email ?? user.uid}</span>
        {responsibility === "—" ? null : (
          <span className="ml-auto max-w-[50%] truncate">{responsibility}</span>
        )}
      </span>
    </button>
  );
}

export function UserManagement() {
  const { t } = useI18n();
  const state = useAdminUsers();

  return (
    <>
      <RecordList
        count={state.users.length}
        emptyLabel={t("ui.adminConsole.noUsers")}
        error={state.error}
        hasMore={state.hasMore}
        loading={state.loading}
        onPageChange={(page) => void state.changePage(page)}
        onQueryChange={state.setQuery}
        onSearch={() => void state.load(state.query)}
        page={state.page}
        query={state.query}
        searchPlaceholder={t("ui.adminConsole.userSearchPlaceholder")}
      >
        <div className="rule-grid px-[var(--row-gutter)]">
          {state.users.map((user) => (
            <PersonRow
              key={user.uid}
              onSelect={state.setSelected}
              selected={state.selected?.uid === user.uid}
              t={t}
              user={user}
            />
          ))}
        </div>
      </RecordList>
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
