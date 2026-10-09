"use client";

import * as React from "react";
import { Slot } from "@/components/ui/slot";

export interface ModalRootProps {
  children?: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCloseRequest?: (close: () => void) => void;
}
export interface ModalState {
  open: boolean;
  titleId: string;
  descriptionId: string;
  target: React.RefObject<HTMLElement | null>;
  setTarget: (element: HTMLElement) => void;
  setOpen: (open: boolean) => void;
  requestClose: () => void;
  closed: () => void;
}
export const ModalContext = React.createContext<ModalState | null>(null);
export function useModal() {
  const state = React.useContext(ModalContext);
  if (!state) throw new Error("Modal content requires a modal root");
  return state;
}
export function ModalRoot({
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  onCloseRequest,
}: ModalRootProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const [closing, setClosing] = React.useState(false);
  const target = React.useRef<HTMLElement>(null);
  const id = React.useId();
  const sourceOpen = open ?? internalOpen;
  const setOpen = (next: boolean) => {
    setClosing(false);
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const requestClose = () => {
    const close = () => setClosing(true);
    if (onCloseRequest) onCloseRequest(close);
    else close();
  };
  return (
    <ModalContext.Provider
      value={{
        open: sourceOpen && !closing,
        target,
        setTarget: (element) => {
          target.current = element;
        },
        titleId: `${id}-title`,
        descriptionId: `${id}-description`,
        setOpen,
        requestClose,
        closed: () => {
          if (sourceOpen) setOpen(false);
        },
      }}
    >
      {children}
    </ModalContext.Provider>
  );
}
export function ModalTrigger({
  asChild,
  onClick,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const state = useModal();
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      {...props}
      aria-haspopup="dialog"
      aria-expanded={state.open}
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          state.setTarget(event.currentTarget);
          state.setOpen(true);
        }
      }}
    />
  );
}
