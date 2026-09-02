import { expect, type Page, type Response } from '@playwright/test';
import type { BackendActionName } from '../../../src/services/backend-action-contract';

function matchesAction(response: Response, action: BackendActionName) {
  if (!response.url().endsWith('/v1/actions') || response.request().method() !== 'POST') {
    return false;
  }
  try {
    return (response.request().postDataJSON() as { action?: unknown }).action === action;
  } catch {
    return false;
  }
}

export async function expectBackendAction(
  page: Page,
  action: BackendActionName,
  run: () => Promise<unknown>,
) {
  const responsePromise = page.waitForResponse((response) => matchesAction(response, action));
  await run();
  const response = await responsePromise;
  const body = await response.json() as {
    operationId?: string;
    success?: boolean;
  };
  expect(response.status(), `${action} response: ${JSON.stringify(body)}`).toBe(200);
  expect(body.success, `${action} response: ${JSON.stringify(body)}`).toBe(true);
  expect(body.operationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  return body;
}

export async function expectBackendActions(
  page: Page,
  actions: readonly BackendActionName[],
  run: () => Promise<unknown>,
) {
  const responses = actions.map((action) =>
    page.waitForResponse((response) => matchesAction(response, action))
  );
  await run();
  for (const [index, responsePromise] of responses.entries()) {
    const action = actions[index]!;
    const response = await responsePromise;
    const body = await response.json() as { operationId?: string; success?: boolean };
    expect(response.status(), `${action} response: ${JSON.stringify(body)}`).toBe(200);
    expect(body.success, `${action} response: ${JSON.stringify(body)}`).toBe(true);
    expect(body.operationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  }
}
