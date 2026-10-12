"use client";

import { MagnifyingGlass, X } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { Button } from "@/ui/button";
import { Input } from "@/ui/field";

/** One search field and its button; the clear control appears once there is something to clear. */
export function SearchForm({ disabled = false, label, loading = false, maxLength, onQueryChange, onReset, onSearch, query, submitDisabled = false }: {
  disabled?: boolean;
  label: string;
  loading?: boolean;
  maxLength?: number;
  onQueryChange: (query: string) => void;
  /** Clears the search and shows everything again. */
  onReset?: () => void;
  onSearch: () => void;
  query: string;
  submitDisabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled && !loading && !submitDisabled) onSearch();
      }}
    >
      <div className="relative min-w-0 flex-1">
        <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
        <Input
          aria-label={label}
          className="h-11 pl-11 pr-12"
          disabled={disabled}
          maxLength={maxLength}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={label}
          value={query}
        />
        {query && onReset ? (
          <Button
            aria-label={t("admin.resetSearch")}
            className="absolute right-1 top-1/2 -translate-y-1/2"
            disabled={loading || disabled}
            onClick={onReset}
            size="icon-sm"
            variant="ghost"
          >
            <X weight="bold" />
          </Button>
        ) : null}
      </div>
      <Button disabled={disabled || submitDisabled} status={loading ? "loading" : "idle"} type="submit" variant="secondary">
        {t("ui.common.search")}
      </Button>
    </form>
  );
}
