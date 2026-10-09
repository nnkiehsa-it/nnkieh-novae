"use client";

import { SkeletonBlock } from "framework7-react";
import type { ComponentProps, ComponentType } from "react";

// The library runtime defaults these props; its published types mark them required.
const NativeSkeleton = SkeletonBlock as ComponentType<Partial<ComponentProps<typeof SkeletonBlock>>>;

export function Skeleton(props: React.ComponentProps<"div">) {
  return <NativeSkeleton {...props} effect="fade" data-slot="skeleton" />;
}
