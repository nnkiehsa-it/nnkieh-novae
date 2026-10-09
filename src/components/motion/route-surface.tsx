"use client";

import { useState, type ReactNode } from "react";
import { Page, PageContent } from "framework7-react";
import { NativePageHeaderHost } from "@/components/ui/native-page-context";

import { useSurfaceRoute } from "@/hooks/use-surface-route";
import { cn } from "@/lib/utils";

/**
 * The surface every route is painted on.
 *
 * Only the page that arrives animates, and it animates in the live document.
 * Capturing the document instead — a view transition — buys the page being left
 * a parallax, and costs a full rasterisation of both pages at the moment the
 * browser is already fetching, rendering and hydrating the route that was asked
 * for. It also suspends hit testing for the length of the animation, which is
 * what used to swallow a tap on the dock.
 *
 * What it is keyed by is the surface rather than the address: a record opened
 * over the list it is in changes the address without changing the page
 * underneath, and keying on the address would throw that list away -- its
 * scroll, its loaded pages and all -- behind the sheet showing the record.
 */
export function RouteSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { direction, surface } = useSurfaceRoute();
  const [headerHost, setHeaderHost] = useState<HTMLElement | null>(null);

  return (
    // The first page of a session has no direction and no entrance: it arrived
    // with the document, and animating it would make the app look like it was
    // still assembling itself.
    <Page pageContent={false}
      key={surface}
      className="route-page novae-page"
      data-route-direction={direction ?? undefined}
      data-route-path={surface}
    >
      <div className="native-navbar-host" ref={setHeaderHost} />
      <PageContent className={cn("novae-page-content", className)}>
        <NativePageHeaderHost.Provider value={headerHost}><div className="native-page-body">{children}</div></NativePageHeaderHost.Provider>
      </PageContent>
    </Page>
  );
}
