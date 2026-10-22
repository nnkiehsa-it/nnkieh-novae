import { readdir, readFile, stat } from "node:fs/promises";
import { relative } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { parse } from "@babel/parser";

const root = new URL("../../", import.meta.url);
const rootPath = fileURLToPath(root);

export const read = async (path) => readFile(new URL(path, root), "utf8");

export function repoPath(file) {
  return relative(rootPath, fileURLToPath(file)).replaceAll("\\", "/");
}

export function moduleImports(source, path = "source.ts") {
  const sourceFile = parse(source, {
    plugins: ["typescript", ...(path.endsWith(".tsx") ? ["jsx"] : [])],
    sourceType: "unambiguous",
  });
  const imports = [];
  for (const node of sourceFile.program.body) {
    if (
      (node.type === "ImportDeclaration" ||
        node.type === "ExportNamedDeclaration" ||
        node.type === "ExportAllDeclaration") &&
      node.source
    ) {
      imports.push({
        specifier: node.source.value,
        typeOnly: node.importKind === "type" || node.exportKind === "type",
      });
    }
  }
  // `import("…")` counts too: lazy routes and on-demand chunks are imports.
  const visit = (node) => {
    if (!node || typeof node.type !== "string") return;
    if (node.type === "ImportExpression" && node.source?.type === "StringLiteral") {
      imports.push({ dynamic: true, specifier: node.source.value, typeOnly: false });
    } else if (node.type === "CallExpression" && node.callee.type === "Import" && node.arguments[0]?.type === "StringLiteral") {
      imports.push({ dynamic: true, specifier: node.arguments[0].value, typeOnly: false });
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === "loc" || key === "leadingComments" || key === "trailingComments") continue;
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
    }
  };
  visit(sourceFile.program);
  return imports;
}

export async function listFiles(relativeDir, files = []) {
  const dir = new URL(relativeDir, root);
  for (const entry of await readdir(dir)) {
    if ((["node_modules", "dist", ".vercel", ".wrangler", ".git"].includes(entry) || entry.startsWith("dist-"))) continue;
    const child = new URL(`${relativeDir.replace(/\/?$/u, "/")}${entry}`, root);
    const childStat = await stat(child);
    if (childStat.isDirectory()) {
      await listFiles(`${relativeDir.replace(/\/?$/u, "/")}${entry}`, files);
    } else {
      files.push(child);
    }
  }
  return files;
}
