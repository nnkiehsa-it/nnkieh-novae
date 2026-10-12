"use client";

import type * as React from "react";
import Link from "next/link";
import { navigate } from "@/lib/app-navigation";

type AppLinkProps = Omit<React.ComponentProps<typeof Link>, "href" | "prefetch"> & { href: string };

/**
 * A link that changes screens in place when it stays inside the app, and
 * otherwise behaves as an ordinary link. Modified clicks still open a tab.
 */
export function AppLink({ href, onClick, replace, target, ...props }: AppLinkProps) {
  return (
    <Link
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || target || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (navigate(href, { replace })) event.preventDefault();
      }}
      prefetch={false}
      replace={replace}
      target={target}
    />
  );
}
