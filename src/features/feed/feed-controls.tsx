"use client";

import { MagnifyingGlass, SortAscending } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { Button } from "@/ui/button";
import { Input } from "@/ui/field";
import { Popover, Tooltip } from "@/ui/popover";
import { Select, type SelectOption } from "@/ui/select";

/**
 * Search behind a button: the field is full width when it is being used and
 * out of the way otherwise; a dot on the button says a query is applied.
 */
export function SearchControl({ applied, label, onQueryChange, onSearch, query }: {
  applied: string;
  label: string;
  onQueryChange: (value: string) => void;
  onSearch: (value: string) => void;
  query: string;
}) {
  const { t } = useI18n();
  return (
    <Popover
      trigger={
        <Button aria-label={label} className="relative" size="icon">
          <MagnifyingGlass />
          {applied ? <span aria-hidden className="absolute right-2.5 top-2.5 size-2 rounded-full bg-contrast" /> : null}
        </Button>
      }
    >
      <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); onSearch(query.trim()); }}>
        <Input aria-label={label} autoFocus className="h-11" onChange={(event) => onQueryChange(event.target.value)} placeholder={label} value={query} />
        <div className="flex justify-end gap-2">
          <Button disabled={!query && !applied} onClick={() => { onQueryChange(""); onSearch(""); }} size="sm" variant="ghost">{t("ui.common.clearSearch")}</Button>
          <Button size="sm" type="submit" variant="primary">{t("ui.common.search")}</Button>
        </div>
      </form>
    </Popover>
  );
}

/** The order of a feed, as a round button that opens the choices. */
export function SortControl<Value extends string>({ onChange, options, value }: {
  onChange: (value: Value) => void;
  options: readonly SelectOption<Value>[];
  value: Value;
}) {
  const { t } = useI18n();
  return (
    <Tooltip label={t("ui.common.sort")}>
      <span className="inline-flex">
        <Select
          className="grid size-11 place-items-center rounded-full bg-surface-raised text-ink transition-[background-color] duration-[var(--motion-control)] ease-[var(--ease-move)] hover:bg-surface-pressed focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          label={t("ui.common.sort")}
          onChange={onChange}
          options={options}
          renderTrigger={() => <SortAscending aria-hidden className="size-[1.125rem]" />}
          value={value}
        />
      </span>
    </Tooltip>
  );
}
