export function raceWithAbort<T>(
  signal: AbortSignal,
  operation: () => Promise<T>,
  getAbortReason: () => unknown,
) {
  if (signal.aborted) return Promise.reject<T>(getAbortReason());

  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", handleAbort);
    const handleAbort = () => {
      cleanup();
      reject(getAbortReason());
    };

    signal.addEventListener("abort", handleAbort, { once: true });
    void Promise.resolve()
      .then(operation)
      .then(
        (value) => {
          cleanup();
          resolve(value);
        },
        (error: unknown) => {
          cleanup();
          reject(error);
        },
      );
  });
}
