import { createServer } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import {
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicFiles = new Set([
  "index.html",
  "404.html",
  "robots.txt",
  "sitemap.xml",
  ".nojekyll",
]);
const publicDirectories = new Set(["lessons", "admin", "assets", "data"]);
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".pdf": "application/pdf",
};

function isInside(root, target) {
  const difference = relative(root, target);
  return (
    difference === "" ||
    (!isAbsolute(difference) &&
      difference !== ".." &&
      !difference.startsWith(`..${sep}`))
  );
}

function isPublic(segments) {
  return (
    !segments.length ||
    publicDirectories.has(segments[0]) ||
    (segments.length === 1 && publicFiles.has(segments[0]))
  );
}

function send(
  response,
  method,
  status,
  body,
  type = "text/plain; charset=utf-8",
  headers = {},
) {
  response.writeHead(status, {
    "Content-Type": type,
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  response.end(method === "HEAD" ? undefined : body);
}

// Only the same public files as the deployment workflow are served locally.
export function createStaticServer({ root = projectRoot } = {}) {
  const rootPath = resolve(root);
  const canonicalRoot = realpath(rootPath);

  return createServer(async (request, response) => {
    const method = request.method;
    if (method !== "GET" && method !== "HEAD") {
      send(response, method, 405, "Method not allowed.", undefined, {
        Allow: "GET, HEAD",
      });
      return;
    }

    try {
      // Inspect the raw path before URL normalization can erase traversal segments.
      const rawPath = (request.url || "/").split("?")[0];
      let pathname;
      try {
        pathname = decodeURIComponent(rawPath);
      } catch {
        send(response, method, 400, "Invalid URL.");
        return;
      }
      const segments = pathname.split("/").filter(Boolean);
      if (
        !pathname.startsWith("/") ||
        pathname.startsWith("//") ||
        /[\\\x00-\x1f\x7f:]/.test(pathname) ||
        segments.some(
          (segment) =>
            segment === "." || segment === ".." || /[ .]$/.test(segment),
        )
      ) {
        send(response, method, 403, "Forbidden.");
        return;
      }
      if (
        segments.some(
          (segment) => segment.startsWith(".") && segment !== ".nojekyll",
        )
      ) {
        send(response, method, 404, "Page not found.");
        return;
      }
      if (!isPublic(segments)) {
        send(response, method, 404, "Page not found.");
        return;
      }

      let target = resolve(rootPath, `.${pathname}`);
      if (!isInside(rootPath, target)) {
        send(response, method, 403, "Forbidden.");
        return;
      }
      const information = await stat(target);
      if (information.isDirectory()) {
        if (!pathname.endsWith("/")) {
          const query = request.url.includes("?")
            ? request.url.slice(request.url.indexOf("?"))
            : "";
          send(response, method, 308, "Redirecting.", undefined, {
            Location: `${rawPath}/${query}`,
          });
          return;
        }
        target = resolve(target, "index.html");
      }
      const canonicalTarget = await realpath(target);
      const resolvedRoot = await canonicalRoot;
      const resolvedSegments = relative(resolvedRoot, canonicalTarget)
        .split(sep)
        .filter(Boolean);
      if (
        !isInside(resolvedRoot, canonicalTarget) ||
        !isPublic(resolvedSegments) ||
        resolvedSegments.some(
          (segment) => segment.startsWith(".") && segment !== ".nojekyll",
        )
      ) {
        send(response, method, 403, "Forbidden.");
        return;
      }
      if (!(await stat(canonicalTarget)).isFile()) {
        send(response, method, 404, "Page not found.");
        return;
      }
      const content = await readFile(canonicalTarget);
      send(
        response,
        method,
        200,
        content,
        contentTypes[extname(target).toLowerCase()] ||
          "application/octet-stream",
      );
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") {
        try {
          const fallback = await realpath(resolve(rootPath, "404.html"));
          if (isInside(await canonicalRoot, fallback)) {
            send(
              response,
              method,
              404,
              await readFile(fallback),
              contentTypes[".html"],
            );
            return;
          }
        } catch {
          // A project without a custom 404 page still returns the correct status.
        }
        send(response, method, 404, "Page not found.");
      } else {
        send(response, method, 500, "Unable to serve this file.");
      }
    }
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const argumentsList = process.argv.slice(2);
  const portOption = argumentsList.indexOf("--port");
  const portValue =
    portOption === -1
      ? process.env.PORT || "4173"
      : argumentsList[portOption + 1];
  const port = Number(portValue);
  if (
    !/^\d+$/.test(portValue || "") ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    console.error("Choose a port between 1 and 65535 with --port or PORT.");
    process.exitCode = 1;
  } else {
    const server = createStaticServer();
    server.on("error", (error) => {
      console.error(`Could not start the preview server: ${error.message}`);
      process.exitCode = 1;
    });
    server.listen(port, "127.0.0.1", () => {
      console.log(`Learn With Tan is available at http://127.0.0.1:${port}`);
    });
  }
}
