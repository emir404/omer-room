import assert from "node:assert/strict";
import { test } from "node:test";
import { assignSlots } from "./slots";

const book = (key: string, order: number, slot?: number) => ({ key, order, ...(slot !== undefined ? { slot } : {}) });

test("fills slots in order", () => {
  const { assigned, overflow, empty } = assignSlots([book("b", 2), book("a", 1)], 3);
  assert.deepEqual(assigned.map((b) => b?.key ?? null), ["a", "b", null]);
  assert.deepEqual(overflow, []);
  assert.deepEqual(empty, [2]);
});

test("respects pinned slots and flows the rest around them", () => {
  const { assigned } = assignSlots([book("a", 1), book("pinned", 9, 1), book("b", 2)], 3);
  assert.deepEqual(assigned.map((b) => b?.key ?? null), ["pinned", "a", "b"]);
});

test("pins outside the shelf fall back to flowing", () => {
  const { assigned } = assignSlots([book("far", 1, 40)], 2);
  assert.deepEqual(assigned.map((b) => b?.key ?? null), ["far", null]);
});

test("overflow never throws and keeps order", () => {
  const { assigned, overflow } = assignSlots([book("a", 1), book("b", 2), book("c", 3)], 2);
  assert.equal(assigned.length, 2);
  assert.deepEqual(overflow.map((b) => b.key), ["c"]);
});
