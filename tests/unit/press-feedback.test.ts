import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializePressFeedback } from '@/lib/press-feedback';

function dispatchPointer(
  target: Element,
  type: string,
  overrides: Partial<Record<'button' | 'clientX' | 'clientY' | 'isPrimary' | 'pointerId' | 'pointerType', unknown>> = {},
) {
  const event = new Event(type, { bubbles: true });
  const values = {
    button: 0,
    clientX: 10,
    clientY: 10,
    isPrimary: true,
    pointerId: 1,
    pointerType: 'touch',
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(event, key, { value });
  }
  target.dispatchEvent(event);
}

describe('press feedback', () => {
  beforeAll(() => initializePressFeedback());

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<button id="first">First</button><button id="second">Second</button>';
  });

  afterEach(() => {
    window.dispatchEvent(new Event('blur'));
    vi.runAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it('keeps release feedback briefly, then removes it', () => {
    const button = document.querySelector('#first')!;
    dispatchPointer(button, 'pointerdown');
    expect(button.classList.contains('is-pressing')).toBe(true);

    dispatchPointer(button, 'pointerup');
    vi.advanceTimersByTime(159);
    expect(button.classList.contains('is-pressing')).toBe(true);

    vi.advanceTimersByTime(1);
    expect(button.classList.contains('is-pressing')).toBe(false);
  });

  it('clears a press immediately when scrolling or pointer delivery is interrupted', () => {
    const button = document.querySelector('#first')!;
    dispatchPointer(button, 'pointerdown');
    dispatchPointer(button, 'pointermove', { clientX: 23 });
    expect(button.classList.contains('is-pressing')).toBe(false);

    dispatchPointer(button, 'pointerdown', { pointerId: 2 });
    dispatchPointer(button, 'lostpointercapture', { pointerId: 2 });
    expect(button.classList.contains('is-pressing')).toBe(false);
  });

  it('cleans stale state on a new touch and browser lifecycle changes', () => {
    const first = document.querySelector('#first')!;
    const second = document.querySelector('#second')!;
    first.classList.add('is-pressing');

    dispatchPointer(second, 'pointerdown');
    expect(first.classList.contains('is-pressing')).toBe(false);
    expect(second.classList.contains('is-pressing')).toBe(true);

    window.dispatchEvent(new Event('blur'));
    expect(second.classList.contains('is-pressing')).toBe(false);

    dispatchPointer(first, 'pointerdown', { pointerId: 3 });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(first.classList.contains('is-pressing')).toBe(false);
  });
});
