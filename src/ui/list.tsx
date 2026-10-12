import * as React from "react";
import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

/** Rows that belong together, on one panel, split by hairlines. */
export function ListGroup({ children, className, label }: {
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <section aria-label={label} className={cn("glass overflow-hidden rounded-panel shadow-panel", className)}>
      <ul className="divide-y divide-line">{children}</ul>
    </section>
  );
}

interface ListRowContent {
  /** A second line under the label. */
  detail?: React.ReactNode;
  icon?: React.ReactNode;
  label: React.ReactNode;
  tone?: "default" | "danger";
  /** What the row is currently set to, read at the trailing edge. */
  value?: React.ReactNode;
}

type ListRowProps = ListRowContent &
  (
    | { href: string; external?: boolean; onClick?: never; trailing?: never; disabled?: never }
    | { href?: never; external?: never; onClick: () => void; trailing?: never; disabled?: boolean }
    | { href?: never; external?: never; onClick?: never; trailing?: React.ReactNode; disabled?: never }
  );

const rowClass =
  "flex min-h-15 w-full items-center gap-4 px-5 py-3 text-left outline-none";
const actionClass =
  "transition-[background-color] duration-[var(--motion-control)] ease-[var(--ease-move)] hover:bg-surface-raised active:bg-surface-pressed focus-visible:bg-surface-raised disabled:pointer-events-none disabled:opacity-40";

function RowBody({ detail, icon, label, tone = "default", value }: ListRowContent) {
  return (
    <>
      {icon ? (
        <span aria-hidden className={cn("shrink-0 [&_svg]:size-[1.375rem]", tone === "danger" ? "text-danger" : "text-ink")}>
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-base", tone === "danger" ? "text-danger" : "text-ink")}>{label}</span>
        {detail ? <span className="block truncate text-sm text-ink-muted">{detail}</span> : null}
      </span>
      {value !== undefined ? <span className="max-w-[45%] shrink-0 truncate text-sm text-ink-muted">{value}</span> : null}
    </>
  );
}

/** One row: a link, an action, or a label with its own trailing control. */
export function ListRow(props: ListRowProps) {
  const chevron = <CaretRight aria-hidden className="size-4 shrink-0 text-ink-faint" weight="bold" />;
  if (props.href !== undefined) {
    return (
      <li>
        <Link
          className={cn(rowClass, actionClass)}
          href={props.href}
          {...(props.external ? { rel: "noreferrer", target: "_blank" } : {})}
        >
          <RowBody {...props} />
          {chevron}
        </Link>
      </li>
    );
  }
  if (props.onClick) {
    return (
      <li>
        <button className={cn(rowClass, actionClass)} disabled={props.disabled} onClick={props.onClick} type="button">
          <RowBody {...props} />
          {props.tone === "danger" ? null : chevron}
        </button>
      </li>
    );
  }
  return (
    <li className={rowClass}>
      <RowBody {...props} />
      {props.trailing}
    </li>
  );
}
