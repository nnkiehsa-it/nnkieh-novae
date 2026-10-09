"use client";

import { useEffect, type ReactNode } from "react";
import Framework7 from "framework7";
import Framework7React, { App, View, f7, f7ready } from "framework7-react";
import Dialog from "framework7/components/dialog";
import Sheet from "framework7/components/sheet";
import Popover from "framework7/components/popover";
import Toast from "framework7/components/toast";
import Tooltip from "framework7/components/tooltip";
import Input from "framework7/components/input";
import Toggle from "framework7/components/toggle";
import Card from "framework7/components/card";
import { useTheme } from "next-themes";

// Framework7 installs plugins here; this API is not a React hook.
// eslint-disable-next-line react-hooks/rules-of-hooks
Framework7.use([Framework7React, Dialog, Sheet, Popover, Toast, Tooltip, Input, Toggle, Card]);

function ThemeSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    f7ready(() => f7.setDarkMode(resolvedTheme === "dark"));
  }, [resolvedTheme]);
  return null;
}

export function Framework7Provider({ children }: { children: ReactNode }) {
  return (
    <App
      name="Novae"
      theme="ios"
      className="novae-root"
      colors={{ primary: "#007aff" }}
      clicks={{ externalLinks: "a" }}
      touch={{ activeState: false, touchRipple: false, touchHighlight: false }}
      input={{ scrollIntoViewOnFocus: false }}
    >
      <ThemeSync />
      <View className="novae-view" main router={false}>{children}</View>
    </App>
  );
}
