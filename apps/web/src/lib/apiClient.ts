// Every API error in the app is normalized to this one shape, matching the
// agent service's error envelope (services/agent/src/core/errors.py) so the
// UI never has to special-case "what does an error look like from service X."
import { logger } from "./logger";

export class ApiError extends Error {
  code: string;
  requestId: string;
  status: number;

  constructor(code: string, message: string, requestId: string, status: number) {
    super(message);
    this.code = code;
    this.requestId = requestId;
    this.status = status;
  }
}

type ErrorBody = { error: { code: string; message: string; request_id: string } };

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    let body: ErrorBody | null = null;
    try {
      body = (await response.json()) as ErrorBody;
    } catch {
      // response had no JSON body — fall through to generic error below
    }
    const code = body?.error?.code ?? "unknown_error";
    const message = body?.error?.message ?? `Request failed with status ${response.status}`;
    const requestId = body?.error?.request_id ?? response.headers.get("x-request-id") ?? "-";

    logger.error({ code, requestId, status: response.status, url: input }, "api_error");
    throw new ApiError(code, message, requestId, response.status);
  }

  return (await response.json()) as T;
}
