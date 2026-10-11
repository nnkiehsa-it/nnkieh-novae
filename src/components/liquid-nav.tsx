"use client";

import { useEffect, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Icon, Link, List, ListItem, Toolbar, ToolbarPane } from "framework7-react";
import { useI18n } from "@/i18n";
import { useFramework7ListControl } from "./ui/use-framework7-control";

export interface LiquidNavItem {
  activePathPrefix?: string;
  badge?: ReactNode;
  href: string;
  icon: string;
  iconActive?: string;
  label: string;
}

function Destination({
  item,
  active,
  index,
  vertical,
}: {
  item: LiquidNavItem;
  active: boolean;
  index: number;
  vertical: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    router.prefetch(item.href);
  }, [item.href, router]);
  const onClick = (event: React.MouseEvent) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    startTransition(() => router.push(item.href));
  };
  const icon = (
    <Icon aria-hidden="true" f7={active ? (item.iconActive ?? item.icon) : item.icon}>
      {item.badge}
    </Icon>
  );
  const attributes = {
    "aria-current": active ? ("page" as const) : undefined,
    "data-liquid-nav-index": index,
    "data-active": active,
  };
  if (vertical)
    return (
      <DesktopDestination
        {...attributes}
        link={item.href}
        selected={active}
        onClick={onClick}
        title={item.label}
      >
        <span slot="media">{icon}</span>
        <span slot="after" aria-busy={pending} />
      </DesktopDestination>
    );
  return (
    <Link
      {...attributes}
      href={item.href}
      tabLink
      tabLinkActive={active}
      onClick={onClick}
    >
      {icon}
      <span className="tabbar-label" aria-busy={pending}>
        {item.label}
      </span>
    </Link>
  );
}

function DesktopDestination({ children, "aria-current": current, title, ...props }: React.ComponentProps<typeof ListItem> & { title: string; "aria-current"?: "page" }) {
  const id = useFramework7ListControl({ "aria-current": current, "aria-label": title });
  return <ListItem {...props} title={title} id={id}>{children}</ListItem>;
}

export function LiquidNav({
  className,
  items,
  pathname,
  vertical = false,
}: {
  className?: string;
  items: LiquidNavItem[];
  pathname: string;
  vertical?: boolean;
}) {
  const { t } = useI18n();
  const links = items.map((item, index) => {
    const prefix = item.activePathPrefix ?? item.href;
    return (
      <Destination
        key={item.href}
        item={item}
        index={index}
        vertical={vertical}
        active={
          pathname === item.href ||
          pathname === prefix ||
          pathname.startsWith(`${prefix}/`)
        }
      />
    );
  });
  return (
    <nav
      aria-label={t("ui.nav.primary")}
      data-primary-navigation
      className={className}
    >
      {vertical ? (
        <List menuList noChevron className="m-0">
          <ul>{links}</ul>
        </List>
      ) : (
        <Toolbar tabbar icons position="bottom">
          <ToolbarPane>{links}</ToolbarPane>
        </Toolbar>
      )}
    </nav>
  );
}
