import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DURATIONS = ['touch', 'control', 'nav', 'sheet', 'controlExit', 'sheetExit'];
const EASINGS = ['arrive', 'depart', 'move', 'nav', 'navReversed', 'bounce'];
const TRAVEL = ['lift', 'rise', 'pressScale', 'cardPressScale', 'surfaceScale', 'navParallax', 'navDim'];
const LOOPS = ['spin', 'sweep', 'pulse'];

function assertMilliseconds(value, name) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0)
    throw new Error(`${name} 必須是正整數毫秒。`);
  return value;
}

function assertCubicBezier(value, name) {
  if (!Array.isArray(value) || value.length !== 4 || value.some((point) => typeof point !== 'number'))
    throw new Error(`${name} 必須是四個數字的 cubic-bezier 控制點。`);
  if (value[0] < 0 || value[0] > 1 || value[2] < 0 || value[2] > 1)
    throw new Error(`${name} 的 x 控制點必須落在 0 與 1 之間。`);
  return value;
}

function assertCssValue(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${name} 必須是非空的 CSS 值。`);
  return value;
}

function assertExactKeys(record, expected, name) {
  const actual = Object.keys(record ?? {});
  const missing = expected.filter((key) => !actual.includes(key));
  const extra = actual.filter((key) => !expected.includes(key));
  if (missing.length) throw new Error(`${name} 缺少 ${missing.join('、')}。`);
  if (extra.length) throw new Error(`${name} 多出 ${extra.join('、')}；階梯之外不得新增名稱。`);
  return record;
}

async function readMotionConfig() {
  const raw = JSON.parse(
    await readFile(path.join(projectRoot, 'config', 'motion.config.json'), 'utf8'),
  );
  assertExactKeys(raw.durations, DURATIONS, 'durations');
  assertExactKeys(raw.easings, EASINGS, 'easings');
  assertExactKeys(raw.travel, TRAVEL, 'travel');
  assertExactKeys(raw.loops, LOOPS, 'loops');

  for (const name of DURATIONS) assertMilliseconds(raw.durations[name], `durations.${name}`);
  for (const name of LOOPS) assertMilliseconds(raw.loops[name], `loops.${name}`);
  for (const name of EASINGS) assertCubicBezier(raw.easings[name], `easings.${name}`);
  for (const name of TRAVEL) assertCssValue(raw.travel[name], `travel.${name}`);

  if (raw.durations.controlExit >= raw.durations.control)
    throw new Error('durations.controlExit 必須短於 control：離場不得拖住接替它的東西。');
  if (raw.durations.sheetExit >= raw.durations.sheet)
    throw new Error('durations.sheetExit 必須短於 sheet：離場不得拖住接替它的東西。');

  return raw;
}

function kebab(name) {
  return name.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);
}

function bezier(points) {
  return `cubic-bezier(${points.join(', ')})`;
}

function seconds(milliseconds) {
  return Number((milliseconds / 1_000).toFixed(3));
}

function renderStylesheet(config) {
  const lines = [
    '/* Generated from config/motion.config.json by scripts/generate-motion.mjs.',
    '   Do not edit: change the config and run `bun run generate:all`. */',
    ':root {',
    '  /* How long. A touch is acknowledged in a tenth of a second, a control',
    '     settles in a quarter, navigation has a longer deceleration, and a layer',
    '     presented over the current place takes longest because it travels',
    '     furthest. Leaving is always quicker than arriving. */',
  ];
  for (const name of DURATIONS)
    lines.push(`  --motion-${kebab(name)}: ${config.durations[name]}ms;`);
  lines.push(
    '',
    '  /* Arrivals decelerate, dismissals accelerate, travel between two known',
    '     positions is symmetric, routes use the iOS navigation curve, and exactly',
    '     one curve is allowed to overshoot. A recipe played in reverse reverses',
    '     its easing too, so the navigation curve is also published mirrored. */',
  );
  for (const name of EASINGS)
    lines.push(`  --ease-${kebab(name)}: ${bezier(config.easings[name])};`);
  lines.push('', '  /* How far. Everything that rises, rises by the same amount. */');
  for (const name of TRAVEL) lines.push(`  --motion-${kebab(name)}: ${config.travel[name]};`);
  lines.push('', '  /* Indeterminate loops. They repeat, so they sit outside the ladder. */');
  for (const name of LOOPS) lines.push(`  --motion-${kebab(name)}: ${config.loops[name]}ms;`);
  lines.push('}', '');
  return lines.join('\n');
}

function renderModule(config) {
  const durationEntries = DURATIONS.map(
    (name) => `  ${name}: ${seconds(config.durations[name])},`,
  ).join('\n');
  const loopEntries = LOOPS.map(
    (name) => `  ${name}: ${seconds(config.loops[name])},`,
  ).join('\n');
  const easingEntries = EASINGS.map(
    (name) => `  ${name}: [${config.easings[name].join(', ')}],`,
  ).join('\n');
  return `// Generated from config/motion.config.json by scripts/generate-motion.mjs.
// Do not edit: change the config and run \`bun run generate:all\`.

/** Rungs of the duration ladder, in seconds, for animations driven from JavaScript. */
export const motionSeconds = {
${durationEntries}
} as const;

/** The sanctioned easing curves as cubic-bezier control points. */
export const motionEasing = {
${easingEntries}
} as const;

/** Indeterminate loops, in seconds. They repeat, so they sit outside the ladder. */
export const motionLoopSeconds = {
${loopEntries}
} as const;

export type MotionRung = keyof typeof motionSeconds;
export type MotionCurve = keyof typeof motionEasing;
export type MotionLoop = keyof typeof motionLoopSeconds;
`;
}

const config = await readMotionConfig();
await mkdir(path.join(projectRoot, 'src', 'generated'), { recursive: true });
await writeFile(
  path.join(projectRoot, 'src', 'generated', 'motion-ladder.css'),
  renderStylesheet(config),
  'utf8',
);
await writeFile(
  path.join(projectRoot, 'src', 'generated', 'motion-tokens.ts'),
  renderModule(config),
  'utf8',
);
console.log('Generated motion ladder for CSS and JavaScript.');
