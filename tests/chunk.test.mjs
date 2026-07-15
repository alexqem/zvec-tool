import test from "node:test";
import assert from "node:assert/strict";
import { chunkText } from "../lib/chunk.mjs";

test("short text returns a single chunk", () => {
  assert.deepEqual(chunkText("hello", 10, 0), ["hello"]);
  assert.deepEqual(chunkText("", 10, 0), [""]);
});

test("text longer than size splits without overlap", () => {
  const text = "0123456789".repeat(3); // 30 chars
  const chunks = chunkText(text, 10, 0);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0], "0123456789");
  assert.equal(chunks[2], "0123456789");
});

test("overlap makes chunks share a tail/head", () => {
  const chunks = chunkText("0123456789AB", 10, 4);
  assert.equal(chunks[0], "0123456789");
  assert.equal(chunks[1], "6789AB");
});
