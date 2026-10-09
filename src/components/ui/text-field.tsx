"use client";

import { Input as Framework7Input } from "framework7-react";
import type { ComponentProps, Ref } from "react";
import { useFramework7Control } from "./use-framework7-control";

type TextFieldProps = (Omit<ComponentProps<"input">, "ref"> | Omit<ComponentProps<"textarea">, "ref">) & {
  multiline?: boolean;
  type?: ComponentProps<"input">["type"];
  rows?: number;
  ref?: Ref<HTMLInputElement | HTMLTextAreaElement>;
};

/** Map React's form API onto the actual Framework7 Input component. */
export function TextField({
  multiline,
  ref,
  id,
  type = "text",
  inputMode,
  autoFocus,
  maxLength,
  minLength,
  readOnly,
  autoComplete,
  tabIndex,
  rows,
  ...props
}: TextFieldProps) {
  const attributes = Object.fromEntries(
    Object.entries(props).filter(
      ([name]) =>
        name.startsWith("aria-") || name.startsWith("data-") || name === "role",
    ),
  );
  const f7Ref = useFramework7Control(ref, multiline ? "textarea" : "input", {
    ...attributes,
    rows,
    "data-slot": multiline ? "textarea" : "input",
  });
  return (
    <Framework7Input
      {...(props as ComponentProps<typeof Framework7Input>)}
      type={multiline ? "textarea" : type}
      outline
      inputId={id}
      inputmode={inputMode}
      autofocus={autoFocus}
      maxlength={maxLength}
      minlength={minLength}
      readonly={readOnly}
      autocomplete={autoComplete}
      tabindex={tabIndex}
      ref={f7Ref}
    />
  );
}
