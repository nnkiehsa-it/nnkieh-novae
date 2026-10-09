"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Framework7 from "framework7/lite";
import Framework7React, { App, f7, f7ready } from "framework7-react";
import type { View } from "framework7/types";
import Dialog from "framework7/components/dialog";
import Actions from "framework7/components/actions";
import Sheet from "framework7/components/sheet";
import Popup from "framework7/components/popup";
import Popover from "framework7/components/popover";
import Toast from "framework7/components/toast";
import Tooltip from "framework7/components/tooltip";
import Input from "framework7/components/input";
import Toggle from "framework7/components/toggle";
import Messagebar from "framework7/components/messagebar";
import Progressbar from "framework7/components/progressbar";
import SmartSelect from "framework7/components/smart-select";
import PhotoBrowser from "framework7/components/photo-browser";
import Swiper from "framework7/components/swiper";
import Accordion from "framework7/components/accordion";
import Searchbar from "framework7/components/searchbar";
import { NativeModalLayers } from "./ui/native-modal-layers";
import { useTheme } from "next-themes";

// Framework7 installs plugins here; this API is not a React hook.
// eslint-disable-next-line react-hooks/rules-of-hooks
Framework7.use([
  Framework7React,
  Dialog,
  Actions,
  Sheet,
  Popup,
  Popover,
  Toast,
  Tooltip,
  Input,
  Toggle,
  Messagebar,
  Progressbar,
  SmartSelect,
  PhotoBrowser,
  Swiper,
  Accordion,
  Searchbar,
]);

function ThemeSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    f7ready(() => f7.setDarkMode(resolvedTheme === "dark"));
  }, [resolvedTheme]);
  return null;
}

function NextView({ children }: { children: ReactNode }) {
  const element = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let disposed = false;
    let view: View.View | undefined;
    f7ready((app) => {
      if (!disposed) {
        view = app.views.create(element.current!, {
          main: true,
          router: false,
        });
        setReady(true);
      }
    });
    return () => {
      disposed = true;
      view?.destroy();
    };
  }, []);
  // F7 React View passes React children into its deep-cloned router parameters.
  // Keep the Next tree outside those parameters, including React dev owners.
  return (
    <div className="view view-main novae-view" ref={element}>
      {ready ? children : <div className="app-start-surface">Novae</div>}
    </div>
  );
}

export function Framework7Provider({ children }: { children: ReactNode }) {
  return (
    <App
      name="Novae"
      theme="ios"
      className="novae-root"
      colors={{ primary: "#007aff" }}
      // Preserve Next/browser navigation while native hash controls reach F7.
      clicks={{ externalLinks: ".external,a[href]:not([href^='#'])" }}
      actions={{ closeOnEscape: true }}
      sheet={{ closeOnEscape: true }}
      popup={{ closeOnEscape: true }}
      popover={{ closeOnEscape: true }}
    >
      <ThemeSync />
      <NativeModalLayers />
      <NextView>{children}</NextView>
    </App>
  );
}
