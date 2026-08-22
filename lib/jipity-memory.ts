export const MEMORY_LIMITS = {
  maxRecords: 120,
  maxResearchRecords: 36,
  maxSummaryCharacters: 320,
  maxSourceCharacters: 280,
  maxResearchCharacters: 1800,
  maxApprovedContextItems: 6,
  maxApprovedContextCharacters: 1400,
  ordinaryResearchTtlHours: 24 * 7,
  timeSensitiveResearchTtlHours: 1,
} as const;

export const ALWAYS_REMEMBER_RULES = [
  "Christy decides what is saved, shared, sent, or done.",
  "Protect children, family privacy, private records, and personal safety.",
  "Separate verified facts from inference, disputes, speculation, and symbolism.",
  "Reuse fresh approved research and choose the lowest-cost suitable model.",
  "Never spend money, impersonate anyone, or take external action without exact approval.",
] as const;

export const NEVER_REMEMBER_RULES = [
  "Passwords, access codes, API keys, verification codes, or authentication tokens.",
  "Bank or card numbers, government identifiers, private phone numbers, or email addresses.",
  "Exact home addresses, dates of birth, or a child's school, medical, or case details.",
  "Private documents, messages, legal records, or other people's identifying information.",
  "Allegations, symbolic material, or unverified claims presented as established facts.",
] as const;

export type MemoryShelf = "always" | "verified" | "working" | "review";
export type EvidenceLabel =
  | "user-confirmed"
  | "source-backed"
  | "inference"
  | "unverified"
  | "disputed"
  | "symbolic";

export type MemoryRecord = {
  id: string;
  summary: string;
  shelf: MemoryShelf;
  evidence: EvidenceLabel;
  sourceUrl: string | null;
  approved: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ResearchRecord = {
  id: string;
  query: string;
  normalizedQuery: string;
  answer: string;
  sourceUrls: string[];
  evidence: "unverified" | "source-backed";
  model: string;
  createdAt: string;
  expiresAt: string;
};

export type MemoryScreen = {
  allowed: boolean;
  reasons: string[];
};

const SHELVES = new Set<MemoryShelf>([
  "always",
  "verified",
  "working",
  "review",
]);
const EVIDENCE_LABELS = new Set<EvidenceLabel>([
  "user-confirmed",
  "source-backed",
  "inference",
  "unverified",
  "disputed",
  "symbolic",
]);

const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern:
      /\b(?:sk-(?:proj-)?|xai-|ghp_|github_pat_|AIza|hf_)[A-Za-z0-9_-]{12,}\b/i,
    reason: "An API key, access token, or credential was detected.",
  },
  {
    pattern:
      /\b(?:password|passcode|access[ -]?code|one[ -]?time[ -]?code|verification[ -]?code|bearer[ -]?token|api[ -]?key|secret[ -]?key|refresh[ -]?token|session[ -]?token)\s*(?:(?:is|=|:)\s*|\s+)[A-Za-z0-9!@#$%^&*_-]{4,}/i,
    reason: "A password, access code, or verification code was detected.",
  },
  {
    pattern: /\b(?:\d[ -]*?){13,19}\b/,
    reason: "A possible payment-card or financial account number was detected.",
  },
  {
    pattern:
      /\b(?:bsb|bank account|account number|tax file number|tfn|medicare|centrelink|crn|passport|licen[cs]e number)\s*(?:is|=|:)?\s*[A-Za-z0-9 -]{5,}/i,
    reason: "A financial, government, or identity number was detected.",
  },
  {
    pattern: /\b\d{3}[ -]\d{3}\b/,
    reason: "A possible Australian bank BSB was detected.",
  },
  {
    pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    reason: "A private email address was detected.",
  },
  {
    pattern:
      /(?:\+61\s?[2-478]|\b0[2-478])(?:[\s-]?\d){8}\b|\b(?:\d[\s.-]?){10,12}\b/,
    reason: "A private phone number was detected.",
  },
  {
    pattern:
      /\b\d{1,5}\s+[A-Za-z0-9' -]{3,60}\s+(?:street|st|road|rd|avenue|ave|drive|dr|court|ct|crescent|lane|ln|place|pl|boulevard|way)\b/i,
    reason: "An exact street address was detected.",
  },
  {
    pattern:
      /\b(?:0?[1-9]|[12]\d|3[01])[\/. -](?:0?[1-9]|1[0-2])[\/. -](?:19|20)\d{2}\b|\b(?:19|20)\d{2}-\d{2}-\d{2}\b/,
    reason: "A complete date of birth or identifying date was detected.",
  },
  {
    pattern:
      /\b(?:child|children|daughter|son|minor)\b[\s\S]{0,65}\b(?:school|diagnos\w*|medical|medication|address|case file|case number|court|therapy|location)\b|\b(?:school|diagnos\w*|medical|medication|address|case file|case number|court|therapy|location)\b[\s\S]{0,65}\b(?:child|children|daughter|son|minor)\b/i,
    reason: "A child's identifying, school, medical, location, or case information was detected.",
  },
  {
    pattern:
      /\b(?:private medical record|child protection file|case file number|unredacted court record|confidential attachment|private email thread)\b/i,
    reason: "A private or sensitive record was detected.",
  },
];

const TIME_SENSITIVE_RESEARCH =
  /\b(?:today|tonight|latest|current|now|news|price|pricing|cost|law|legal|regulation|deadline|weather|election|available|availability|opening hours|schedule|stock|crypto|market|rate)\b/i;

const RESEARCH_INTENT =
  /\b(?:research|search|find|look up|lookup|investigate|compare|source|sources|evidence|verify|check|what is|who is|how does|explain|history)\b/i;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "what",
  "with",
  "you",
]);

export function screenPrivateText(value: unknown): MemoryScreen {
  if (typeof value !== "string" || !value.trim()) {
    return { allowed: false, reasons: ["Add a non-empty memory first."] };
  }

  const reasons = SENSITIVE_PATTERNS.filter(({ pattern }) => pattern.test(value)).map(
    ({ reason }) => reason,
  );

  return { allowed: reasons.length === 0, reasons };
}

export function normalizeSourceUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const parsed = new URL(value.trim());

    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.hostname === "localhost" ||
      parsed.hostname.endsWith(".local") ||
      /^(?:127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(
        parsed.hostname,
      ) ||
      /^\[(?:::1|::|fc|fd|fe80:)/i.test(parsed.hostname)
    ) {
      return null;
    }

    parsed.search = "";
    parsed.hash = "";
    const sanitized = parsed.toString();

    return sanitized.length <= MEMORY_LIMITS.maxSourceCharacters
      ? sanitized
      : null;
  } catch {
    return null;
  }
}

export function validateMemoryRecord(value: unknown): MemoryRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Partial<MemoryRecord>;

  if (
    typeof record.id !== "string" ||
    !/^[A-Za-z0-9_-]{8,80}$/.test(record.id) ||
    typeof record.summary !== "string" ||
    record.summary.trim().length === 0 ||
    record.summary.length > MEMORY_LIMITS.maxSummaryCharacters ||
    !screenPrivateText(record.summary).allowed ||
    !record.shelf ||
    !SHELVES.has(record.shelf) ||
    !record.evidence ||
    !EVIDENCE_LABELS.has(record.evidence) ||
    typeof record.approved !== "boolean" ||
    typeof record.createdAt !== "string" ||
    Number.isNaN(Date.parse(record.createdAt)) ||
    typeof record.updatedAt !== "string" ||
    Number.isNaN(Date.parse(record.updatedAt))
  ) {
    return null;
  }

  const sourceUrl = record.sourceUrl
    ? normalizeSourceUrl(record.sourceUrl)
    : null;

  if (
    (record.sourceUrl && !sourceUrl) ||
    (record.evidence === "source-backed" && !sourceUrl) ||
    (record.shelf === "verified" &&
      (!sourceUrl || record.evidence !== "source-backed" || !record.approved)) ||
    (record.shelf === "always" &&
      (record.evidence !== "user-confirmed" || !record.approved)) ||
    (record.shelf === "working" && !record.approved) ||
    (record.shelf === "review" && record.approved) ||
    (record.shelf !== "review" &&
      (record.evidence === "unverified" ||
        record.evidence === "disputed" ||
        record.evidence === "symbolic"))
  ) {
    return null;
  }

  return {
    id: record.id,
    summary: record.summary.trim(),
    shelf: record.shelf,
    evidence: record.evidence,
    sourceUrl,
    approved: record.approved,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function normalizeResearchQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 400);
}

export function extractSourceUrls(text: string): string[] {
  const candidates = text.match(/https:\/\/[^\s<>)\]]+/g) ?? [];

  return Array.from(
    new Set(
      candidates
        .map((candidate) => normalizeSourceUrl(candidate.replace(/[.,;]+$/, "")))
        .filter((url): url is string => Boolean(url)),
    ),
  ).slice(0, 5);
}

export function createResearchRecord(
  query: string,
  answer: string,
  model: string,
  now = new Date(),
  options: { approvedPublicResearch?: boolean } = {},
): ResearchRecord | null {
  if (
    (!options.approvedPublicResearch && !RESEARCH_INTENT.test(query)) ||
    !screenPrivateText(query).allowed ||
    !screenPrivateText(answer).allowed ||
    query.length > 400 ||
    answer.length > MEMORY_LIMITS.maxResearchCharacters
  ) {
    return null;
  }

  const sourceUrls = extractSourceUrls(answer);
  const ttlHours = TIME_SENSITIVE_RESEARCH.test(`${query} ${answer}`)
    ? MEMORY_LIMITS.timeSensitiveResearchTtlHours
    : MEMORY_LIMITS.ordinaryResearchTtlHours;

  return {
    id: crypto.randomUUID(),
    query: query.trim(),
    normalizedQuery: normalizeResearchQuery(query),
    answer: answer.trim(),
    sourceUrls,
    evidence: sourceUrls.length > 0 ? "source-backed" : "unverified",
    model: model.slice(0, 80),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString(),
  };
}

export function validateResearchRecord(value: unknown): ResearchRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Partial<ResearchRecord>;

  if (
    typeof record.id !== "string" ||
    !/^[A-Za-z0-9_-]{8,80}$/.test(record.id) ||
    typeof record.query !== "string" ||
    typeof record.answer !== "string" ||
    record.query.length > 400 ||
    record.answer.length > MEMORY_LIMITS.maxResearchCharacters ||
    !screenPrivateText(record.query).allowed ||
    !screenPrivateText(record.answer).allowed ||
    typeof record.model !== "string" ||
    record.model.length > 80 ||
    typeof record.createdAt !== "string" ||
    Number.isNaN(Date.parse(record.createdAt)) ||
    typeof record.expiresAt !== "string" ||
    Number.isNaN(Date.parse(record.expiresAt)) ||
    (record.evidence !== "unverified" && record.evidence !== "source-backed") ||
    !Array.isArray(record.sourceUrls)
  ) {
    return null;
  }

  const sourceUrls = record.sourceUrls
    .map((source) => normalizeSourceUrl(source))
    .filter((source): source is string => Boolean(source))
    .slice(0, 5);

  if (record.evidence === "source-backed" && sourceUrls.length === 0) return null;

  return {
    id: record.id,
    query: record.query.trim(),
    normalizedQuery: normalizeResearchQuery(record.query),
    answer: record.answer.trim(),
    sourceUrls,
    evidence: record.evidence,
    model: record.model,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  };
}

export function findFreshResearch(
  records: ResearchRecord[],
  query: string,
  now = Date.now(),
): ResearchRecord | null {
  if (!screenPrivateText(query).allowed) return null;
  const normalized = normalizeResearchQuery(query);

  return (
    records.find(
      (record) =>
        record.normalizedQuery === normalized &&
        Date.parse(record.expiresAt) > now &&
        validateResearchRecord(record) !== null,
    ) ?? null
  );
}

function keywords(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .match(/[a-z0-9]{3,}/g)
      ?.filter((word) => !STOP_WORDS.has(word)) ?? [],
  );
}

export function selectApprovedMemories(
  records: MemoryRecord[],
  query: string,
): MemoryRecord[] {
  const queryWords = keywords(query);
  const safe = records
    .map((record) => validateMemoryRecord(record))
    .filter(
      (record): record is MemoryRecord =>
        record !== null && record.approved && record.shelf !== "review",
    );

  const ranked = safe
    .map((record) => {
      const words = keywords(record.summary);
      const overlap = Array.from(words).filter((word) => queryWords.has(word)).length;

      return {
        record,
        score: overlap + (record.shelf === "always" ? 100 : 0),
      };
    })
    .filter(({ score, record }) => score > 0 || record.shelf === "always")
    .sort((left, right) => right.score - left.score);

  const result: MemoryRecord[] = [];
  let characters = 0;

  for (const { record } of ranked) {
    if (
      result.length >= MEMORY_LIMITS.maxApprovedContextItems ||
      characters + record.summary.length > MEMORY_LIMITS.maxApprovedContextCharacters
    ) {
      continue;
    }

    characters += record.summary.length;
    result.push(record);
  }

  return result;
}
