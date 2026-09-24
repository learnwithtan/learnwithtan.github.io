import { normalizeVideos } from "./youtube.js";

export class PublishError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PublishError";
    this.code = code;
  }
}

export function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodeBase64Utf8(value) {
  const binary = atob(value.replace(/\s/g, ""));
  return new TextDecoder("utf-8", { fatal: true }).decode(
    Uint8Array.from(binary, (character) => character.charCodeAt(0)),
  );
}

function apiError(status, operation) {
  if (status === 401)
    return new PublishError(
      "authentication",
      "GitHub did not accept your token. Check that it is correct and has not expired.",
    );
  if (status === 403)
    return new PublishError(
      "permission",
      "GitHub refused access. Check that your token has Contents: read and write access to this repository, that your account may update this branch, and that you have not reached a rate limit.",
    );
  if (status === 404)
    return new PublishError(
      "not-found",
      "The repository, branch, or lesson catalog was not found. Check the site configuration and token access.",
    );
  if (status === 409)
    return new PublishError(
      "conflict",
      "The lesson catalog changed while you were saving. Select Add video again to check the latest version and retry.",
    );
  if (status === 422)
    return new PublishError(
      "validation",
      "GitHub could not accept the update. Check the repository branch rules and your token permissions, then try again.",
    );
  return new PublishError(
    "github",
    `GitHub could not ${operation} the lesson catalog (HTTP ${status}). Please try again later.`,
  );
}

/** Read the current file and append one lesson using its fresh SHA. No credentials are persisted. */
export async function addVideoToGitHub({
  config,
  token,
  video,
  fetchImpl = globalThis.fetch,
  signal,
}) {
  if (typeof token !== "string" || !token.trim())
    throw new PublishError("token", "Enter your GitHub publishing token.");
  let lesson;
  try {
    [lesson] = normalizeVideos({ videos: [video] });
  } catch {
    throw new PublishError(
      "lesson",
      "Check the title, YouTube link, category, and description before saving.",
    );
  }
  const { githubOwner, githubRepo, githubBranch, videosPath } = config ?? {};
  if (
    ![githubOwner, githubRepo, githubBranch, videosPath].every(
      (value) => typeof value === "string" && value.trim(),
    )
  ) {
    throw new PublishError(
      "configuration",
      "The GitHub publishing configuration is incomplete.",
    );
  }
  const endpoint = `https://api.github.com/repos/${encodeURIComponent(githubOwner)}/${encodeURIComponent(githubRepo)}/contents/${videosPath.split("/").map(encodeURIComponent).join("/")}`;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token.trim()}`,
    "X-GitHub-Api-Version": "2026-03-10",
  };

  async function request(url, options) {
    try {
      return await fetchImpl(url, {
        ...options,
        headers: { ...headers, ...options.headers },
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        signal,
      });
    } catch (error) {
      if (signal?.aborted || error?.name === "AbortError")
        throw new PublishError(
          "cancelled",
          "Publishing was cancelled. Check your lesson catalog before retrying.",
        );
      throw new PublishError(
        "network",
        "The connection to GitHub was interrupted. Check the lesson catalog before retrying, in case the update was saved.",
      );
    }
  }

  const current = await request(
    `${endpoint}?ref=${encodeURIComponent(githubBranch)}`,
    { method: "GET" },
  );
  if (!current.ok) throw apiError(current.status, "read");
  let file;
  let videos;
  try {
    file = await current.json();
    if (
      file.type !== "file" ||
      file.encoding !== "base64" ||
      typeof file.content !== "string" ||
      typeof file.sha !== "string" ||
      !file.sha
    )
      throw new Error("Invalid file response");
    videos = normalizeVideos(JSON.parse(decodeBase64Utf8(file.content)));
  } catch {
    throw new PublishError(
      "catalog",
      "The existing lesson catalog could not be validated. Nothing was changed. Have the catalog checked before adding a video.",
    );
  }
  if (videos.some((entry) => entry.id === lesson.id))
    throw new PublishError(
      "duplicate",
      "This YouTube video is already in the lesson catalog.",
    );

  const result = await request(endpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Add lesson: ${lesson.title.replace(/[\r\n]+/g, " ")}`,
      branch: githubBranch,
      sha: file.sha,
      content: encodeBase64Utf8(
        `${JSON.stringify({ videos: [lesson, ...videos] }, null, 2)}\n`,
      ),
    }),
  });
  if (!result.ok) throw apiError(result.status, "save");
  let saved;
  try {
    saved = await result.json();
  } catch {
    throw new PublishError(
      "unconfirmed",
      "GitHub returned an unreadable confirmation. Check the lesson catalog before retrying; the update may have been saved.",
    );
  }
  if (!saved?.commit?.sha || !saved?.content?.sha) {
    throw new PublishError(
      "unconfirmed",
      "GitHub did not return a complete save confirmation. Check the lesson catalog before retrying.",
    );
  }
  return {
    video: lesson,
    commitSha: saved.commit.sha,
    count: videos.length + 1,
  };
}
