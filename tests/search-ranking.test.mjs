import test from "node:test";
import assert from "node:assert/strict";
import { rankSearchResults } from "../lib/search.mjs";

test("rankSearchResults sorts by score descending", () => {
  const results = [
    { fields: { file_path: "/a.md", text_content: "low" }, score: 0.1 },
    { fields: { file_path: "/b.md", text_content: "high" }, score: 0.9 },
    { fields: { file_path: "/c.md", text_content: "mid" }, score: 0.5 },
  ];
  const ranked = rankSearchResults("query", results);
  assert.deepEqual(
    ranked.map((r) => r.filePath),
    ["/b.md", "/c.md", "/a.md"]
  );
});

test("rankSearchResults drops items missing path or text", () => {
  const results = [
    { fields: { text_content: "no path" }, score: 0.9 },
    { fields: { file_path: "/x.md" }, score: 0.8 },
    { fields: { file_path: "/y.md", text_content: "ok" }, score: 0.7 },
  ];
  const ranked = rankSearchResults("query", results);
  assert.deepEqual(ranked.map((r) => r.filePath), ["/y.md"]);
});

test("rankSearchResults honours excludePaths", () => {
  const results = [
    { fields: { file_path: "/keep.md", text_content: "a" }, score: 0.9 },
    { fields: { file_path: "/drop.md", text_content: "b" }, score: 0.8 },
  ];
  const ranked = rankSearchResults("query", results, ["/drop.md"]);
  assert.deepEqual(ranked.map((r) => r.filePath), ["/keep.md"]);
});
