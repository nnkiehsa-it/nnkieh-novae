"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { timing } from "@/lib/motion-timing";
import { cn } from "@/lib/utils";

/**
 * The grouped list.
 *
 * This is the shape a phone uses for settings and for anything that reads as
 * "a label, and what it is set to". It replaces the label-above-a-box form
 * these screens used to be: a form asks you to fill something in, a list tells
 * you what things are and lets you change one.
 *
 * The card owns the gutter and the rows never add one, so every row's text
 * starts on the same line, and the whole row is the target when a row does
 * something -- never just the chevron or the word.
 */
export function ListSection({
  children,
  className,
  groupName,
  header,
  headerAction,
}: {
  children: React.ReactNode;
  className?: string;
  /**
   * Names the group as one object when the rows describe a single thing rather
   * than a related set, so it can be addressed as a whole.
   */
  groupName?: string;
  header?: React.ReactNode;
  /** One trailing control on the header line, such as a refresh action. */
  headerAction?: React.ReactNode;
}) {
  return (
    <section
      aria-label={groupName}
      className={cn("min-w-0", className)}
      role={groupName ? "group" : undefined}
    >
      {header || headerAction ? (
        <div className="mb-2 flex min-h-7 items-center justify-between gap-3 px-1">
          {header ? (
            <h2 className="text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground">
              {header}
            </h2>
          ) : null}
          {headerAction}
        </div>
      ) : null}
      <div className="rule-card rule-list">{children}</div>
    </section>
  );
}

export interface RowContent {
  /** The leading glyph, for rows that are a destination rather than a setting. */
  icon?: LucideIcon;
  label: React.ReactNode;
  /** The second line: what this row is for, in the reader's words. */
  detail?: React.ReactNode;
  /** What it is set to -- the thing the reader came to read. */
  value?: React.ReactNode;
  tone?: "default" | "destructive" | "brand";
}

const toneClass = {
  brand: "text-[var(--tint-content)]",
  default: "",
  destructive: "text-destructive",
} as const;

export function RowInner({
  detail,
  icon: Icon,
  label,
  tone = "default",
  trailing,
  value,
}: RowContent & { trailing?: React.ReactNode }) {
  return (
    <>
      {Icon ? (
        <Icon aria-hidden className="mt-px size-[1.125rem] shrink-0 text-muted-foreground" />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[0.9375rem] leading-6", toneClass[tone])}>
          {label}
        </span>
        {detail ? (
          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
            {detail}
          </span>
        ) : null}
      </span>
      {value === undefined || value === null || value === "" ? null : (
        <span className="shrink-0 text-right text-[0.9375rem] text-muted-foreground">
          {value}
        </span>
      )}
      {trailing}
    </>
  );
}

/** The metrics every row keeps, whether or not the whole of it is a target. */
const rowMetrics =
  "flex w-full min-h-[3.25rem] items-center gap-3 py-[var(--row-padding-block)] text-left";

export const rowClass = cn("t-row", rowMetrics);

/** A row that only reports: a label, and what it is set to. */
export function ListRow({
  className,
  ...content
}: RowContent & { className?: string }) {
  return (
    <div className={cn(rowClass, className)}>
      <RowInner {...content} />
    </div>
  );
}

/**
 * A row that leads somewhere. It carries a chevron because that is the only
 * honest way to say a tap here goes to another screen, and the chevron never
 * becomes the target on its own. A row that leaves the app says so with a
 * different glyph rather than with the same one.
 */
export function ListNavRow({
  disabled,
  external,
  href,
  onClick,
  ...content
}: RowContent & {
  disabled?: boolean;
  external?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <RowInner
      {...content}
      trailing={
        external ? (
          <ArrowUpRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        )
      }
    />
  );
  const className = cn(rowClass, disabled && "pointer-events-none opacity-50");
  if (href && !disabled)
    return external ? (
      <a className={className} href={href} rel="noreferrer" target="_blank">
        {inner}
      </a>
    ) : (
      <Link className={className} href={href} prefetch={false}>
        {inner}
      </Link>
    );
  return (
    <button className={className} disabled={disabled} onClick={onClick} type="button">
      {inner}
    </button>
  );
}

/** A row that does something now, rather than leading somewhere. */
export function ListActionRow({
  busy,
  disabled,
  onClick,
  tone = "default",
  type = "button",
  ...content
}: RowContent & {
  busy?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      aria-busy={busy}
      className={cn(
        rowClass,
        (disabled || busy) && "pointer-events-none",
        disabled && !busy && "opacity-50",
      )}
      disabled={disabled || busy}
      onClick={onClick}
      type={type}
    >
      <RowInner
        {...content}
        tone={tone}
        trailing={busy ? <LoadingSpinner className="shrink-0" /> : null}
      />
    </button>
  );
}

/**
 * The one control on a row that changes something.
 *
 * A row whose whole width was the target read the same as a row that only
 * reports, and the word "retry" at its end was a label rather than something to
 * aim at -- so a list of failures was a list of accidents waiting to happen.
 * Where a row reports something, what writes is this control instead: a glyph
 * with its own edge, which is the only part of the row that acts. A row that is
 * nothing but the action -- signing out -- stays a `ListActionRow`, because
 * there is no reading beside it to mistake the tap for.
 */
export function RowAction({
  busy,
  disabled,
  icon: Icon,
  label,
  onClick,
  tone = "default",
}: {
  busy?: boolean;
  disabled?: boolean;
  icon: LucideIcon;
  /** Says what the glyph does, for a reader who cannot see it or hover it. */
  label: string;
  onClick: () => void;
  tone?: "default" | "destructive" | "brand";
}) {
  return (
    <Button
      aria-busy={busy}
      aria-label={label}
      className={cn("shrink-0", toneClass[tone])}
      disabled={disabled || busy}
      onClick={onClick}
      size="icon"
      title={label}
      type="button"
      variant="outline"
    >
      {busy ? <LoadingSpinner /> : <Icon aria-hidden />}
    </Button>
  );
}

/**
 * A row that reports, and carries the control that changes it.
 *
 * The row itself may open what it is about -- the whole record, where a list
 * can only show two lines of it -- and that is the only thing tapping the row
 * does. Writing is the trailing control's alone.
 */
export function ListMutationRow({
  action,
  onOpen,
  openLabel,
  ...content
}: RowContent & {
  action: React.ReactNode;
  onOpen?: () => void;
  openLabel?: string;
}) {
  const inner = <RowInner {...content} />;
  return (
    <div className={cn(rowMetrics, "gap-2")}>
      {onOpen ? (
        <button
          aria-label={openLabel}
          className="t-row flex min-w-0 flex-1 items-center gap-3 text-left"
          data-lead="true"
          onClick={onOpen}
          type="button"
        >
          {inner}
          <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{inner}</div>
      )}
      {action}
    </div>
  );
}

/** A row the caller draws itself, keeping only the list's metrics. */
export function ListCustomRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn(rowClass, "flex-wrap", className)}>{children}</div>;
}

/**
 * Rows a decision above them brings into the list.
 *
 * A setting that reveals further settings used to swap them into the document
 * with nothing in between, so the rows under it jumped down on the way in and
 * jumped back up on the way out. They travel through their own height in both
 * directions instead, and keep the list's hairlines while they do.
 */
export function ListRowGroup({
  children,
  show,
}: {
  children: React.ReactNode;
  show: boolean;
}) {
  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div
          animate={{ height: "auto", opacity: 1 }}
          className="overflow-hidden"
          exit={{ height: 0, opacity: 0 }}
          initial={{ height: 0, opacity: 0 }}
          transition={timing("control")}
        >
          <div className="rule-list">{children}</div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
