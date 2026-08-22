import { screenPrivateText } from "./jipity-memory";

export type ToolAccess = "available" | "approval-required" | "disabled";

export type GuardedTool = {
  id: string;
  label: string;
  access: ToolAccess;
  reason: string;
};

export const TASK_LIMITS = {
  maxDescriptionCharacters: 700,
  maxSteps: 6,
  maxTaskBudgetUsd: 0.02,
  maxRuntimeMinutes: 2,
  maxRepeatedSearches: 1,
  maxRetriesWithoutProgress: 0,
} as const;

export const GUARDED_TOOLS: GuardedTool[] = [
  {
    id: "approved_memory",
    label: "Read approved memory",
    access: "available",
    reason: "Only relevant, user-approved, non-sensitive memory is eligible.",
  },
  {
    id: "research_cache",
    label: "Reuse fresh research",
    access: "available",
    reason: "Exact safe matches can be reused without another model request.",
  },
  {
    id: "source_review",
    label: "Review evidence and sources",
    access: "available",
    reason: "Unverified material remains separate from trusted memory.",
  },
  {
    id: "web_search",
    label: "Search the public web",
    access: "approval-required",
    reason: "Not connected. A specific search and privacy-safe query need approval.",
  },
  {
    id: "email_draft",
    label: "Draft an email",
    access: "approval-required",
    reason: "Drafting needs your request; sending is never automatic.",
  },
  {
    id: "email_send",
    label: "Send an email or message",
    access: "disabled",
    reason: "No sending integration exists; exact current approval is mandatory.",
  },
  {
    id: "external_share",
    label: "Upload, post, or share data",
    access: "disabled",
    reason: "Private data never leaves Jipity for an unapproved third party.",
  },
  {
    id: "payments",
    label: "Spend, trade, gamble, or subscribe",
    access: "disabled",
    reason: "Financial commitments and gambling are permanently blocked.",
  },
  {
    id: "autonomous_loop",
    label: "Run unattended or repeat forever",
    access: "disabled",
    reason: "No background worker, unlimited loop, or automatic retry is enabled.",
  },
  {
    id: "provider_switch",
    label: "Use Grok or another AI provider",
    access: "approval-required",
    reason: "Verify free credit, privacy terms, and a zero-cost stop first.",
  },
];

export type TaskAssessment = {
  description: string;
  outcome: "ready-for-review" | "approval-required" | "blocked";
  reasons: string[];
  requiredApprovals: string[];
  availableTools: string[];
  blockedTools: string[];
  limits: typeof TASK_LIMITS;
  executionEnabled: false;
};

const BLOCKED_TASK_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern:
      /\b(?:buy|purchase|pay|spend|transfer|donate|deposit|subscribe|gambl\w*|casino|bet|trade|invest|crypto(?:currency)?)\b/i,
    reason: "Financial transactions, gambling, subscriptions, and investments are blocked.",
  },
  {
    pattern:
      /\b(?:guaranteed income|guaranteed profit|certain win|risk[- ]free profit|make money without stopping)\b/i,
    reason: "Guaranteed earnings and endless money-making claims are not permitted.",
  },
  {
    pattern:
      /\b(?:impersonat\w*|pretend to be me|sign as me|bypass approval|ignore safety|reveal (?:my|the) (?:api key|password|access code))\b/i,
    reason: "Impersonation, credential exposure, and safety bypasses are blocked.",
  },
  {
    pattern:
      /\b(?:run forever|never stop|keep trying forever|unlimited retries|without asking me|without approval)\b/i,
    reason: "Unattended execution, unlimited retries, and actions without approval are blocked.",
  },
];

const APPROVAL_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\b(?:send|email|message|contact|call|text|submit|apply|post|publish)\b/i,
    reason: "Any message, application, submission, or publication needs your exact approval.",
  },
  {
    pattern: /\b(?:search the web|browse|google|look online|search online|external research)\b/i,
    reason: "Public web search is not connected and requires a privacy-safe approved query.",
  },
  {
    pattern: /\b(?:grok|groq|gemini|cloudflare|openrouter|another (?:ai|provider))\b/i,
    reason: "A new AI provider needs a privacy review, verified free credit, and your approval.",
  },
];

export function assessTask(value: unknown): TaskAssessment {
  const description = typeof value === "string" ? value.trim() : "";
  const reasons: string[] = [];
  const requiredApprovals: string[] = [];

  if (!description) reasons.push("Describe the task before it can be assessed.");

  if (description.length > TASK_LIMITS.maxDescriptionCharacters) {
    reasons.push("The task description is longer than the approved safety limit.");
  }

  if (description) {
    const privacy = screenPrivateText(description);
    if (!privacy.allowed) reasons.push(...privacy.reasons);

    for (const { pattern, reason } of BLOCKED_TASK_PATTERNS) {
      if (pattern.test(description)) reasons.push(reason);
    }

    for (const { pattern, reason } of APPROVAL_PATTERNS) {
      if (pattern.test(description)) requiredApprovals.push(reason);
    }
  }

  return {
    description,
    outcome:
      reasons.length > 0
        ? "blocked"
        : requiredApprovals.length > 0
          ? "approval-required"
          : "ready-for-review",
    reasons,
    requiredApprovals,
    availableTools: GUARDED_TOOLS.filter((tool) => tool.access === "available").map(
      (tool) => tool.label,
    ),
    blockedTools: GUARDED_TOOLS.filter((tool) => tool.access === "disabled").map(
      (tool) => tool.label,
    ),
    limits: TASK_LIMITS,
    executionEnabled: false,
  };
}
