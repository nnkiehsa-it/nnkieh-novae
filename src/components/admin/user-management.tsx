"use client";

import {
  isUserRestricted,
  responsibilityLabel,
  UserDetailsSheet,
} from "@/components/admin/user-details-sheet";
import { PersonIdentity } from "@/components/content-author";
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
  const status = administrator
    ? t("ui.adminConsole.platformAdmin")
    : restricted
      ? t("ui.adminConsole.restricted")
      : t("ui.adminConsole.normal");
  const activity = user.lastSeenAt
    ? formatRelativeTime(user.lastSeenAt)
    : t("ui.adminConsole.neverSeen");
  const detail = [responsibility === "—" ? "" : responsibility, activity].filter(Boolean).join(" · ");

  return (
    <button
      className="t-row grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-[var(--row-padding-block)] text-left"
      data-selected={selected}
      onClick={() => onSelect(user)}
      type="button"
    >
      <PersonIdentity name={user.name} photoUrl={user.photoUrl} />
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
          restricted
            ? "bg-destructive/10 text-destructive"
            : administrator
              ? "bg-tint text-tint-foreground"
              : "bg-muted text-muted-foreground"
        }`}
      >
        {status}
      </span>
      <span className="min-w-0 truncate pl-10 text-xs text-muted-foreground">
        {user.email ?? user.uid}
      </span>
      <span className="max-w-44 truncate text-right text-xs text-muted-foreground sm:max-w-64">
        {detail}
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
      <UserDetailsSheet
        busy={state.busy === state.selected?.uid}
        onClose={() => {
          state.setSelected(null);
        }}
        onRestrictionChange={(input) =>
          state.selected && void state.updateRestriction(state.selected, input)
        }
        user={state.selected}
      />
    </>
  );
}
