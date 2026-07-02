interface ViewportPageSizeOptions {
  max: number;
  min: number;
  reservedHeight: number;
  rowHeight: number;
}

export function resolveViewportPageSize(options: ViewportPageSizeOptions) {
  if (typeof window === 'undefined') return options.min;

  const availableHeight = Math.max(window.innerHeight - options.reservedHeight, options.rowHeight);
  const visibleRows = Math.ceil(availableHeight / options.rowHeight);
  return Math.min(options.max, Math.max(options.min, visibleRows + 2));
}

export async function waitForMinimumDuration(startedAt: number, minimumMs: number) {
  const remainingMs = minimumMs - (Date.now() - startedAt);
  if (remainingMs <= 0) return;
  await new Promise((resolve) => window.setTimeout(resolve, remainingMs));
}
