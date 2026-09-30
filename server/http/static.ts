import type { ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { writeError } from "./json.js";

export async function serveStatic(url: URL, response: ServerResponse, staticRoot: string) {
  try {
    const requested =
      url.pathname === "/"
        ? "index.html"
        : normalize(decodeURIComponent(url.pathname)).replace(/^\/+/, "");
    if (requested.startsWith("..")) throw new Error("Invalid static path");
    let body: Buffer;
    let file = join(staticRoot, requested);
    try {
      body = await readFile(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      file = join(staticRoot, "index.html");
      body = await readFile(file);
    }
    response.setHeader("Content-Type", contentType(file));
    response.writeHead(200);
    response.end(body);
  } catch (error) {
    writeError(response, 404, error, "Static asset not found");
  }
}

function contentType(file: string) {
  return (
    (
      {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".svg": "image/svg+xml",
        ".wasm": "application/wasm",
        ".glb": "model/gltf-binary",
        ".png": "image/png",
        ".woff2": "font/woff2"
      } as Record<string, string>
    )[extname(file)] ?? "application/octet-stream"
  );
}
