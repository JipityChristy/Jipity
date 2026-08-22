const DEFAULT_ACCESS_CODE_HASH = "449662fe53df618fe5f590cab9826e0774007de360548508029f1e5d2091e235";

export const SESSION_COOKIE_NAME = "jipity_session";
export const USAGE_COOKIE_NAME = "jipity_usage_secure";
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type DailyUsage = {
  day: string;
  spentUsd: number;
  requests: number;
  spiritualRequests: number;
  deepRequests: number;
  voiceRequests: number;
  transcriptionRequests: number;
};

type SessionPayload = {
  type: "session";
  sid: string;
  exp: number;
};

type UsagePayload = DailyUsage & {
  type: "usage";
  sid: string;
};

type SigningPurpose = "session" | "usage" | "audit";

export const AUDIT_ACTIONS = [
  "model_response",
  "voice_generated",
  "voice_transcribed",
  "memory_saved",
  "memory_deleted",
  "research_reused",
  "task_assessed",
  "task_blocked",
  "privacy_blocked",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditReceiptPayload = {
  type: "audit";
  sid: string;
  id: string;
  at: string;
  action: AuditAction;
  outcome: "ok" | "blocked" | "approval-required";
  model?: string;
  estimatedCostUsd?: number;
  cachedInputTokens?: number;
  shelf?: "always" | "verified" | "working" | "review";
};

type AuditReceiptInput = Pick<AuditReceiptPayload, "action" | "outcome"> &
  Partial<
    Pick<
      AuditReceiptPayload,
      "model" | "estimatedCostUsd" | "cachedInputTokens" | "shelf"
    >
  >;

type CookieOptions = {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict";
  path: "/";
  maxAge: number;
};

type CookieResponse = {
  cookies: {
    set(options: CookieOptions): unknown;
  };
};

export type AuthenticatedState = {
  session: SessionPayload;
  governor: DailyUsage;
};

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;

  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return difference === 0;
}

async function signingKey(purpose: SigningPurpose): Promise<CryptoKey> {
  const existingApiKey = process.env.OPENAI_API_KEY;

  if (!existingApiKey) {
    throw new Error("Private access is not configured.");
  }

  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(existingApiKey),
    "HKDF",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode("jipity-private-access-v1"),
      info: encoder.encode(`jipity-${purpose}-signature`),
    },
    baseKey,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign", "verify"],
  );
}

async function signToken(
  payload: SessionPayload | UsagePayload | AuditReceiptPayload,
  purpose: SigningPurpose,
): Promise<string> {
  const encodedPayload = bytesToBase64Url(
    encoder.encode(JSON.stringify(payload)),
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(purpose),
    encoder.encode(encodedPayload),
  );

  return `${encodedPayload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

async function verifyToken(
  token: string,
  purpose: SigningPurpose,
): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split(".");

    if (
      parts.length !== 2 ||
      !parts[0] ||
      !parts[1] ||
      parts[0].length > 2_048 ||
      parts[1].length > 128
    ) {
      return null;
    }

    const valid = await crypto.subtle.verify(
      "HMAC",
      await signingKey(purpose),
      base64UrlToBytes(parts[1]),
      encoder.encode(parts[0]),
    );

    if (!valid) return null;

    const payload: unknown = JSON.parse(
      decoder.decode(base64UrlToBytes(parts[0])),
    );

    if (
      typeof payload !== "object" ||
      payload === null ||
      Array.isArray(payload)
    ) {
      return null;
    }

    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function derivePrivateVaultKey(): Promise<string> {
  const existingApiKey = process.env.OPENAI_API_KEY;

  if (!existingApiKey) {
    throw new Error("Private memory is not configured.");
  }

  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(existingApiKey),
    "HKDF",
    false,
    ["deriveBits"],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode("jipity-private-vault-v1"),
      info: encoder.encode("jipity-encrypted-device-memory-key"),
    },
    baseKey,
    256,
  );

  return bytesToBase64Url(new Uint8Array(derivedBits));
}

function validAuditInput(input: unknown): input is AuditReceiptInput {
  if (typeof input !== "object" || input === null) return false;
  const candidate = input as Partial<AuditReceiptInput>;

  return (
    typeof candidate.action === "string" &&
    AUDIT_ACTIONS.includes(candidate.action as AuditAction) &&
    (candidate.outcome === "ok" ||
      candidate.outcome === "blocked" ||
      candidate.outcome === "approval-required") &&
    (candidate.model === undefined ||
      (typeof candidate.model === "string" &&
        /^[A-Za-z0-9][A-Za-z0-9._/-]{0,79}$/.test(candidate.model))) &&
    (candidate.estimatedCostUsd === undefined ||
      (typeof candidate.estimatedCostUsd === "number" &&
        Number.isFinite(candidate.estimatedCostUsd) &&
        candidate.estimatedCostUsd >= 0 &&
        candidate.estimatedCostUsd <= 1)) &&
    (candidate.cachedInputTokens === undefined ||
      (typeof candidate.cachedInputTokens === "number" &&
        Number.isSafeInteger(candidate.cachedInputTokens) &&
        candidate.cachedInputTokens >= 0 &&
        candidate.cachedInputTokens <= 10_000_000)) &&
    (candidate.shelf === undefined ||
      candidate.shelf === "always" ||
      candidate.shelf === "verified" ||
      candidate.shelf === "working" ||
      candidate.shelf === "review")
  );
}

export async function issueAuditReceipt(
  state: AuthenticatedState,
  input: AuditReceiptInput,
): Promise<string> {
  if (!validAuditInput(input)) {
    throw new Error("The activity receipt contains unapproved information.");
  }

  const payload: AuditReceiptPayload = {
    type: "audit",
    sid: state.session.sid,
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    action: input.action,
    outcome: input.outcome,
    ...(input.model ? { model: input.model } : {}),
    ...(input.estimatedCostUsd !== undefined
      ? { estimatedCostUsd: input.estimatedCostUsd }
      : {}),
    ...(input.cachedInputTokens !== undefined
      ? { cachedInputTokens: input.cachedInputTokens }
      : {}),
    ...(input.shelf ? { shelf: input.shelf } : {}),
  };

  return signToken(payload, "audit");
}

export async function readAuditReceipt(
  token: string,
): Promise<AuditReceiptPayload | null> {
  const payload = await verifyToken(token, "audit");
  if (!payload) return null;

  if (
    payload.type !== "audit" ||
    typeof payload.sid !== "string" ||
    !/^[A-Za-z0-9_-]{20,80}$/.test(payload.sid) ||
    typeof payload.id !== "string" ||
    !/^[A-Za-z0-9-]{20,80}$/.test(payload.id) ||
    typeof payload.at !== "string" ||
    Number.isNaN(Date.parse(payload.at)) ||
    !validAuditInput(payload)
  ) {
    return null;
  }

  return {
    type: "audit",
    sid: payload.sid,
    id: payload.id,
    at: payload.at,
    action: payload.action,
    outcome: payload.outcome,
    ...(payload.model ? { model: payload.model } : {}),
    ...(payload.estimatedCostUsd !== undefined
      ? { estimatedCostUsd: payload.estimatedCostUsd }
      : {}),
    ...(payload.cachedInputTokens !== undefined
      ? { cachedInputTokens: payload.cachedInputTokens }
      : {}),
    ...(payload.shelf ? { shelf: payload.shelf } : {}),
  };
}

export function currentMelbourneDay(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
  }).format(new Date());
}

export function emptyServerUsage(): DailyUsage {
  return {
    day: currentMelbourneDay(),
    spentUsd: 0,
    requests: 0,
    spiritualRequests: 0,
    deepRequests: 0,
    voiceRequests: 0,
    transcriptionRequests: 0,
  };
}

export async function verifyAccessCode(value: unknown): Promise<boolean> {
  if (typeof value !== "string" || value.length < 12 || value.length > 128) {
    return false;
  }

  const expectedHash =
    process.env.JIPITY_ACCESS_CODE_HASH || DEFAULT_ACCESS_CODE_HASH;
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  const actualHash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return constantTimeEqual(actualHash, expectedHash.toLowerCase());
}

export async function createSession(): Promise<AuthenticatedState> {
  const random = new Uint8Array(24);
  crypto.getRandomValues(random);

  return {
    session: {
      type: "session",
      sid: bytesToBase64Url(random),
      exp: Math.floor(Date.now() / 1_000) + SESSION_MAX_AGE_SECONDS,
    },
    governor: emptyServerUsage(),
  };
}

export function readRequestCookie(
  request: Request,
  name: string,
): string | null {
  const cookies = request.headers.get("cookie");
  if (!cookies) return null;

  for (const item of cookies.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;

    if (item.slice(0, separator).trim() === name) {
      return item.slice(separator + 1).trim();
    }
  }

  return null;
}

async function readSession(request: Request): Promise<SessionPayload | null> {
  const token = readRequestCookie(request, SESSION_COOKIE_NAME);
  if (!token) return null;

  const payload = await verifyToken(token, "session");
  if (!payload) return null;

  if (
    payload.type !== "session" ||
    typeof payload.sid !== "string" ||
    !/^[A-Za-z0-9_-]{20,80}$/.test(payload.sid) ||
    typeof payload.exp !== "number" ||
    !Number.isSafeInteger(payload.exp) ||
    payload.exp <= Math.floor(Date.now() / 1_000) ||
    payload.exp >
      Math.floor(Date.now() / 1_000) + SESSION_MAX_AGE_SECONDS + 60
  ) {
    return null;
  }

  return {
    type: "session",
    sid: payload.sid,
    exp: payload.exp,
  };
}

function validCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 100_000
  );
}

async function readUsage(
  request: Request,
  session: SessionPayload,
): Promise<DailyUsage | null> {
  const token = readRequestCookie(request, USAGE_COOKIE_NAME);
  if (!token) return null;

  const payload = await verifyToken(token, "usage");
  if (!payload) return null;

  // Sessions signed before natural voice was introduced do not contain these
  // fields. Keep their original signature valid and normalize both to zero.
  const voiceRequests =
    payload.voiceRequests === undefined ? 0 : payload.voiceRequests;
  const transcriptionRequests =
    payload.transcriptionRequests === undefined
      ? 0
      : payload.transcriptionRequests;

  if (
    payload.type !== "usage" ||
    payload.sid !== session.sid ||
    typeof payload.day !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(payload.day) ||
    typeof payload.spentUsd !== "number" ||
    !Number.isFinite(payload.spentUsd) ||
    payload.spentUsd < 0 ||
    payload.spentUsd > 1_000 ||
    !validCount(payload.requests) ||
    !validCount(payload.spiritualRequests) ||
    !validCount(payload.deepRequests) ||
    !validCount(voiceRequests) ||
    !validCount(transcriptionRequests) ||
    payload.spiritualRequests + payload.deepRequests > payload.requests
  ) {
    return null;
  }

  if (payload.day !== currentMelbourneDay()) return emptyServerUsage();

  return {
    day: payload.day,
    spentUsd: payload.spentUsd,
    requests: payload.requests,
    spiritualRequests: payload.spiritualRequests,
    deepRequests: payload.deepRequests,
    voiceRequests,
    transcriptionRequests,
  };
}

export async function readAuthenticatedState(
  request: Request,
): Promise<AuthenticatedState | null> {
  const session = await readSession(request);
  if (!session) return null;

  const governor = await readUsage(request, session);
  if (!governor) return null;

  return { session, governor };
}

function cookieOptions(
  request: Request,
  name: string,
  value: string,
  maxAge = SESSION_MAX_AGE_SECONDS,
): CookieOptions {
  return {
    name,
    value,
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production" ||
      new URL(request.url).protocol === "https:",
    sameSite: "strict",
    path: "/",
    maxAge,
  };
}

export async function setSessionCookies(
  response: CookieResponse,
  request: Request,
  state: AuthenticatedState,
): Promise<void> {
  response.cookies.set(
    cookieOptions(
      request,
      SESSION_COOKIE_NAME,
      await signToken(state.session, "session"),
    ),
  );
  await setUsageCookie(response, request, state);
}

export async function setUsageCookie(
  response: CookieResponse,
  request: Request,
  state: AuthenticatedState,
): Promise<void> {
  const payload: UsagePayload = {
    type: "usage",
    sid: state.session.sid,
    ...state.governor,
  };

  response.cookies.set(
    cookieOptions(
      request,
      USAGE_COOKIE_NAME,
      await signToken(payload, "usage"),
    ),
  );
}

export function clearSessionCookies(
  response: CookieResponse,
  request: Request,
): void {
  response.cookies.set(
    cookieOptions(request, SESSION_COOKIE_NAME, "", 0),
  );
  response.cookies.set(
    cookieOptions(request, USAGE_COOKIE_NAME, "", 0),
  );
}
