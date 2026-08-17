import postcss from "postcss";

const cssClassSelectorPattern =
  /\.(-?(?:\\.|[A-Za-z_])(?:\\.|[A-Za-z0-9_-])*)/gu;

function unescapeCssIdentifier(identifier) {
  return identifier.replace(/\\(.)/gu, "$1");
}

function sourceContainsClass(source, className) {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(
    `(?<![A-Za-z0-9_-])${escaped}(?![A-Za-z0-9_-])`,
    "u",
  ).test(source);
}

export function collectCssClassSelectors(stylesheets) {
  const definitions = new Map();

  for (const { path, source } of stylesheets) {
    const root = postcss.parse(source, { from: path });
    root.walkRules((rule) => {
      if (rule.parent?.type === "atrule" && /keyframes$/u.test(rule.parent.name)) {
        return;
      }
      for (const match of rule.selector.matchAll(cssClassSelectorPattern)) {
        const className = unescapeCssIdentifier(match[1]);
        const locations = definitions.get(className) ?? [];
        locations.push(`${path}:${rule.source?.start?.line ?? 1}`);
        definitions.set(className, locations);
      }
    });
  }

  return definitions;
}

export function findOrphanCssClassSelectors(stylesheets, productSources) {
  const productSource = productSources.join("\n");
  return [...collectCssClassSelectors(stylesheets)]
    .filter(([className]) => !sourceContainsClass(productSource, className))
    .map(([className, locations]) => ({ className, locations }))
    .sort((left, right) => left.className.localeCompare(right.className));
}
