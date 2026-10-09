"use client";

import Link from "next/link";
import { Fab, Icon } from "framework7-react";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";

/** Native iOS FAB with Next navigation, including intercepted compose routes. */
export function FabLink({ href, label, disabled = false }: { href: string; label: string; disabled?: boolean }) {
  const { resolvedTheme } = useTheme();
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (!ready) return null;
  return createPortal(
    <Fab className="novae-fab" color={resolvedTheme === "dark" ? "white" : "black"}>
      <Link slot="root" href={href} aria-label={label} aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined} className={disabled ? "disabled" : undefined} onClick={disabled ? (event) => event.preventDefault() : undefined} prefetch={false}>
        <Icon f7="plus" aria-hidden="true" />
      </Link>
    </Fab>,
    document.body,
  );
}
