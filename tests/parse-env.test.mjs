import test from "node:test";
import assert from "node:assert/strict";
import { parseEnvList, parseEnvInt } from "../lib/utils/parse-env.mjs";

test("parseEnvList parses a JSON array", () => {
  assert.deepEqual(parseEnvList('[".md",".txt"]'), [".md", ".txt"]);
});

test("parseEnvList falls back to CSV", () => {
  assert.deepEqual(parseEnvList(".md,.txt", []), [".md", ".txt"]);
});

test("parseEnvList returns fallback when empty", () => {
  assert.deepEqual(parseEnvList("", ["x"]), ["x"]);
});

test("parseEnvInt parses positive integers", () => {
  assert.equal(parseEnvInt("1600", 0), 1600);
});

test("parseEnvInt falls back on invalid or non-positive input", () => {
  assert.equal(parseEnvInt("abc", 42), 42);
  assert.equal(parseEnvInt("0", 42), 42);
  assert.equal(parseEnvInt("-5", 42), 42);
  assert.equal(parseEnvInt(undefined, 42), 42);
});
