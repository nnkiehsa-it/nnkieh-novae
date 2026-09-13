export interface DraftChange {
  after: unknown;
  before: unknown;
  key: string;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function same(left: unknown, right: unknown) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right))
    return left.length === right.length && left.every((entry, index) => Object.is(entry, right[index]));
  return false;
}

/**
 * What a draft would change, field by field, so the reader can be shown the
 * decision they are about to make rather than a bare "save" button.
 *
 * Settings shapes in this product are a flat record or a record of flat records
 * (`{ imageUploads, retention }`), so one level of nesting is the whole domain;
 * a nested field is named `group.field`. Keys come out in a stable order so the
 * review list does not reshuffle itself between renders.
 */
export function diffDraft<T>(before: T, after: T): DraftChange[] {
  if (!isPlainRecord(before) || !isPlainRecord(after)) {
    return same(before, after) ? [] : [{ after, before, key: "" }];
  }
  const changes: DraftChange[] = [];
  for (const key of Object.keys(after).toSorted()) {
    const left = before[key];
    const right = after[key];
    if (isPlainRecord(left) && isPlainRecord(right)) {
      for (const nested of Object.keys(right).toSorted()) {
        if (!same(left[nested], right[nested]))
          changes.push({ after: right[nested], before: left[nested], key: `${key}.${nested}` });
      }
      continue;
    }
    if (!same(left, right)) changes.push({ after: right, before: left, key });
  }
  return changes;
}
