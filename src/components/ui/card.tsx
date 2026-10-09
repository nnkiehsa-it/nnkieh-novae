"use client";

import type { ComponentProps } from "react";
import {
  Card as F7Card,
  CardHeader as F7CardHeader,
  CardContent as F7CardContent,
  CardFooter as F7CardFooter,
} from "framework7-react";
import { useFramework7Control } from "./use-framework7-control";
import { cn } from "@/lib/utils";

type DivProps = ComponentProps<"div">;
export function getCardClassName(className?: string) {
  return cn("m-0 flex flex-col", className);
}
export function Card({ className, ref, ...props }: DivProps) {
  const f7Ref = useFramework7Control(ref, undefined, {});
  return (
    <F7Card
      {...props}
      ref={f7Ref as NonNullable<ComponentProps<typeof F7Card>["ref"]>}
      data-slot="card"
      className={getCardClassName(className)}
    />
  );
}
export function CardHeader({ ref, ...props }: DivProps) {
  const f7Ref = useFramework7Control(ref, undefined, {});
  return <F7CardHeader data-slot="card-header" {...props} ref={f7Ref} />;
}
export function CardContent({ ref, ...props }: DivProps) {
  const f7Ref = useFramework7Control(ref, undefined, {});
  return (
    <F7CardContent data-slot="card-content" {...props} ref={f7Ref} padding />
  );
}
export function CardFooter({ ref, ...props }: DivProps) {
  const f7Ref = useFramework7Control(ref, undefined, {});
  return <F7CardFooter data-slot="card-footer" {...props} ref={f7Ref} />;
}
export function CardTitle(props: DivProps) {
  return <div {...props} data-slot="card-title" />;
}
export function CardDescription(props: DivProps) {
  return (
    <div
      {...props}
      data-slot="card-description"
      className={cn("text-color-gray", props.className)}
    />
  );
}
export function CardAction(props: DivProps) {
  return <div {...props} data-slot="card-action" />;
}
