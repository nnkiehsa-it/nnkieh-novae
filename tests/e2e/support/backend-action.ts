import { expect, type Page, type Response } from '@playwright/test';
import { BACKEND_ACTION_POLICIES, type BackendActionName } from '../../../src/services/backend-action-contract';

const operationIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

/**
 * A correlation id travels with a write, and only with a write -- a read is not
 * an operation anybody follows through the log -- so this is what the product
 * sends rather than what every request happens to carry.
 */
function expectAnswered(response: Response, action: BackendActionName) {
  expect(response.status(), `${action} response`).toBe(200);
  const group = BACKEND_ACTION_POLICIES[action].group;
  if (group === 'read' || group === 'upload-resolve') return;
  expect(response.request().headers()['x-novae-operation-id']).toMatch(operationIdPattern);
}

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

interface ActionAnswer {
  data: Record<string, unknown>;
  operationId: string;
}

/** An action answer, read back from the newline-delimited stream it arrives in. */
export function readActionStream(text: string): ActionAnswer {
  const lines = text.split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line) as Record<string, unknown>);
  expect(lines.at(0)?.type, `answer did not start: ${text}`).toBe('start');
  expect(lines.at(-1)?.type, `answer did not finish: ${text}`).toBe('end');
  let data: Record<string, unknown> = {};
  for (const line of lines) {
    if (line.type !== 'part') continue;
    data = line.key === undefined
      ? line.data as Record<string, unknown>
      : { ...data, [line.key as string]: line.data };
  }
  return { data, operationId: String(lines[0].operationId) };
}

/** The same answer written back out, for a test that replaces what it carried. */
export function actionStreamBody(answer: ActionAnswer) {
  return [
    JSON.stringify({ operationId: answer.operationId, policyRevision: 0, type: 'start' }),
    JSON.stringify({ data: answer.data, type: 'part' }),
    JSON.stringify({ type: 'end' }),
  ].join('\n');
}

export async function expectBackendAction(
  page: Page,
  action: BackendActionName,
  run: () => Promise<unknown>,
) {
  const responsePromise = page.waitForResponse((response) => matchesAction(response, action));
  await run();
  const response = await responsePromise;
  expectAnswered(response, action);
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
    expectAnswered(response, action);
  }
}
