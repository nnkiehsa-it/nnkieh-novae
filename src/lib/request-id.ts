export function createRequestId() {
  return crypto.randomUUID().replaceAll('-', '_');
}
