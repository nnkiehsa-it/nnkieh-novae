import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  motionEasing,
  motionLoopSeconds,
  motionSeconds,
} from "@/generated/motion-tokens";

const ladder = readFileSync(
  path.join(process.cwd(), "src/generated/motion-ladder.css"),
  "utf8",
);

// The ladder is generated, so its shape is known: two spaces, the token, a
// colon and the value up to the semicolon.
function ladderValue(token: string) {
  const prefix = `  ${token}: `;
  const start = ladder.indexOf(prefix);
  return ladder.slice(start + prefix.length, ladder.indexOf(";", start));
}

function cssMilliseconds(token: string) {
  return Number(ladderValue(token).slice(0, -"ms".length));
}

function cssBezier(token: string) {
  return ladderValue(token)
    .slice("cubic-bezier(".length, -1)
    .split(",")
    .map((point) => Number(point.trim()));
}

const cssRungNames: Record<keyof typeof motionSeconds, string> = {
  touch: "--motion-touch",
  control: "--motion-control",
  nav: "--motion-nav",
  sheet: "--motion-sheet",
  controlExit: "--motion-control-exit",
  sheetExit: "--motion-sheet-exit",
};

const cssCurveNames: Record<keyof typeof motionEasing, string> = {
  arrive: "--ease-arrive",
  depart: "--ease-depart",
  move: "--ease-move",
  nav: "--ease-nav",
  navReversed: "--ease-nav-reversed",
  bounce: "--ease-bounce",
};

describe("motion ladder", () => {
  it("gives the stylesheet and JavaScript the same rungs", () => {
    for (const [rung, cssName] of Object.entries(cssRungNames)) {
      expect(cssMilliseconds(cssName)).toBe(
        Math.round(motionSeconds[rung as keyof typeof motionSeconds] * 1_000),
      );
    }
    expect(cssMilliseconds("--motion-sweep")).toBe(
      Math.round(motionLoopSeconds.sweep * 1_000),
    );
  });

  it("gives the stylesheet and JavaScript the same curves", () => {
    for (const [curve, cssName] of Object.entries(cssCurveNames)) {
      expect(cssBezier(cssName)).toEqual(
        motionEasing[curve as keyof typeof motionEasing],
      );
    }
  });

  // Playing a recipe in reverse reverses its easing too, so the reversed
  // navigation curve has to be the point reflection of the forward one or a pop
  // spends its first half barely moving while a push is already arriving.
  it("publishes the navigation curve mirrored so reversed recipes keep its pace", () => {
    const [x1, y1, x2, y2] = motionEasing.nav;
    const mirrored = [1 - x2, 1 - y2, 1 - x1, 1 - y1];
    motionEasing.navReversed.forEach((point, index) => {
      expect(point).toBeCloseTo(mirrored[index], 6);
    });
  });

  it("dismisses faster than it presents", () => {
    expect(motionSeconds.controlExit).toBeLessThan(motionSeconds.control);
    expect(motionSeconds.sheetExit).toBeLessThan(motionSeconds.sheet);
    expect(motionSeconds.touch).toBeLessThan(motionSeconds.control);
    expect(motionSeconds.control).toBeLessThan(motionSeconds.nav);
    expect(motionSeconds.nav).toBeLessThan(motionSeconds.sheet);
  });
});
