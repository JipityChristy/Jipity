export type JipitySpeechCallbacks = {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
};

export function speechPlaybackSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance === "function"
  );
}

export function chooseJipityVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  const australian = (voice: SpeechSynthesisVoice) =>
    voice.lang.toLowerCase().startsWith("en-au");
  const english = (voice: SpeechSynthesisVoice) =>
    voice.lang.toLowerCase().startsWith("en");

  return (
    voices.find((voice) => voice.localService && australian(voice)) ??
    voices.find((voice) => voice.localService && english(voice)) ??
    voices.find(australian) ??
    voices.find(english) ??
    voices.find((voice) => voice.localService) ??
    voices[0] ??
    null
  );
}

export function speakJipityResponse(
  text: string,
  callbacks: JipitySpeechCallbacks = {},
): SpeechSynthesisUtterance | null {
  if (!speechPlaybackSupported() || !text.trim()) return null;

  const synthesizer = window.speechSynthesis;
  synthesizer.cancel();

  const utterance = new window.SpeechSynthesisUtterance(text);
  const preferredVoice = chooseJipityVoice(synthesizer.getVoices());

  if (preferredVoice) utterance.voice = preferredVoice;

  utterance.lang = preferredVoice?.lang ?? "en-AU";
  utterance.rate = 0.98;
  utterance.pitch = 0.95;
  utterance.volume = 1;
  utterance.onstart = () => callbacks.onStart?.();
  utterance.onend = () => callbacks.onEnd?.();
  utterance.onerror = () => callbacks.onError?.();

  synthesizer.speak(utterance);

  return utterance;
}

export function stopJipitySpeech(): void {
  if (speechPlaybackSupported()) {
    window.speechSynthesis.cancel();
  }
}
