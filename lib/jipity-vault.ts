import {
  MEMORY_LIMITS,
  screenPrivateText,
  validateMemoryRecord,
  validateResearchRecord,
  type MemoryRecord,
  type ResearchRecord,
} from "./jipity-memory";

export const ENCRYPTED_VAULT_STORAGE_KEY = "jipity_private_vault_v1";

export type VaultMessage = {
  role: "user" | "assistant";
  content: string;
};

export type VaultAuditEntry = {
  at: string;
  event: string;
  receipt?: string;
  signed?: boolean;
};

export type PrivateVault = {
  version: 1;
  messages: VaultMessage[];
  audit: VaultAuditEntry[];
  memories: MemoryRecord[];
  research: ResearchRecord[];
  cacheHits: number;
};

type EncryptedVault = {
  version: 1;
  iv: string;
  ciphertext: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function encodeBase64Url(bytes: Uint8Array): string {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);

  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(
    normalized + "=".repeat((4 - (normalized.length % 4)) % 4),
  );
  const result = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    result[index] = binary.charCodeAt(index);
  }

  return result;
}

export async function importPrivateVaultKey(encodedKey: string): Promise<CryptoKey> {
  const bytes = decodeBase64Url(encodedKey);
  if (bytes.length !== 32) throw new Error("The private memory key is invalid.");

  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export function emptyPrivateVault(): PrivateVault {
  return {
    version: 1,
    messages: [],
    audit: [],
    memories: [],
    research: [],
    cacheHits: 0,
  };
}

export function normalizePrivateVault(value: unknown): PrivateVault {
  if (typeof value !== "object" || value === null) return emptyPrivateVault();
  const candidate = value as Partial<PrivateVault>;
  const messages = Array.isArray(candidate.messages)
    ? candidate.messages
        .filter(
          (message): message is VaultMessage =>
            typeof message === "object" &&
            message !== null &&
            (message.role === "user" || message.role === "assistant") &&
            typeof message.content === "string" &&
            message.content.length <= 10_000 &&
            screenPrivateText(message.content).allowed,
        )
        .slice(-40)
    : [];
  const audit = Array.isArray(candidate.audit)
    ? candidate.audit
        .filter(
          (entry): entry is VaultAuditEntry =>
            typeof entry === "object" &&
            entry !== null &&
            typeof entry.at === "string" &&
            !Number.isNaN(Date.parse(entry.at)) &&
            typeof entry.event === "string" &&
            entry.event.length <= 240 &&
            screenPrivateText(entry.event).allowed &&
            (entry.receipt === undefined ||
              (typeof entry.receipt === "string" && entry.receipt.length <= 2500)),
        )
        .slice(-120)
    : [];
  const memories = Array.isArray(candidate.memories)
    ? candidate.memories
        .map((record) => validateMemoryRecord(record))
        .filter((record): record is MemoryRecord => record !== null)
        .slice(-MEMORY_LIMITS.maxRecords)
    : [];
  const research = Array.isArray(candidate.research)
    ? candidate.research
        .map((record) => validateResearchRecord(record))
        .filter(
          (record): record is ResearchRecord =>
            record !== null && Date.parse(record.expiresAt) > Date.now(),
        )
        .slice(-MEMORY_LIMITS.maxResearchRecords)
    : [];

  return {
    version: 1,
    messages,
    audit,
    memories,
    research,
    cacheHits:
      typeof candidate.cacheHits === "number" &&
      Number.isSafeInteger(candidate.cacheHits) &&
      candidate.cacheHits >= 0
        ? Math.min(candidate.cacheHits, 100_000)
        : 0,
  };
}

export async function encryptPrivateVault(
  value: PrivateVault,
  key: CryptoKey,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(normalizePrivateVault(value))),
  );
  const encrypted: EncryptedVault = {
    version: 1,
    iv: encodeBase64Url(iv),
    ciphertext: encodeBase64Url(new Uint8Array(ciphertext)),
  };

  return JSON.stringify(encrypted);
}

export async function decryptPrivateVault(
  encrypted: string,
  key: CryptoKey,
): Promise<PrivateVault> {
  const parsed: unknown = JSON.parse(encrypted);

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("version" in parsed) ||
    parsed.version !== 1 ||
    !("iv" in parsed) ||
    typeof parsed.iv !== "string" ||
    !("ciphertext" in parsed) ||
    typeof parsed.ciphertext !== "string"
  ) {
    throw new Error("The encrypted private memory format is invalid.");
  }

  const iv = decodeBase64Url(parsed.iv);
  if (iv.length !== 12) throw new Error("The encrypted memory nonce is invalid.");
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    decodeBase64Url(parsed.ciphertext),
  );

  return normalizePrivateVault(JSON.parse(decoder.decode(decrypted)));
}
