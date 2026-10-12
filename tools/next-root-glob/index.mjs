import { globSync as nodeGlobSync, statSync } from "node:fs";

// Scoped to Next's root-directory lookup, its sole fast-glob call. This is
// deliberately not a general fast-glob replacement. Node 24 owns the parser.
export function globSync(pattern, { onlyDirectories }) {
  return nodeGlobSync(pattern)
    .filter((name) => !onlyDirectories || statSync(name).isDirectory())
    .map((name) => name.replaceAll("\\", "/"));
}
