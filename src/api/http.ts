import type { ZodType } from "zod";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function getJson<T>(
  path: string,
  schema: ZodType<T>,
  options: { signal?: AbortSignal } = {}
): Promise<T> {
  const response = await fetch(path, { signal: options.signal });

  if (!response.ok) {
    throw new ApiError(
      (await readErrorMessage(response)) ?? `GET ${path} failed with status ${response.status}`,
      response.status
    );
  }

  return schema.parse(await response.json());
}

export async function postJson<T>(
  path: string,
  body: unknown,
  schema: ZodType<T>,
  options: { signal?: AbortSignal } = {}
): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: options.signal
  });

  if (!response.ok) {
    throw new ApiError(
      (await readErrorMessage(response)) ?? `POST ${path} failed with status ${response.status}`,
      response.status
    );
  }

  return schema.parse(await response.json());
}

export async function putJson<T>(
  path: string,
  body: unknown,
  schema: ZodType<T>,
  options: { signal?: AbortSignal } = {}
): Promise<T> {
  const response = await fetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: options.signal
  });
  if (!response.ok) {
    throw new ApiError(
      (await readErrorMessage(response)) ?? `PUT ${path} failed with status ${response.status}`,
      response.status
    );
  }
  return schema.parse(await response.json());
}

async function readErrorMessage(response: Response) {
  try {
    const payload = (await response.clone().json()) as { error?: unknown };
    return typeof payload.error === "string" ? payload.error : undefined;
  } catch {
    return undefined;
  }
}
