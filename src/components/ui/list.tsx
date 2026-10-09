"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ChevronRight, type LucideIcon } from "lucide-react";
import { BlockFooter, BlockTitle, List, ListItem } from "framework7-react";
import { Button } from "./button";
import { LoadingSpinner } from "./loading-spinner";
import { useFramework7ListControl } from "./use-framework7-control";
import { cn } from "@/lib/utils";

export interface RowContent {
  icon?: LucideIcon;
  media?: ReactNode;
  label: ReactNode;
  detail?: ReactNode;
  value?: ReactNode;
  tone?: "default" | "destructive" | "brand";
}
const toneClass = {
  default: "",
  destructive: "text-color-red",
  brand: "text-color-blue",
};
export function ListSection({
  children,
  className,
  groupName,
  header,
  headerAction,
  footer,
}: {
  children: ReactNode;
  className?: string;
  groupName?: string;
  header?: ReactNode;
  headerAction?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section
      className={className}
      aria-label={groupName}
      role={groupName ? "group" : undefined}
    >
      {header || headerAction ? (
        <div className="flex items-center justify-between">
          <BlockTitle className="mt-0">
            <h2>{header}</h2>
          </BlockTitle>
          {headerAction}
        </div>
      ) : null}
      <List inset strong dividers className="m-0">
        <ul>{children}</ul>
      </List>
      {footer ? <BlockFooter>{footer}</BlockFooter> : null}
    </section>
  );
}
export function listItemSlots(
  { icon: Icon, media, label, detail, value, tone = "default" }: RowContent,
  trailing?: ReactNode,
) {
  return [
    media || Icon ? <span key="media" slot="media">{media ?? (Icon ? <Icon className="size-6" /> : null)}</span> : null,
    <span key="title" slot="title" className={toneClass[tone]}>
      {label}
    </span>,
    detail ? (
      <span key="text" slot="text">
        {detail}
      </span>
    ) : null,
    value || trailing ? (
      <span key="after" slot="after" className="flex items-center gap-2">
        {value}
        {trailing}
      </span>
    ) : null,
  ];
}
export function ListRow({
  className,
  ...content
}: RowContent & { className?: string }) {
  return (
    <ListItem className={className} mediaItem={Boolean(content.detail)}>
      {listItemSlots(content)}
    </ListItem>
  );
}
export function ListNavRow({
  disabled,
  className,
  selected,
  external,
  href,
  onClick,
  ...content
}: RowContent & {
  disabled?: boolean;
  className?: string;
  selected?: boolean;
  external?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const router = useRouter();
  const id = useFramework7ListControl({
    role: href ? undefined : "button",
    "aria-label": typeof content.label === "string" ? content.label : undefined,
    "aria-disabled": disabled,
  });
  return (
    <ListItem
      link={href ?? "#"}
      className={className}
      selected={selected}
      external={external}
      target={external ? "_blank" : undefined}
      disabled={disabled}
      mediaItem={Boolean(content.detail)}
      id={id}
      onClick={(event: React.MouseEvent) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick?.();
        if (
          external ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        if (href) router.push(href);
      }}
    >
      {listItemSlots(
        content,
        external ? <ArrowUpRight className="size-4" /> : undefined,
      )}
    </ListItem>
  );
}
export function ListActionRow({
  busy,
  disabled,
  onClick,
  type = "button",
  ...content
}: RowContent & {
  busy?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  const id = useFramework7ListControl({
    role: "button",
    "aria-label": typeof content.label === "string" ? content.label : undefined,
    "aria-busy": busy,
    "aria-disabled": disabled || busy,
  });
  return (
    <ListItem
      link="#"
      noChevron
      disabled={disabled || busy}
      mediaItem={Boolean(content.detail)}
      id={id}
      onClick={(event: React.MouseEvent) => {
        event.preventDefault();
        if (!disabled && !busy) {
          if (type === "submit")
            (
              event.currentTarget.closest("form") as HTMLFormElement
            ).requestSubmit();
          else onClick?.();
        }
      }}
    >
      {listItemSlots(content, busy ? <LoadingSpinner /> : null)}
    </ListItem>
  );
}
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
  label: string;
  onClick: () => void;
  tone?: RowContent["tone"];
}) {
  return (
    <Button
      aria-busy={busy}
      aria-label={label}
      className={toneClass[tone]}
      disabled={disabled || busy}
      onClick={onClick}
      size="icon"
      title={label}
      variant="ghost"
    >
      {busy ? <LoadingSpinner /> : <Icon />}
    </Button>
  );
}

export function ListMutationRow({
  action,
  onOpen,
  openLabel,
  ...content
}: RowContent & {
  action: ReactNode;
  onOpen?: () => void;
  openLabel?: string;
}) {
  return (
    <ListItem noChevron mediaItem={Boolean(content.detail)}>
      {listItemSlots(content)}
      <div slot="inner-end" className="flex items-center gap-2">
        {onOpen ? (
          <Button
            aria-label={openLabel}
            onClick={onOpen}
            size="icon"
            variant="ghost"
          >
            <ChevronRight />
          </Button>
        ) : null}
        {action}
      </div>
    </ListItem>
  );
}
export function ListCustomRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ListItem>
      <div slot="inner" className={cn("w-full", className)}>
        {children}
      </div>
    </ListItem>
  );
}
export function ListRowGroup({
  children,
  show,
}: {
  children: ReactNode;
  show: boolean;
}) {
  return show ? children : null;
}
