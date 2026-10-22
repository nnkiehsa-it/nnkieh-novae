import type * as React from "react";
import { navigate } from "@/lib/app-navigation";

type AppLinkProps = Omit<React.ComponentProps<"a">, "href"> & { href: string; replace?: boolean };

/**
 * A link that changes screens in place when it stays on this origin, and
 * otherwise behaves as an ordinary link. Modified clicks still open a tab.
 */
export function AppLink({ href, onClick, replace, target, ...props }: AppLinkProps) {
  return (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || target || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (navigate(href, { replace })) event.preventDefault();
      }}
      target={target}
    />
  );
}
