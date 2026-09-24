import test from "node:test";
import assert from "node:assert/strict";
import { parseYouTubeId, normalizeVideos } from "../assets/js/youtube.js";

const id = "dQw4w9WgXcQ";
const record = {
  id,
  title: "Research foundations",
  description: "A clear starting point.",
  category: "Research methods",
  addedAt: "2026-09-24T12:00:00.000Z",
};

test("extracts IDs from supported YouTube formats and tracking links", () => {
  for (const input of [
    id,
    ` https://www.youtube.com/watch?v=${id}&t=42 `,
    `http://youtube.com/watch?v=${id}`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}?si=abc`,
    `https://www.youtu.be/${id}/`,
    ...["shorts", "embed", "live"].map(
      (format) => `https://youtube.com/${format}/${id}`,
    ),
  ]) {
    assert.equal(parseYouTubeId(input), id, input);
  }
});

test("rejects spoofed hosts, unsafe schemes, ambiguous URLs and malformed IDs", () => {
  for (const input of [
    null,
    {},
    "",
    "123",
    `${id}x`,
    `javascript:alert(1)`,
    `ftp://youtube.com/watch?v=${id}`,
    `https://youtube.com.evil.test/watch?v=${id}`,
    `https://evilyoutube.com/watch?v=${id}`,
    `https://youtube.com@evil.test/watch?v=${id}`,
    `https://user@youtube.com/watch?v=${id}`,
    `https://youtube.com:444/watch?v=${id}`,
    `https://youtu.be/${id}/extra`,
    `https://youtube.com/watch?v=${id}&v=${id}`,
    "https://youtube.com/playlist?list=abc",
    `https://youtube.com/watch?v=%3Cscript%3E`,
    `https://youtube.com/shorts/too-short`,
  ]) {
    assert.equal(parseYouTubeId(input), null, String(input));
  }
});

test("normalizes a complete catalog without mutating its input", () => {
  const source = {
    videos: [
      { ...record, title: "  Research foundations  ", description: undefined },
    ],
  };
  assert.deepEqual(normalizeVideos(source), [{ ...record, description: "" }]);
  assert.equal(source.videos[0].title, "  Research foundations  ");
  assert.deepEqual(normalizeVideos({ videos: [] }), []);
});

test("rejects the entire catalog when a record is malformed or duplicated", () => {
  for (const source of [
    null,
    [],
    {},
    { videos: {} },
    { videos: [null] },
    { videos: [record, record] },
    ...[
      { id: "../bad" },
      { title: "  " },
      { title: "x".repeat(141) },
      { description: 12 },
      { description: "x".repeat(2001) },
      { category: "Unknown" },
      { addedAt: "2026-02-31T12:00:00.000Z" },
      { addedAt: "yesterday" },
    ].map((change) => ({ videos: [{ ...record, ...change }] })),
  ]) {
    assert.throws(() => normalizeVideos(source));
  }
});
