import assert from "node:assert/strict";
import { test } from "node:test";
import { chapterHref, objectHref, parentPath, parsePath } from "./routes";

test("parses chapters and items", () => {
  assert.deepEqual(parsePath("/"), { focus: "room", chapter: null, item: null });
  assert.deepEqual(parsePath("/shelf"), { focus: "shelf", chapter: "shelf", item: null });
  assert.deepEqual(parsePath("/computer/arc-studio/"), { focus: "computer", chapter: "computer", item: "arc-studio" });
  assert.deepEqual(parsePath("/map"), { focus: "room", chapter: null, item: null });
  assert.deepEqual(parsePath("/globe/kozan?time=night"), { focus: "globe", chapter: "globe", item: "kozan" });
});

test("closing goes item → chapter → room", () => {
  assert.equal(parentPath("/shelf/mundp"), "/shelf");
  assert.equal(parentPath("/shelf"), "/");
  assert.equal(parentPath("/"), "/");
});

test("hrefs", () => {
  assert.equal(chapterHref("phone", "copilot"), "/phone/copilot");
  assert.equal(objectHref("letter"), "/letter");
  assert.equal(objectHref("hoop"), null);
});
