"use client";
import type { ComponentProps } from "react";
import { TextField } from "./text-field";
export function Input(props: ComponentProps<"input">) {
  return <TextField {...props} />;
}
