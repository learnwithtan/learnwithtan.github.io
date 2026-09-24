import test from "node:test";
import assert from "node:assert/strict";
import {
  addVideoToGitHub,
  encodeBase64Utf8,
  decodeBase64Utf8,
} from "../assets/js/github.js";

const config = {
  githubOwner: "learnwithtan",
  githubRepo: "learnwithtan.github.io",
  githubBranch: "main",
  videosPath: "data/videos.json",
};
const video = {
  id: "dQw4w9WgXcQ",
  title: "Éducation & inquiry 🔬",
  description: "Learning through questions — علم",
  category: "Research methods",
  addedAt: "2026-09-24T12:00:00.000Z",
};
const existing = { ...video, id: "M7lc1UVf-VE", title: "Earlier lesson" };
const response = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const catalog = (videos = [], sha = "fresh-file-sha") =>
  response({
    type: "file",
    encoding: "base64",
    sha,
    content: encodeBase64Utf8(JSON.stringify({ videos })),
  });
const confirmed = () =>
  response({ commit: { sha: "new-commit" }, content: { sha: "new-file-sha" } });

test("UTF-8 base64 round-trips non-ASCII titles and descriptions", () => {
  const text = JSON.stringify(video);
  assert.equal(decodeBase64Utf8(encodeBase64Utf8(text)), text);
});

test("reads fresh catalog then saves both lessons with SHA and Unicode preserved", async () => {
  const calls = [];
  const result = await addVideoToGitHub({
    config,
    token: " test-token ",
    video,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return calls.length === 1 ? catalog([existing]) : confirmed();
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(
    calls[0].url,
    "https://api.github.com/repos/learnwithtan/learnwithtan.github.io/contents/data/videos.json?ref=main",
  );
  assert.equal(calls[0].options.cache, "no-store");
  assert.equal(calls[0].options.headers.Authorization, "Bearer test-token");
  assert.equal(calls[1].options.method, "PUT");
  const body = JSON.parse(calls[1].options.body);
  assert.equal(body.sha, "fresh-file-sha");
  assert.equal(body.branch, "main");
  assert.deepEqual(JSON.parse(decodeBase64Utf8(body.content)), {
    videos: [video, existing],
  });
  assert.equal(body.content.includes("test-token"), false);
  assert.equal(result.count, 2);
  assert.equal(result.commitSha, "new-commit");
});

test("does not write a duplicate video or overwrite malformed data", async () => {
  const cases = [
    { body: catalog([video]), code: "duplicate" },
    {
      body: response({
        type: "file",
        sha: "x",
        encoding: "base64",
        content: encodeBase64Utf8("{broken json"),
      }),
      code: "catalog",
    },
    {
      body: response({
        type: "file",
        sha: "x",
        encoding: "base64",
        content: encodeBase64Utf8(
          JSON.stringify({ videos: [{ id: video.id }] }),
        ),
      }),
      code: "catalog",
    },
    {
      body: response({ type: "file", encoding: "none", sha: "x", content: "" }),
      code: "catalog",
    },
  ];
  for (const item of cases) {
    let calls = 0;
    await assert.rejects(
      addVideoToGitHub({
        config,
        token: "token",
        video,
        fetchImpl: async () => {
          calls++;
          return item.body;
        },
      }),
      (error) => error.code === item.code,
    );
    assert.equal(calls, 1);
  }
});

test("surfaces conflicts and permission failures without claiming success or retrying writes", async () => {
  for (const [status, code] of [
    [409, "conflict"],
    [401, "authentication"],
    [403, "permission"],
    [404, "not-found"],
    [422, "validation"],
    [500, "github"],
  ]) {
    let calls = 0;
    await assert.rejects(
      addVideoToGitHub({
        config,
        token: "token",
        video,
        fetchImpl: async () =>
          ++calls === 1 ? catalog() : response({}, status),
      }),
      (error) => error.code === code,
    );
    assert.equal(calls, 2);
  }
});

test("a second attempt rereads the updated catalog rather than reusing a stale SHA", async () => {
  const calls = [];
  let read = 0;
  const fetchImpl = async (url, options) => {
    if (options.method === "GET")
      return ++read === 1
        ? catalog([], "old-sha")
        : catalog([existing], "new-sha");
    const body = JSON.parse(options.body);
    calls.push(body);
    return calls.length === 1 ? response({}, 409) : confirmed();
  };
  await assert.rejects(
    addVideoToGitHub({ config, token: "token", video, fetchImpl }),
    (error) => error.code === "conflict",
  );
  await addVideoToGitHub({ config, token: "token", video, fetchImpl });
  assert.deepEqual(
    calls.map(({ sha }) => sha),
    ["old-sha", "new-sha"],
  );
  assert.deepEqual(JSON.parse(decodeBase64Utf8(calls[1].content)).videos, [
    video,
    existing,
  ]);
});

test("handles interrupted or unconfirmed saves honestly", async () => {
  let calls = 0;
  await assert.rejects(
    addVideoToGitHub({
      config,
      token: "secret-token",
      video,
      fetchImpl: async () => {
        throw new Error("secret-token");
      },
    }),
    (error) =>
      error.code === "network" && !error.message.includes("secret-token"),
  );
  await assert.rejects(
    addVideoToGitHub({
      config,
      token: "token",
      video,
      fetchImpl: async () => (++calls === 1 ? catalog() : response({})),
    }),
    (error) => error.code === "unconfirmed",
  );
});

test("requires credentials and valid lesson before making any network request", async () => {
  const fetchImpl = () => assert.fail("No request should be made");
  await assert.rejects(
    addVideoToGitHub({ config, token: "", video, fetchImpl }),
    (error) => error.code === "token",
  );
  await assert.rejects(
    addVideoToGitHub({
      config,
      token: "token",
      video: { ...video, title: "" },
      fetchImpl,
    }),
    (error) => error.code === "lesson",
  );
});
