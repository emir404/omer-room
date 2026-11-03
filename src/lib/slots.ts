/**
 * Content → baked slots. The room has a fixed number of book spines / photo frames (they're part
 * of the baked lighting), and content decides what's drawn on them. Content can re-skin a slot but
 * never resize or remove it; extra items overflow into the panel list instead of failing the build.
 */
export interface Slottable {
  /** Lower comes first. */
  order: number;
  /** Optional 1-based slot to pin this item to. */
  slot?: number;
}

export interface SlotAssignment<T> {
  /** One entry per slot (index 0 = slot 1); null = empty slot (render a generic spine/frame). */
  assigned: (T | null)[];
  /** Items that didn't fit, in order. */
  overflow: T[];
  /** 0-based indices of empty slots. */
  empty: number[];
}

export function assignSlots<T extends Slottable>(items: readonly T[], slotCount: number): SlotAssignment<T> {
  const assigned: (T | null)[] = Array.from({ length: slotCount }, () => null);
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const floating: T[] = [];

  for (const item of sorted) {
    const index = item.slot !== undefined ? item.slot - 1 : -1;
    if (index >= 0 && index < slotCount && assigned[index] === null) {
      assigned[index] = item;
    } else {
      floating.push(item);
    }
  }

  const overflow: T[] = [];
  let cursor = 0;
  for (const item of floating) {
    while (cursor < slotCount && assigned[cursor] !== null) cursor++;
    if (cursor < slotCount) assigned[cursor] = item;
    else overflow.push(item);
  }

  const empty = assigned.flatMap((item, i) => (item === null ? [i] : []));
  return { assigned, overflow, empty };
}
