import type { IncomingMessage, ServerResponse } from "node:http";

export function applyJsonHeaders(response: ServerResponse) {
  response.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:5173");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
}

export function writeError(
  response: ServerResponse<IncomingMessage>,
  status: number,
  error: unknown,
  fallback: string
) {
  writeJson(response, status, {
    ok: false,
    error: error instanceof Error ? error.message : fallback
  });
}

export function writeJson(
  response: ServerResponse<IncomingMessage>,
  status: number,
  body: unknown
) {
  response.writeHead(status);
  response.end(JSON.stringify(body));
}

export async function readJsonBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new Error("Request body exceeds 1 MB");
    chunks.push(buffer);
  }

  if (chunks.length === 0) throw new Error("Request body is required");

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new Error("Request body must be valid JSON");
  }
}
