import { normalizeSourceUrl, screenPrivateText } from "./jipity-memory";

export const PUBLIC_RESEARCH_LIMITS = {
  maxQueryCharacters: 180,
  maxResultsPerProvider: 3,
  maxResults: 6,
  maxProviderResponseBytes: 400_000,
  providerTimeoutMilliseconds: 7_000,
} as const;

export const PUBLIC_RESEARCH_PROVIDERS = [
  {
    id: "wikipedia",
    label: "Wikipedia public reference",
    disclosure: "Public, editable reference material; independently verify claims.",
  },
  {
    id: "crossref",
    label: "Crossref published-research index",
    disclosure:
      "Publication metadata only; indexing does not establish truth or peer review.",
  },
] as const;

export type PublicResearchProvider =
  (typeof PUBLIC_RESEARCH_PROVIDERS)[number]["id"];

export type PublicResearchSource = {
  id: string;
  provider: PublicResearchProvider;
  providerLabel: string;
  evidenceLabel: "PUBLIC REFERENCE" | "PUBLISHED INDEX";
  title: string;
  summary: string;
  url: string;
  publishedYear: number | null;
  retrievedAt: string;
};

export type PublicResearchProviderStatus = {
  id: PublicResearchProvider;
  label: string;
  status: "ok" | "unavailable";
  results: number;
};

export type PublicResearchScreen = {
  allowed: boolean;
  query: string;
  reasons: string[];
};

const PERSONAL_QUERY_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern:
      /\b(?:my|our)\s+(?:child|children|daughter|son|partner|husband|wife|mother|father|parent|family|home|address|school|doctor|therapist|psychiatrist|caseworker|case worker)\b/i,
    reason:
      "Personal or family details cannot be sent to a public research provider.",
  },
  {
    pattern:
      /\b(?:private|confidential|unredacted|sealed)\s+(?:record|records|document|documents|case|file|files|message|email|report)\b/i,
    reason: "Private documents and case details must stay inside Jipity.",
  },
  {
    pattern: /https?:\/\//i,
    reason:
      "Enter a public topic, not a link that might include private tracking details.",
  },
];

const encoder = new TextEncoder();

export function screenPublicResearchQuery(value: unknown): PublicResearchScreen {
  const query =
    typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  const reasons: string[] = [];

  if (query.length < 3) {
    reasons.push("Enter a public research topic with at least three characters.");
  }

  if (query.length > PUBLIC_RESEARCH_LIMITS.maxQueryCharacters) {
    reasons.push("Keep a public research topic under 181 characters.");
  }

  if (query) {
    const privacy = screenPrivateText(query);
    reasons.push(...privacy.reasons);

    for (const { pattern, reason } of PERSONAL_QUERY_PATTERNS) {
      if (pattern.test(query)) reasons.push(reason);
    }
  }

  return { allowed: reasons.length === 0, query, reasons };
}

function readableText(value: unknown, maximum: number): string {
  if (typeof value !== "string") return "";

  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:amp|lt|gt|quot|apos|#39|#039);/gi, (entity) => {
      const replacements: Record<string, string> = {
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&apos;": "'",
        "&#39;": "'",
        "&#039;": "'",
      };

      return replacements[entity.toLowerCase()] ?? " ";
    })
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function cleanSource(
  value: Omit<PublicResearchSource, "id">,
): PublicResearchSource | null {
  const title = readableText(value.title, 150);
  const summary = readableText(value.summary, 230);
  const url = normalizeSourceUrl(value.url);

  if (!title || !url || !screenPrivateText(`${title} ${summary}`).allowed) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    ...value,
    title,
    summary,
    url,
  };
}

async function fetchPublicJson(url: URL): Promise<unknown> {
  if (
    url.protocol !== "https:" ||
    (url.hostname !== "en.wikipedia.org" &&
      url.hostname !== "api.crossref.org")
  ) {
    throw new Error("An unapproved public research provider was blocked.");
  }

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(
      PUBLIC_RESEARCH_LIMITS.providerTimeoutMilliseconds,
    ),
    headers: {
      Accept: "application/json",
      "User-Agent": "JipityPublicResearch/1.0 (https://jipity.vercel.app)",
      "Api-User-Agent": "JipityPublicResearch/1.0 (https://jipity.vercel.app)",
    },
  });

  if (!response.ok) {
    throw new Error("A free public research provider is unavailable.");
  }

  const contentLength = Number(response.headers.get("content-length") || 0);

  if (contentLength > PUBLIC_RESEARCH_LIMITS.maxProviderResponseBytes) {
    throw new Error("A public research response exceeded the safety limit.");
  }

  const body = await response.text();

  if (encoder.encode(body).length > PUBLIC_RESEARCH_LIMITS.maxProviderResponseBytes) {
    throw new Error("A public research response exceeded the safety limit.");
  }

  return JSON.parse(body);
}

async function searchWikipedia(query: string): Promise<PublicResearchSource[]> {
  const endpoint = new URL("https://en.wikipedia.org/w/rest.php/v1/search/page");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set(
    "limit",
    String(PUBLIC_RESEARCH_LIMITS.maxResultsPerProvider),
  );
  const payload = await fetchPublicJson(endpoint);
  const pages =
    typeof payload === "object" &&
    payload !== null &&
    "pages" in payload &&
    Array.isArray(payload.pages)
      ? payload.pages
      : [];
  const retrievedAt = new Date().toISOString();

  return pages
    .slice(0, PUBLIC_RESEARCH_LIMITS.maxResultsPerProvider)
    .map((page: unknown) => {
      if (typeof page !== "object" || page === null) return null;
      const title =
        "title" in page && typeof page.title === "string" ? page.title : "";
      const key = "key" in page && typeof page.key === "string" ? page.key : title;
      const excerpt =
        "excerpt" in page && typeof page.excerpt === "string" ? page.excerpt : "";
      const publicPath = encodeURIComponent(key.replace(/\s+/g, "_"));

      return cleanSource({
        provider: "wikipedia",
        providerLabel: PUBLIC_RESEARCH_PROVIDERS[0].label,
        evidenceLabel: "PUBLIC REFERENCE",
        title,
        summary: excerpt || "Public editable reference; verify important claims.",
        url: `https://en.wikipedia.org/wiki/${publicPath}`,
        publishedYear: null,
        retrievedAt,
      });
    })
    .filter((source): source is PublicResearchSource => source !== null);
}

function publishedYear(value: unknown): number | null {
  if (typeof value !== "object" || value === null || !("date-parts" in value)) {
    return null;
  }

  const parts = value["date-parts"];
  const year = Array.isArray(parts) && Array.isArray(parts[0]) ? parts[0][0] : null;

  return typeof year === "number" &&
    Number.isSafeInteger(year) &&
    year >= 1000 &&
    year <= new Date().getUTCFullYear() + 1
    ? year
    : null;
}

async function searchCrossref(query: string): Promise<PublicResearchSource[]> {
  const endpoint = new URL("https://api.crossref.org/works");
  endpoint.searchParams.set("query", query);
  endpoint.searchParams.set(
    "rows",
    String(PUBLIC_RESEARCH_LIMITS.maxResultsPerProvider),
  );
  endpoint.searchParams.set("select", "DOI,title,URL,publisher,published,container-title,type");
  const payload = await fetchPublicJson(endpoint);
  const message =
    typeof payload === "object" && payload !== null && "message" in payload
      ? payload.message
      : null;
  const works =
    typeof message === "object" &&
    message !== null &&
    "items" in message &&
    Array.isArray(message.items)
      ? message.items
      : [];
  const retrievedAt = new Date().toISOString();

  return works
    .slice(0, PUBLIC_RESEARCH_LIMITS.maxResultsPerProvider)
    .map((work: unknown) => {
      if (typeof work !== "object" || work === null) return null;
      const title =
        "title" in work && Array.isArray(work.title) && typeof work.title[0] === "string"
          ? work.title[0]
          : "";
      const doi = "DOI" in work && typeof work.DOI === "string" ? work.DOI : "";
      const direct = "URL" in work && typeof work.URL === "string" ? work.URL : "";
      const destination = direct || (doi ? `https://doi.org/${encodeURI(doi)}` : "");
      const publisher =
        "publisher" in work && typeof work.publisher === "string" ? work.publisher : "";
      const journal =
        "container-title" in work &&
        Array.isArray(work["container-title"]) &&
        typeof work["container-title"][0] === "string"
          ? work["container-title"][0]
          : "";
      const year = publishedYear("published" in work ? work.published : null);
      const summary = [publisher, journal, year ? String(year) : ""]
        .filter(Boolean)
        .join(" · ");

      return cleanSource({
        provider: "crossref",
        providerLabel: PUBLIC_RESEARCH_PROVIDERS[1].label,
        evidenceLabel: "PUBLISHED INDEX",
        title,
        summary: summary || "Published metadata; review the original source.",
        url: destination,
        publishedYear: year,
        retrievedAt,
      });
    })
    .filter((source): source is PublicResearchSource => source !== null);
}

export async function searchApprovedPublicSources(query: string): Promise<{
  sources: PublicResearchSource[];
  providers: PublicResearchProviderStatus[];
}> {
  const screened = screenPublicResearchQuery(query);

  if (!screened.allowed) {
    throw new Error("A private or unapproved research query was blocked.");
  }

  const outcomes = await Promise.allSettled([
    searchWikipedia(screened.query),
    searchCrossref(screened.query),
  ]);
  const providers = PUBLIC_RESEARCH_PROVIDERS.map((provider, index) => {
    const outcome = outcomes[index];

    return {
      id: provider.id,
      label: provider.label,
      status:
        outcome.status === "fulfilled"
          ? ("ok" as const)
          : ("unavailable" as const),
      results: outcome.status === "fulfilled" ? outcome.value.length : 0,
    };
  });

  if (providers.every((provider) => provider.status === "unavailable")) {
    throw new Error("Both free public research providers are temporarily unavailable.");
  }

  const candidates = outcomes.flatMap((outcome) =>
    outcome.status === "fulfilled" ? outcome.value : [],
  );
  const seen = new Set<string>();
  const sources = candidates
    .filter((source) => {
      const key = source.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, PUBLIC_RESEARCH_LIMITS.maxResults);

  return { sources, providers };
}

export function formatPublicResearchAnswer(sources: PublicResearchSource[]): string {
  const introduction =
    "Public-source results · $0.00 · no AI model used. Source links identify material; they do not prove every claim.";
  const lines = sources.map((source, index) =>
    `${index + 1}. [${source.evidenceLabel}] ${source.title}${source.summary ? ` — ${source.summary}` : ""}\n${source.url}`,
  );
  let answer = introduction;

  for (const line of lines) {
    const candidate = `${answer}\n\n${line}`;
    if (candidate.length > 1_800) break;
    answer = candidate;
  }

  return answer;
}
