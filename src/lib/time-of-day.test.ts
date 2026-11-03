import assert from "node:assert/strict";
import { test } from "node:test";
import { nightnessAt, overrideFromSearch, resolveNightness } from "./time-of-day";

const at = (h: number, m = 0) => new Date(2026, 10, 3, h, m);

test("day, night and the ramps between", () => {
  assert.equal(nightnessAt(at(12)), 0);
  assert.equal(nightnessAt(at(23)), 1);
  assert.equal(nightnessAt(at(3)), 1);
  const dusk = nightnessAt(at(19));
  assert.ok(dusk > 0 && dusk < 1, `dusk should be mid-ramp, got ${dusk}`);
  assert.ok(nightnessAt(at(19, 30)) > dusk, "darkens through dusk");
  assert.ok(nightnessAt(at(6, 30)) < nightnessAt(at(6)), "brightens through dawn");
});

test("overrides", () => {
  assert.equal(resolveNightness("day", at(23)), 0);
  assert.equal(resolveNightness("night", at(12)), 1);
  assert.equal(overrideFromSearch("?time=night"), "night");
  assert.equal(overrideFromSearch("?time=lunch"), null);
});
