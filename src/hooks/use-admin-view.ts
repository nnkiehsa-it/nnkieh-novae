import { useSearchAddress } from "@/hooks/use-search-address";

/** Shareable admin views, restored by reload and browser Back/Forward. */
export function useAdminView<T extends string>(options: readonly T[], key = "view") {
  const [params, write] = useSearchAddress();
  const requested = params.get(key);
  const value = options.find((option) => option === requested) ?? options[0];
  const change = (next: string) => {
    if (!options.includes(next as T) || next === value) return;
    const url = new URL(window.location.href);
    if (next === options[0]) url.searchParams.delete(key);
    else url.searchParams.set(key, next);
    write(`${url.pathname}${url.search}${url.hash}`);
  };
  return [value, change] as const;
}
