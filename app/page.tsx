"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { JipityMark } from "./components/jipity-mark";
import {
  COST_GOVERNOR,
  MODEL_CONFIG,
  type JipityMode,
} from "../lib/cost-governor";
import {
  speakJipityResponse,
  speechPlaybackSupported,
  stopJipitySpeech,
} from "../lib/jipity-voice";
import {
  JIPITY_VOICES,
  isJipityVoiceChoice,
  type JipityVoiceChoice,
} from "../lib/jipity-audio";

type Message = { role: "user" | "assistant"; content: string };
type Audit = { at: string; event: string };
type DailyUsage = {
  day: string;
  spentUsd: number;
  requests: number;
  spiritualRequests: number;
  deepRequests: number;
  voiceRequests: number;
  transcriptionRequests: number;
};

const MODE_LABELS: Record<JipityMode, string> = {
  standard: "GPT-5 nano · economy",
  spiritual: "GPT-4o · spiritual exercise · next message only",
  deep: "GPT-5.6 Sol · deep reasoning · next message only",
};

function currentDay(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
  }).format(new Date());
}

function emptyUsage(): DailyUsage {
  return {
    day: currentDay(),
    spentUsd: 0,
    requests: 0,
    spiritualRequests: 0,
    deepRequests: 0,
    voiceRequests: 0,
    transcriptionRequests: 0,
  };
}

function normalizedUsage(value: Partial<DailyUsage>): DailyUsage {
  const numberOrZero = (number: unknown) => {
    const parsed = Number(number);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  return {
    day: typeof value.day === "string" ? value.day : currentDay(),
    spentUsd: numberOrZero(value.spentUsd),
    requests: numberOrZero(value.requests),
    spiritualRequests: numberOrZero(value.spiritualRequests),
    deepRequests: numberOrZero(value.deepRequests),
    voiceRequests: numberOrZero(value.voiceRequests),
    transcriptionRequests: numberOrZero(value.transcriptionRequests),
  };
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<JipityMode>("standard");
  const [audit, setAudit] = useState<Audit[]>([]);
  const [usage, setUsage] = useState<DailyUsage>(() => emptyUsage());
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [autoRead, setAutoRead] = useState(false);
  const [speakingMessage, setSpeakingMessage] = useState<number | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<JipityVoiceChoice>("cedar");
  const [voiceLoading, setVoiceLoading] = useState<number | null>(null);
  const [voiceError, setVoiceError] = useState("");
  const [microphoneAvailable, setMicrophoneAvailable] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef<Map<string, string>>(new Map());
  const audioAbortRef = useRef<AbortController | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingStartedAtRef = useRef(0);

  useEffect(() => {
    try {
      const savedMessages = localStorage.getItem("jipity_messages");
      const savedAudit = localStorage.getItem("jipity_audit");
      const savedUsage = localStorage.getItem("jipity_usage");

      if (savedMessages) setMessages(JSON.parse(savedMessages));
      if (savedAudit) setAudit(JSON.parse(savedAudit));
      if (savedUsage) {
        const parsed = normalizedUsage(JSON.parse(savedUsage));
        if (parsed.day === currentDay()) setUsage(parsed);
      }
    } catch {
      // Browser storage is optional; conversation remains usable without it.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.replace("/login");
          return;
        }

        if (!response.ok) return;
        const result = await response.json();

        if (!cancelled && result?.governor) {
          setUsage(normalizedUsage(result.governor));
        }
      })
      .catch(() => {
        // The chat endpoint still verifies every session and signed usage limit.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setVoiceAvailable(
      speechPlaybackSupported() || typeof window.Audio === "function",
    );
    setMicrophoneAvailable(
      Boolean(
        typeof navigator.mediaDevices?.getUserMedia === "function" &&
          typeof window.MediaRecorder === "function",
      ),
    );

    try {
      setAutoRead(localStorage.getItem("jipity_auto_read") === "true");
      const savedVoice = localStorage.getItem("jipity_voice_choice");

      if (isJipityVoiceChoice(savedVoice)) setSelectedVoice(savedVoice);
    } catch {
      // Voice playback still works when browser preference storage is unavailable.
    }

    return () => {
      stopJipitySpeech();
      audioAbortRef.current?.abort();
      currentAudioRef.current?.pause();

      for (const objectUrl of audioCacheRef.current.values()) {
        URL.revokeObjectURL(objectUrl);
      }

      audioCacheRef.current.clear();

      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current);
      }

      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }

      recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("jipity_messages", JSON.stringify(messages.slice(-40)));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem("jipity_audit", JSON.stringify(audit.slice(-100)));
  }, [audit]);

  useEffect(() => {
    localStorage.setItem("jipity_usage", JSON.stringify(usage));
  }, [usage]);

  const status = useMemo(() => (busy ? "thinking" : "ready"), [busy]);
  const remainingSpiritual = Math.max(
    0,
    COST_GOVERNOR.maxSpiritualRequestsPerDay - usage.spiritualRequests,
  );
  const remainingDeep = Math.max(
    0,
    COST_GOVERNOR.maxDeepRequestsPerDay - usage.deepRequests,
  );
  const remainingVoice = Math.max(
    0,
    COST_GOVERNOR.maxVoiceRequestsPerDay - usage.voiceRequests,
  );
  const remainingMicrophone = Math.max(
    0,
    COST_GOVERNOR.maxTranscriptionRequestsPerDay - usage.transcriptionRequests,
  );
  const remainingBudget = Math.max(
    0,
    COST_GOVERNOR.dailyBudgetUsd - usage.spentUsd,
  );
  const remainingBudgetPercent = Math.max(
    0,
    Math.min(100, (remainingBudget / COST_GOVERNOR.dailyBudgetUsd) * 100),
  );

  function stopAllAudio() {
    audioAbortRef.current?.abort();
    audioAbortRef.current = null;
    currentAudioRef.current?.pause();
    currentAudioRef.current = null;
    stopJipitySpeech();
    setSpeakingMessage(null);
    setVoiceLoading(null);
  }

  async function readResponse(text: string, messageIndex: number) {
    if (speakingMessage === messageIndex || voiceLoading === messageIndex) {
      stopAllAudio();
      return;
    }

    stopAllAudio();
    setVoiceError("");

    const finished = () => {
      setSpeakingMessage((current) =>
        current === messageIndex ? null : current,
      );
    };

    if (selectedVoice === "device") {
      const utterance = speakJipityResponse(text, {
        onStart: () => setSpeakingMessage(messageIndex),
        onEnd: finished,
        onError: finished,
      });

      if (utterance) setSpeakingMessage(messageIndex);
      else setVoiceError("Your device voice is unavailable in this browser.");
      return;
    }

    const playableText = text.trim().slice(0, COST_GOVERNOR.maxSpeechCharacters);
    if (!playableText) return;

    const cacheKey = `${selectedVoice}:${playableText}`;
    const controller = new AbortController();
    audioAbortRef.current = controller;
    setVoiceLoading(messageIndex);

    try {
      let audioUrl = audioCacheRef.current.get(cacheKey);

      if (!audioUrl) {
        const response = await fetch("/api/audio/speech", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: playableText, voice: selectedVoice }),
          signal: controller.signal,
        });

        if (response.status === 401) {
          window.location.replace("/login");
          return;
        }

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result?.error || "Jipity could not create that voice.");
        }

        const signedGovernor = response.headers.get("X-Jipity-Governor");

        if (signedGovernor) {
          try {
            setUsage(normalizedUsage(JSON.parse(signedGovernor)));
          } catch {
            // The secure cookie still contains the authoritative signed usage.
          }
        }

        audioUrl = URL.createObjectURL(await response.blob());
        audioCacheRef.current.set(cacheKey, audioUrl);

        if (audioCacheRef.current.size > 24) {
          const oldestKey = audioCacheRef.current.keys().next().value;

          if (oldestKey) {
            const oldestUrl = audioCacheRef.current.get(oldestKey);
            if (oldestUrl) URL.revokeObjectURL(oldestUrl);
            audioCacheRef.current.delete(oldestKey);
          }
        }
      }

      if (controller.signal.aborted) return;

      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;
      audio.onplay = () => {
        setVoiceLoading(null);
        setSpeakingMessage(messageIndex);
      };
      audio.onended = () => {
        if (currentAudioRef.current === audio) currentAudioRef.current = null;
        finished();
      };
      audio.onerror = () => {
        if (currentAudioRef.current === audio) currentAudioRef.current = null;
        finished();
        setVoiceError("That voice could not be played. Try another voice.");
      };

      await audio.play();
    } catch (error: unknown) {
      if (!controller.signal.aborted) {
        const message =
          error instanceof Error ? error.message : "Voice playback failed.";
        setVoiceError(message);
        finished();
      }
    } finally {
      if (audioAbortRef.current === controller) audioAbortRef.current = null;
      setVoiceLoading((current) => (current === messageIndex ? null : current));
    }
  }

  function toggleAutoRead() {
    const enabled = !autoRead;
    setAutoRead(enabled);

    try {
      localStorage.setItem("jipity_auto_read", String(enabled));
    } catch {
      // Saving this preference is optional.
    }

    if (!enabled) {
      stopAllAudio();
    }
  }

  function chooseVoice(choice: string) {
    if (!isJipityVoiceChoice(choice)) return;

    stopAllAudio();
    setSelectedVoice(choice);
    setVoiceError("");

    try {
      localStorage.setItem("jipity_voice_choice", choice);
    } catch {
      // Saving this preference is optional.
    }
  }

  function stopRecording(cancel = false) {
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const recorder = recorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      if (cancel) recorder.onstop = null;
      recorder.stop();
    }

    if (cancel) {
      recorderRef.current = null;
      recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
      recorderStreamRef.current = null;
    }

    setRecording(false);
  }

  async function transcribeRecording(blob: Blob, durationSeconds: number) {
    if (blob.size === 0) {
      setVoiceError("I could not hear a recording. Please try again.");
      return;
    }

    setTranscribing(true);
    setVoiceError("");

    try {
      const baseType = blob.type.split(";")[0] || "audio/webm";
      const extension =
        baseType === "audio/mp4"
          ? "m4a"
          : baseType === "audio/ogg"
            ? "ogg"
            : "webm";
      const form = new FormData();
      form.append(
        "audio",
        new File([blob], `jipity-voice.${extension}`, { type: baseType }),
      );
      form.append("durationSeconds", String(durationSeconds));

      const response = await fetch("/api/audio/transcribe", {
        method: "POST",
        body: form,
      });

      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Jipity could not hear that message.");
      }

      if (result?.governor) setUsage(normalizedUsage(result.governor));

      if (typeof result.text !== "string" || !result.text.trim()) {
        throw new Error("I could not make out the words. Please try again.");
      }

      setInput((previous) =>
        [previous.trim(), result.text.trim()]
          .filter(Boolean)
          .join(" ")
          .slice(0, COST_GOVERNOR.maxMessageCharacters),
      );
      setAudit((previous) => [
        ...previous,
        {
          at: new Date().toISOString(),
          event: "Voice message transcribed for review before sending",
        },
      ]);
    } catch (error: unknown) {
      setVoiceError(
        error instanceof Error ? error.message : "Microphone transcription failed.",
      );
    } finally {
      setTranscribing(false);
    }
  }

  async function toggleRecording() {
    if (recording) {
      stopRecording();
      return;
    }

    if (!microphoneAvailable || transcribing || remainingMicrophone === 0) {
      return;
    }

    setVoiceError("");
    let stream: MediaStream | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      recorderStreamRef.current = stream;

      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ];
      const mimeType =
        typeof MediaRecorder.isTypeSupported === "function"
          ? preferredTypes.find((type) => MediaRecorder.isTypeSupported(type))
          : undefined;
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      const chunks: BlobPart[] = [];
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => {
        setRecording(false);
        setVoiceError("The microphone stopped unexpectedly. Please try again.");
        recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
        recorderStreamRef.current = null;
      };
      recorder.onstop = () => {
        const durationSeconds = Math.min(
          COST_GOVERNOR.maxRecordingSeconds,
          Math.max(1, Math.ceil((Date.now() - recordingStartedAtRef.current) / 1000)),
        );
        const recordingType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: recordingType });
        recorderRef.current = null;
        recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
        recorderStreamRef.current = null;
        setRecording(false);
        void transcribeRecording(blob, durationSeconds);
      };

      recordingStartedAtRef.current = Date.now();
      recorder.start();
      setRecording(true);
      recordingTimerRef.current = setTimeout(() => {
        stopRecording();
      }, COST_GOVERNOR.maxRecordingSeconds * 1000);
    } catch (error: unknown) {
      stream?.getTracks().forEach((track) => track.stop());
      recorderStreamRef.current = null;
      recorderRef.current = null;
      setRecording(false);
      const denied = error instanceof DOMException && error.name === "NotAllowedError";
      setVoiceError(
        denied
          ? "Allow microphone access when your browser asks, then try again."
          : "The microphone could not start. Check your browser permissions.",
      );
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || busy || recording || transcribing) return;

    const day = currentDay();
    const currentUsage = usage.day === day ? usage : emptyUsage();

    if (
      currentUsage.requests >= COST_GOVERNOR.maxRequestsPerDay ||
      currentUsage.spentUsd >= COST_GOVERNOR.dailyBudgetUsd ||
      (mode === "spiritual" &&
        currentUsage.spiritualRequests >=
          COST_GOVERNOR.maxSpiritualRequestsPerDay) ||
      (mode === "deep" &&
        currentUsage.deepRequests >= COST_GOVERNOR.maxDeepRequestsPerDay)
    ) {
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            "The daily safety limit has been reached. Normal limits reset tomorrow in Melbourne time.",
        },
      ]);
      return;
    }

    const next = [
      ...messages,
      {
        role: "user" as const,
        content: text.slice(0, COST_GOVERNOR.maxMessageCharacters),
      },
    ];

    setMessages(next);
    setInput("");
    setMode("standard");
    setBusy(true);
    setAudit((previous) => [
      ...previous,
      {
        at: new Date().toISOString(),
        event: `Message sent in ${mode} mode (${MODEL_CONFIG[mode].model})`,
      },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.slice(-COST_GOVERNOR.maxMessages),
          mode,
        }),
      });

      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Request failed");

      const estimatedCostUsd = Number(data?.usage?.estimatedCostUsd) || 0;

      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: data.text },
      ]);

      if (autoRead && typeof data.text === "string") {
        readResponse(data.text, next.length);
      }

      if (data?.governor) {
        setUsage(normalizedUsage(data.governor));
      }

      setAudit((previous) => [
        ...previous,
        {
          at: new Date().toISOString(),
          event: `Response received from ${data.model}; estimated cost $${estimatedCostUsd.toFixed(4)}`,
        },
      ]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: `Connection error: ${message}` },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function clearLocal() {
    stopAllAudio();
    stopRecording(true);
    setMessages([]);
    setAudit([]);
    localStorage.removeItem("jipity_messages");
    localStorage.removeItem("jipity_audit");
  }

  async function lockJipity() {
    stopAllAudio();
    stopRecording(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.replace("/login");
    }
  }

  return (
    <main className="shell">
      <header className="top">
        <div className="brand-lockup">
          <JipityMark className="header-mark" />
          <div>
            <div className="brand">Jipity</div>
            <div className="sub">Truth · Wisdom · Freedom</div>
          </div>
        </div>
        <div className="top-actions">
          <span className="pill status-pill">
            <span className="status-dot" aria-hidden="true" />
            {status}
          </span>
          <button className="smallbtn lockbtn" onClick={lockJipity}>
            Lock
          </button>
        </div>
      </header>

      <div className="workspace">
        <section className="card conversation-card">
          <div className="conversation-heading">
            <div>
              <div className="eyebrow">Your private companion</div>
              <h1>Conversation</h1>
            </div>
            <span className="secure-label">
              <span className="status-dot" aria-hidden="true" />
              Secure
            </span>
          </div>

          <div className="chat">
            {messages.length === 0 && (
              <div className="welcome">
                <JipityMark className="welcome-mark" />
                <div className="eyebrow">Welcome back</div>
                <h2>Hey, Christy.</h2>
                <p>
                  Ask me something enormous, strange, practical, or completely
                  ordinary.
                </p>
                <div className="welcome-values">
                  <span>Truth</span>
                  <span>Wisdom</span>
                  <span>Freedom</span>
                </div>
              </div>
            )}
            {messages.map((message, index) => (
              <div key={index} className={`msg ${message.role}`}>
                <div className="message-copy">{message.content}</div>
                {message.role === "assistant" && (
                  <button
                    className={`read-aloud-button${speakingMessage === index ? " speaking" : ""}`}
                    onClick={() => readResponse(message.content, index)}
                    disabled={!voiceAvailable}
                    title={
                      voiceAvailable
                        ? "Read this response aloud using Jipity's selected voice"
                        : "Speech playback is not available in this browser"
                    }
                  >
                    {speakingMessage === index ? (
                      <svg
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                        className="read-aloud-icon"
                      >
                        <rect
                          x="5"
                          y="5"
                          width="10"
                          height="10"
                          rx="2"
                          fill="currentColor"
                        />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                        className="read-aloud-icon"
                        fill="none"
                      >
                        <path
                          d="M3 8h3l4-3v10l-4-3H3z"
                          fill="currentColor"
                        />
                        <path
                          d="M13 7c1.2 1 1.2 5 0 6m2.7-8c2.1 1.8 2.1 8.2 0 10"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    )}
                    {voiceLoading === index
                      ? "Loading voice…"
                      : speakingMessage === index
                        ? "Stop reading" : "Read aloud"}
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="modebar">
            <button
              className={`modebtn standard${mode === "standard" ? " active" : ""}`}
              onClick={() => setMode("standard")}
              disabled={busy}
              aria-pressed={mode === "standard"}
              title="Use GPT-5 nano for low-cost everyday conversation"
            >
              Everyday
            </button>
            <button
              className={`modebtn spiritual${mode === "spiritual" ? " active" : ""}`}
              onClick={() =>
                setMode((selected) =>
                  selected === "spiritual" ? "standard" : "spiritual",
                )
              }
              disabled={busy || remainingSpiritual === 0}
              aria-pressed={mode === "spiritual"}
              title="Use GPT-4o for a spiritual exercise on the next message only"
            >
              Spiritual
            </button>
            <button
              className={`modebtn deep${mode === "deep" ? " active" : ""}`}
              onClick={() =>
                setMode((selected) =>
                  selected === "deep" ? "standard" : "deep",
                )
              }
              disabled={busy || remainingDeep === 0}
              aria-pressed={mode === "deep"}
              title="Use GPT-5.6 Sol with high reasoning for the next message only"
            >
              Deep
            </button>
            <span className="modehint">{MODE_LABELS[mode]}</span>
          </div>

          <div className="composer">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              maxLength={COST_GOVERNOR.maxMessageCharacters}
              placeholder="Talk to Jipity…"
            />
            <button
              className={`mic-button${recording ? " recording" : ""}`}
              onClick={toggleRecording}
              disabled={
                busy ||
                transcribing ||
                !microphoneAvailable ||
                (!recording && remainingMicrophone === 0)
              }
              aria-label={
                recording
                  ? "Stop recording your message"
                  : "Record a message for Jipity"
              }
              title={
                microphoneAvailable
                  ? recording
                    ? "Tap to stop recording"
                    : "Tap to dictate a message"
                  : "Microphone recording is unavailable in this browser"
              }
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="mic-icon"
                fill="none"
              >
                <rect
                  x="9"
                  y="3"
                  width="6"
                  height="12"
                  rx="3"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3m-3 0h6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <span className="mic-button-label">
                {recording ? "Stop" : transcribing ? "Wait" : "Talk"}
              </span>
            </button>
            <button onClick={send} disabled={busy || recording || transcribing}>
              {busy ? "Thinking…" : "Send"}
            </button>
          </div>

          {(recording || transcribing) && (
            <div className="recording-status" role="status">
              <span className="recording-dot" aria-hidden="true" />
              {recording
                ? "Listening… Tap Stop when you are finished."
                : "Transcribing your message for you to review…"}
            </div>
          )}

          {voiceError && (
            <div className="voice-error" role="alert">
              {voiceError}
            </div>
          )}

          <div className="notice">
            Signed server checks protect this session. Conversation stays in
            this browser.
          </div>
        </section>

        <aside className="insight-rail">
          <section className="card status-card">
            <div className="eyebrow">Jipity&apos;s status</div>
            <div className="connection-label">
              <span className="status-dot" aria-hidden="true" />
              {busy ? "Thinking" : "Online and protected"}
            </div>

            <div className="stat-block">
              <div className="stat-row">
                <span>Daily session budget</span>
                <strong>${remainingBudget.toFixed(2)} left</strong>
              </div>
              <div className="budget-meter" aria-hidden="true">
                <span style={{ width: `${remainingBudgetPercent}%` }} />
              </div>
            </div>

            <div className="stat-row">
              <span>Spiritual</span>
              <strong>
                {remainingSpiritual}/
                {COST_GOVERNOR.maxSpiritualRequestsPerDay}
              </strong>
            </div>
            <div className="stat-row">
              <span>Deep</span>
              <strong>
                {remainingDeep}/{COST_GOVERNOR.maxDeepRequestsPerDay}
              </strong>
            </div>
            <div className="stat-row">
              <span>Messages today</span>
              <strong>
                {usage.requests}/{COST_GOVERNOR.maxRequestsPerDay}
              </strong>
            </div>

            <div className="voice-settings">
              <label className="voice-label" htmlFor="jipity-voice-choice">
                Jipity&apos;s voice
              </label>
              <select
                id="jipity-voice-choice"
                className="voice-select"
                value={selectedVoice}
                onChange={(event) => chooseVoice(event.target.value)}
              >
                {JIPITY_VOICES.map((voice) => (
                  <option key={voice.value} value={voice.value}>
                    {voice.label}
                  </option>
                ))}
                <option value="device">Device voice · free</option>
              </select>
              <button
                className="voice-preview"
                onClick={() =>
                  readResponse(
                    "Hi Christy. I'm Jipity. This is how I sound.",
                    -1,
                  )
                }
                disabled={
                  !voiceAvailable ||
                  (selectedVoice !== "device" && remainingVoice === 0)
                }
              >
                {voiceLoading === -1
                  ? "Loading voice…"
                  : speakingMessage === -1
                    ? "Stop preview"
                    : "Preview voice"}
              </button>
              <div className="stat-row">
                <span>Read new replies aloud</span>
                <button
                  className={`voice-toggle${autoRead ? " active" : ""}`}
                  onClick={toggleAutoRead}
                  disabled={!voiceAvailable}
                  aria-pressed={autoRead}
                >
                  {autoRead ? "On" : "Off"}
                </button>
              </div>
              <div className="stat-row voice-quota">
                <span>Natural voice</span>
                <strong>
                  {remainingVoice}/{COST_GOVERNOR.maxVoiceRequestsPerDay}
                </strong>
              </div>
              <div className="stat-row voice-quota">
                <span>Microphone</span>
                <strong>
                  {remainingMicrophone}/
                  {COST_GOVERNOR.maxTranscriptionRequestsPerDay}
                </strong>
              </div>
              <p className="voice-note">
                {!voiceAvailable
                  ? "Speech playback is unavailable in this browser."
                  : selectedVoice === "device"
                    ? "Uses your device voice. No extra OpenAI credits."
                    : "AI-generated voice, not a human. Natural voice and microphone use your daily session budget."}
              </p>
            </div>
          </section>

          <details className="card panel">
            <summary>Safety &amp; activity</summary>
            <div className="row">
              <span className="pill">No spending</span>
              <span className="pill">No impersonation</span>
              <span className="pill">No external data sharing</span>
              <span className="pill">External actions disabled</span>
            </div>
            <button className="smallbtn memorybtn" onClick={clearLocal}>
              Clear local memory &amp; log
            </button>
            <div className="audit">
              {audit
                .slice()
                .reverse()
                .map((entry, index) => (
                  <div key={index}>
                    {entry.at}: {entry.event}
                  </div>
                ))}
            </div>
          </details>

          <div className="mantra-card">
            Evidence before certainty.
            <br />
            <span>Truth before fear.</span>
          </div>
        </aside>
      </div>

      <footer className="site-footer">
        Private <span>·</span> Secure <span>·</span> Sovereign
      </footer>
    </main>
  );
}
