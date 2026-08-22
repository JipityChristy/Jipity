import OpenAI from "openai";
import { NextResponse } from "next/server";
import { COST_GOVERNOR } from "../../../../lib/cost-governor";
import {
  JIPITY_TRANSCRIPTION_MODEL,
  estimateTranscriptionReserveUsd,
} from "../../../../lib/jipity-audio";
import {
  issueAuditReceipt,
  readAuthenticatedState,
  setUsageCookie,
} from "../../../../lib/jipity-security";

export const runtime = "nodejs";

const ALLOWED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "audio/mpeg",
  "audio/x-m4a",
]);

export async function POST(request: Request) {
  try {
    const state = await readAuthenticatedState(request);

    if (!state) {
      return NextResponse.json(
        { error: "Private access is required." },
        { status: 401 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Jipity's microphone is not configured." },
        { status: 500 },
      );
    }

    const form = await request.formData();
    const audio = form.get("audio");
    const durationSeconds = Number(form.get("durationSeconds"));

    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json(
        { error: "Record a short voice message first." },
        { status: 400 },
      );
    }

    if (audio.size > COST_GOVERNOR.maxAudioBytes) {
      return NextResponse.json(
        { error: "The voice recording is too large." },
        { status: 413 },
      );
    }

    const mimeType = audio.type.split(";")[0].trim().toLowerCase();

    if (
      !ALLOWED_AUDIO_TYPES.has(mimeType) ||
      !Number.isFinite(durationSeconds) ||
      durationSeconds < 1 ||
      durationSeconds > COST_GOVERNOR.maxRecordingSeconds
    ) {
      return NextResponse.json(
        { error: "Use a supported audio format and record for one minute or less." },
        { status: 400 },
      );
    }

    const estimatedCostUsd = estimateTranscriptionReserveUsd(
      COST_GOVERNOR.maxRecordingSeconds,
    );

    if (
      state.governor.transcriptionRequests >=
        COST_GOVERNOR.maxTranscriptionRequestsPerDay ||
      estimatedCostUsd > COST_GOVERNOR.maxEstimatedRequestUsd ||
      state.governor.spentUsd + estimatedCostUsd >
        COST_GOVERNOR.dailyBudgetUsd
    ) {
      const auditReceipt = await issueAuditReceipt(state, {
        action: "budget_blocked",
        outcome: "blocked",
        model: JIPITY_TRANSCRIPTION_MODEL,
        estimatedCostUsd,
      });
      return NextResponse.json(
        {
          error: "The daily microphone or session spending limit has been reached.",
          auditReceipt,
        },
        { status: 429 },
      );
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const transcript = await client.audio.transcriptions.create({
      model: JIPITY_TRANSCRIPTION_MODEL,
      file: audio,
      language: "en",
      prompt: "Australian English. Spell the assistant's name Jipity.",
    });
    const governor = {
      ...state.governor,
      spentUsd: Number(
        (state.governor.spentUsd + estimatedCostUsd).toFixed(6),
      ),
      transcriptionRequests: state.governor.transcriptionRequests + 1,
    };
    const auditReceipt = await issueAuditReceipt(state, {
      action: "voice_transcribed",
      outcome: "ok",
      model: JIPITY_TRANSCRIPTION_MODEL,
      estimatedCostUsd,
    });
    const response = NextResponse.json({
      text: transcript.text.trim().slice(0, COST_GOVERNOR.maxMessageCharacters),
      governor,
      usage: { estimatedCostUsd },
      auditReceipt,
    });

    await setUsageCookie(response, request, { ...state, governor });

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
