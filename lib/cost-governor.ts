export type JipityMode = "standard" | "deep";

export const COST_GOVERNOR = {
  dailyBudgetUsd: 0.5,
  maxRequestsPerDay: 30,
  maxDeepRequestsPerDay: 3,
  maxMessages: 12,
  maxMessageCharacters: 2400,
  maxInputCharacters: 10000,
  maxEstimatedRequestUsd: 0.07,
} as const;

export const MODEL_CONFIG = {
  standard: {
    model: "gpt-4.1",
    maxOutputTokens: 900,
    inputPricePerMillion: 2,
    outputPricePerMillion: 8,
  },
  deep: {
    model: "gpt-5.6-sol",
    maxOutputTokens: 1800,
    inputPricePerMillion: 4,
    outputPricePerMillion: 20,
  },
} as const;

export function estimateCostUsd(
  mode: JipityMode,
  inputTokens: number,
  outputTokens: number,
): number {
  const model = MODEL_CONFIG[mode];

  return (
    (Math.max(0, inputTokens) * model.inputPricePerMillion +
      Math.max(0, outputTokens) * model.outputPricePerMillion) /
    1_000_000
  );
}
