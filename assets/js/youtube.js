import { CATEGORIES } from "./site-config.js";

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
]);
const SHORT_HOSTS = new Set(["youtu.be", "www.youtu.be"]);

/** Return a YouTube ID, or null for an unsupported or malformed URL. */
export function parseYouTubeId(input) {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (VIDEO_ID.test(value)) return value;

  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port
  )
    return null;

  let id;
  if (SHORT_HOSTS.has(url.hostname)) {
    id = url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
  } else if (YOUTUBE_HOSTS.has(url.hostname)) {
    if (
      url.pathname === "/watch" &&
      url.searchParams.getAll("v").length === 1
    ) {
      id = url.searchParams.get("v");
    } else {
      id = url.pathname.match(
        /^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})\/?$/,
      )?.[1];
    }
  }
  return typeof id === "string" && VIDEO_ID.test(id) ? id : null;
}

/** Validate the entire catalog before displaying or replacing it. */
export function normalizeVideos(data) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    !Array.isArray(data.videos)
  ) {
    throw new Error("The lesson catalog must contain a videos array.");
  }
  const ids = new Set();
  return data.videos.map((record, index) => {
    const invalid = () =>
      new Error(`Lesson ${index + 1} has invalid or missing information.`);
    if (!record || typeof record !== "object" || Array.isArray(record))
      throw invalid();
    if (typeof record.id !== "string" || !VIDEO_ID.test(record.id))
      throw invalid();
    if (ids.has(record.id))
      throw new Error("The lesson catalog contains duplicate videos.");
    if (
      typeof record.title !== "string" ||
      !record.title.trim() ||
      record.title.trim().length > 140
    )
      throw invalid();
    if (
      record.description !== undefined &&
      (typeof record.description !== "string" ||
        record.description.length > 2000)
    )
      throw invalid();
    if (!CATEGORIES.includes(record.category)) throw invalid();
    if (
      typeof record.addedAt !== "string" ||
      !Number.isFinite(Date.parse(record.addedAt))
    )
      throw invalid();
    if (new Date(record.addedAt).toISOString() !== record.addedAt)
      throw invalid();
    ids.add(record.id);
    return {
      id: record.id,
      title: record.title.trim(),
      description: (record.description ?? "").trim(),
      category: record.category,
      addedAt: record.addedAt,
    };
  });
}
