"use client";
import type { ComponentProps, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ActionsGroup, ActionsLabel, ActionsButton } from "framework7-react";
import { ModalSurface } from "./modal-surface";
import { useModal } from "./modal-context";
import { useFramework7Control } from "./use-framework7-control";
import type { ActionMenuItem } from "./action-menu";
import { useI18n } from "@/i18n";

function Action({
  children,
  ...props
}: ComponentProps<typeof ActionsButton> & { children: ReactNode }) {
  const ref = useFramework7Control<HTMLElement>(undefined, undefined, {
    role: "button",
    tabindex: 0,
  });
  return (
    <ActionsButton {...props} close={false} ref={ref}>
      {children}
    </ActionsButton>
  );
}
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
  const router = useRouter();
  const { t } = useI18n();
  const groups = [
    items.filter((item) => item.tone !== "destructive"),
    items.filter((item) => item.tone === "destructive"),
  ];
  const render = (item: ActionMenuItem) => (
    <Action
      color={item.tone === "destructive" ? "red" : undefined}
      key={item.key}
      onClick={() => {
        state.requestClose();
        if (item.href) router.push(item.href);
        else item.onSelect?.();
      }}
    >
      <item.icon slot="media" className="size-5" />
      {item.label}
    </Action>
  );
  return (
    <ModalSurface kind="actions">
      <ActionsGroup>
        <ActionsLabel>
          <h2 id={state.titleId}>{title}</h2>
          {description ? <p id={state.descriptionId}>{description}</p> : null}
        </ActionsLabel>
        {groups[0].map(render)}
      </ActionsGroup>
      {groups[1].length ? (
        <ActionsGroup>{groups[1].map(render)}</ActionsGroup>
      ) : null}
      <ActionsGroup>
        <Action strong onClick={state.requestClose}>
          {t("common.cancel")}
        </Action>
      </ActionsGroup>
    </ModalSurface>
  );
}
