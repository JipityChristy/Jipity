export type JipityMode = "standard" | "spiritual" | "deep";

export const COST_GOVERNOR = {
  dailyBudgetUsd: 0.5,
  maxRequestsPerDay: 30,
  maxSpiritualRequestsPerDay: 6,
  maxDeepRequestsPerDay: 3,
  maxVoiceRequestsPerDay: 18,
  maxTranscriptionRequestsPerDay: 20,
  maxPublicResearchRequestsPerDay: 12,
  maxMessages: 12,
  maxMessageCharacters: 2400,
  maxSpeechCharacters: 4096,
  maxRecordingSeconds: 60,
  maxAudioBytes: 2_000_000,
  maxInputCharacters: 10000,
  maxEstimatedRequestUsd: 0.1,
} as const;

export const MODEL_CONFIG = {
  standard: {
    model: "gpt-5-nano",
    maxOutputTokens: 900,
    inputPricePerMillion: 0.05,
    outputPricePerMillion: 0.4,
  },
  spiritual: {
    model: "gpt-4o",
    maxOutputTokens: 1200,
    inputPricePerMillion: 2.5,
    outputPricePerMillion: 10,
  },
  deep: {
    model: "gpt-5.6-sol",
    maxOutputTokens: 1800,
    inputPricePerMillion: 5,
    outputPricePerMillion: 30,
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
