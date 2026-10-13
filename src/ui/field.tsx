import * as React from "react";
import { cn } from "@/lib/utils";

const controlClass =
  "w-full rounded-tile border border-line bg-surface-raised px-4 text-base text-ink outline-none placeholder:text-ink-faint transition-[border-color,background-color] duration-[var(--motion-control)] ease-[var(--ease-move)] focus:border-[var(--focus-ring)] focus:bg-surface-pressed disabled:opacity-40 aria-invalid:border-danger";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(controlClass, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(controlClass, "min-h-32 resize-y py-3 leading-relaxed", className)} {...props} />;
}

/** A label, the control it names, and either a hint or the error that replaces it. */
export function Field({ children, error, hint, label }: {
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode;
  error?: string;
  hint?: string;
  label: string;
}) {
  const id = React.useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  return (
    <div className="grid gap-2">
      <label className="px-1 text-sm font-medium text-ink-muted" htmlFor={id}>{label}</label>
      {children({ id, describedBy: message ? messageId : undefined, invalid: Boolean(error) })}
      {message ? (
        <p className={cn("px-1 text-sm", error ? "text-danger" : "text-ink-faint")} id={messageId} role={error ? "alert" : undefined}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
