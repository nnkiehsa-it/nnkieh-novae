import { beforeEach, describe, expect, it, vi } from "vitest";

import { readCachedAvatar, writeCachedAvatar } from "@/lib/avatar-cache";

const UID = "user-1";
const SOURCE = "https://lh3.googleusercontent.com/a/photo";
const DELIVERED = "https://api.example.test/v1/media/payload.signature/avatar";

describe("cached avatar", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("answers the same account and source without asking again", () => {
    writeCachedAvatar(UID, SOURCE, DELIVERED);
    expect(readCachedAvatar(UID, SOURCE)).toBe(DELIVERED);
  });

  it("does not answer for another account or another source picture", () => {
    writeCachedAvatar(UID, SOURCE, DELIVERED);
    expect(readCachedAvatar("user-2", SOURCE)).toBeNull();
    expect(readCachedAvatar(UID, `${SOURCE}-changed`)).toBeNull();
  });

  it("stops answering once the worker would re-read the picture", () => {
    vi.useFakeTimers();
    writeCachedAvatar(UID, SOURCE, DELIVERED);
    vi.advanceTimersByTime(24 * 60 * 60 * 1_000 - 1);
    expect(readCachedAvatar(UID, SOURCE)).toBe(DELIVERED);
    vi.advanceTimersByTime(2);
    expect(readCachedAvatar(UID, SOURCE)).toBeNull();
  });

  it("ignores a stored value that is not a reading", () => {
    localStorage.setItem("novae:avatar", "{not json");
    expect(readCachedAvatar(UID, SOURCE)).toBeNull();
  });
});
