import type { CSSProperties, ReactNode } from "react";

type ViewTransitionStyle = CSSProperties & {
  viewTransitionClass: string;
};

export function ContentMorph({
  children,
  id,
  kind,
}: {
  children: ReactNode;
  id: string;
  kind: "announcement" | "facility" | "issue";
}) {
  const style: ViewTransitionStyle = {
    viewTransitionClass: "novae-object-morph",
    viewTransitionName: `novae-${kind}-${id}`,
  };

  return (
    <div className="h-full" style={style}>
      {children}
    </div>
  );
}
