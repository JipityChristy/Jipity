export const JIPITY_SPEECH_MODEL = "gpt-4o-mini-tts";
export const JIPITY_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";

export const JIPITY_VOICES = [
  { value: "cedar", label: "Cedar · warm and grounded" },
  { value: "marin", label: "Marin · clear and expressive" },
  { value: "ash", label: "Ash · relaxed and natural" },
  { value: "onyx", label: "Onyx · deep and steady" },
  { value: "verse", label: "Verse · friendly and bright" },
  { value: "nova", label: "Nova · gentle and upbeat" },
  { value: "sage", label: "Sage · calm and thoughtful" },
  { value: "coral", label: "Coral · warm and clear" },
] as const;

export type JipityNaturalVoice = (typeof JIPITY_VOICES)[number]["value"];
export type JipityVoiceChoice = JipityNaturalVoice | "device";

export function isJipityNaturalVoice(
  value: unknown,
): value is JipityNaturalVoice {
  return (
    typeof value === "string" &&
    JIPITY_VOICES.some((voice) => voice.value === value)
  );
}

export function isJipityVoiceChoice(value: unknown): value is JipityVoiceChoice {
  return value === "device" || isJipityNaturalVoice(value);
}

// Speech responses are binary and do not expose token usage here. Reserve a
// conservative amount against the signed session budget before each request.
export function estimateSpeechReserveUsd(characterCount: number): number {
  return Number(
    Math.max(0.002, Math.max(0, characterCount) * 0.000024).toFixed(6),
  );
}

// gpt-4o-mini-transcribe is approximately $0.003 per minute. Reserve the
// maximum accepted recording duration rather than trusting a client estimate.
export function estimateTranscriptionReserveUsd(seconds: number): number {
  return Number(((Math.max(1, seconds) * 0.003) / 60).toFixed(6));
}
