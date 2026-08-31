"use client";

import { useEffect, type ReactNode } from "react";
import {
  AnimatedToastStack,
  type ToastPosition,
  type ToastStatus,
  useAnimatedToastStack,
} from "@/components/motion/animated-toast-stack";

type ToastEvent = { status: ToastStatus; title: ReactNode };
const listeners = new Set<(event: ToastEvent) => void>();

function emit(status: ToastStatus, title: ReactNode) {
  listeners.forEach((listener) => listener({ status, title }));
}

const toast = {
  error: (title: ReactNode) => emit("error", title),
  info: (title: ReactNode) => emit("info", title),
  success: (title: ReactNode) => emit("success", title),
  warning: (title: ReactNode) => emit("info", title),
};

function Toaster({ position = "bottom-center" }: { position?: ToastPosition }) {
  const { toasts, showToast, dismissToast } = useAnimatedToastStack({
    defaultDuration: 4200,
    limit: 5,
  });

  useEffect(() => {
    const listener = (event: ToastEvent) => showToast(event);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [showToast]);

  return (
    <AnimatedToastStack
      toasts={toasts}
      onDismiss={dismissToast}
      position={position}
      placement="fixed"
      maxVisible={4}
    />
  );
}

export { toast, Toaster };
