import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeVideos, parseYouTubeId } from "../assets/js/youtube.js";

const lessonUrl = "https://www.youtube.com/watch?v=y0K4DWL0WkE";

test("the published catalog includes Tan's first lesson with valid metadata", async () => {
  const source = JSON.parse(
    await readFile(new URL("../data/videos.json", import.meta.url), "utf8"),
  );
  const videos = normalizeVideos(source);
  const lesson = videos.find(({ id }) => id === parseYouTubeId(lessonUrl));

  assert.ok(lesson, "The first lesson must be present in the catalog");
  assert.equal(lesson.title, "Classical conditioning basics");
  assert.equal(lesson.category, "Educational theories");
  assert.ok(lesson.description.trim());
});

test("the lesson remains reachable without JavaScript", async () => {
  const html = await readFile(
    new URL("../lessons/index.html", import.meta.url),
    "utf8",
  );
  const fallback = html.match(/<noscript\b[^>]*>([\s\S]*?)<\/noscript\s*>/i)?.[1];

  assert.ok(fallback, "The lesson page must offer a no-JavaScript fallback");
  assert.ok(fallback.includes(`href="${lessonUrl}"`));
  assert.match(fallback, /Classical conditioning basics on YouTube/);
});
