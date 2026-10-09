"use client";

import Link from "next/link";
import { ModalSurface } from "./modal-surface";
import { useModal } from "./modal-context";
import type { ActionMenuItem } from "./action-menu";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

export function ActionSheet({
  description,
  items,
  title,
}: {
  description?: string;
  items: readonly ActionMenuItem[];
  title: string;
}) {
  const state = useModal();
  const { t } = useI18n();
  const groups = [
    items.filter((item) => item.tone !== "destructive"),
    items.filter((item) => item.tone === "destructive"),
  ];
  return (
    <ModalSurface kind="actions">
      <div className="actions-group">
        <div className="actions-label">
          <h2 id={state.titleId} className="font-semibold">
            {title}
          </h2>
          {description ? <p id={state.descriptionId}>{description}</p> : null}
        </div>
        {groups[0].map(renderItem)}
      </div>
      {groups[1].length ? (
        <div className="actions-group">{groups[1].map(renderItem)}</div>
      ) : null}
      <div className="actions-group">
        <button
          type="button"
          className="actions-button actions-button-strong w-full"
          onClick={state.requestClose}
        >
          <span className="actions-button-text">{t("common.cancel")}</span>
        </button>
      </div>
    </ModalSurface>
  );

  function renderItem(item: ActionMenuItem) {
    const content = (
      <>
        <span className="actions-button-media">
          <item.icon className="size-5" />
        </span>
        <span className="actions-button-text">{item.label}</span>
      </>
    );
    const className = cn(
      "actions-button w-full",
      item.tone === "destructive" && "color-red",
    );
    return item.href ? (
      <Link
        className={className}
        href={item.href}
        key={item.key}
        onClick={state.requestClose}
      >
        {content}
      </Link>
    ) : (
      <button
        className={className}
        key={item.key}
        type="button"
        onClick={() => {
          state.requestClose();
          item.onSelect?.();
        }}
      >
        {content}
      </button>
    );
  }
}
