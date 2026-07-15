import test from "node:test";
import assert from "node:assert/strict";
import { shouldIgnorePath } from "../lib/files.mjs";

test("shouldIgnorePath flags ignored directories", () => {
  assert.equal(shouldIgnorePath("/proj/node_modules/pkg"), true);
  assert.equal(shouldIgnorePath("/proj/.git/HEAD"), true);
  assert.equal(shouldIgnorePath("/proj/dist/bundle.js"), true);
  assert.equal(shouldIgnorePath("/proj/.zvec/knowledge.db"), true);
});

test("shouldIgnorePath leaves normal paths alone", () => {
  assert.equal(shouldIgnorePath("/proj/src/app.ts"), false);
  assert.equal(shouldIgnorePath("/proj/summaries/notes.md"), false);
  assert.equal(shouldIgnorePath("/proj"), false);
});
