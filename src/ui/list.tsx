import * as React from "react";
import { AppLink } from "./app-link";
import { CaretRight } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

/**
 * Rows that belong together, on one panel, split by hairlines. A title names
 * the group above it; a footer explains it underneath.
 */
export function ListGroup({ action, children, className, footer, label, role, title }: {
  /** One trailing control on the title line, such as a refresh. */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
  /** Names the group for assistive technology when it has no visible title. */
  label?: string;
  /** `radiogroup` when the rows are ChoiceRows. */
  role?: "radiogroup";
  title?: React.ReactNode;
}) {
  const titleId = React.useId();
  return (
    <section aria-label={title ? undefined : label} aria-labelledby={title ? titleId : undefined} className={cn("grid gap-2", className)}>
      {title || action ? (
        <div className="flex min-h-8 items-center justify-between gap-3 px-1">
          {title ? <h2 className="text-[0.8125rem] font-medium text-ink-muted" id={titleId}>{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      <ul className="glass divide-y divide-line overflow-hidden rounded-panel shadow-panel" role={role}>{children}</ul>
      {footer ? <p className="px-1 text-sm leading-relaxed text-ink-faint">{footer}</p> : null}
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
    | { href: string; external?: boolean; onClick?: () => void; trailing?: never; disabled?: never }
    | { href?: never; external?: never; onClick: () => void; trailing?: never; disabled?: boolean }
    | { href?: never; external?: never; onClick?: never; trailing?: React.ReactNode; disabled?: never }
  );

export const rowClass =
  "flex min-h-12 w-full items-center gap-3.5 px-4 py-2.5 text-left outline-none";
const actionClass =
  "transition-[background-color] duration-[var(--motion-control)] ease-[var(--ease-move)] hover:bg-surface-raised active:bg-surface-pressed focus-visible:bg-surface-raised disabled:pointer-events-none disabled:opacity-40";

function RowBody({ detail, icon, label, tone = "default", value }: ListRowContent) {
  return (
    <>
      {icon ? (
        <span aria-hidden className={cn("shrink-0 [&_svg]:size-5", tone === "danger" ? "text-danger" : "text-ink")}>
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-base", tone === "danger" ? "text-danger" : "text-ink")}>{label}</span>
        {detail ? <span className="block truncate text-[0.8125rem] text-ink-muted">{detail}</span> : null}
      </span>
      {value !== undefined ? <span className="max-w-[45%] shrink-0 truncate text-[0.9375rem] text-ink-muted">{value}</span> : null}
    </>
  );
}

/** One row: a link, an action, or a label with its own trailing control. */
export function ListRow(props: ListRowProps) {
  const chevron = <CaretRight aria-hidden className="size-4 shrink-0 text-ink-faint" weight="bold" />;
  if (props.href !== undefined) {
    return (
      <li>
        <AppLink
          className={cn(rowClass, actionClass)}
          href={props.href}
          onClick={props.onClick}
          {...(props.external ? { rel: "noreferrer", target: "_blank" } : {})}
        >
          <RowBody {...props} />
          {chevron}
        </AppLink>
      </li>
    );
  }
  if (props.onClick !== undefined) {
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
