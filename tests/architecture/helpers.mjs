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
  return imports;
}

export function callStringArguments(source, callNames, path = "source.ts") {
  const sourceFile = parse(source, {
    plugins: ["typescript", ...(path.endsWith(".tsx") ? ["jsx"] : [])],
    sourceType: "unambiguous",
  });
  const values = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (
      node.type === "CallExpression" &&
      node.callee?.type === "Identifier" &&
      callNames.includes(node.callee.name) &&
      node.arguments[0]?.type === "StringLiteral"
    ) {
      values.push(node.arguments[0].value);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else visit(value);
    }
  };
  visit(sourceFile);
  return values;
}

export async function listFiles(relativeDir, files = []) {
  const dir = new URL(relativeDir, root);
  for (const entry of await readdir(dir)) {
    if (["node_modules", "dist", ".next", ".next-verify", ".vercel", ".wrangler", ".git"].includes(entry)) continue;
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
