import OpenAI from "openai";
import { NextResponse } from "next/server";
import { COST_GOVERNOR } from "../../../../lib/cost-governor";
import {
  JIPITY_SPEECH_MODEL,
  estimateSpeechReserveUsd,
  isJipityNaturalVoice,
} from "../../../../lib/jipity-audio";
import {
  issueAuditReceipt,
  readAuthenticatedState,
  setUsageCookie,
} from "../../../../lib/jipity-security";

export const runtime = "nodejs";

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
        { error: "Jipity's voice is not configured." },
        { status: 500 },
      );
    }

    const body: unknown = await request.json();

    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { error: "Choose an approved voice and a response to read." },
        { status: 400 },
      );
    }

    const text = "text" in body && typeof body.text === "string" ? body.text : "";
    const voice = "voice" in body ? body.voice : undefined;

    if (
      text.trim().length === 0 ||
      text.length > COST_GOVERNOR.maxSpeechCharacters ||
      !isJipityNaturalVoice(voice)
    ) {
      return NextResponse.json(
        { error: "Choose an approved voice and a response shorter than 4,097 characters." },
        { status: 400 },
      );
    }

    const estimatedCostUsd = estimateSpeechReserveUsd(text.length);

    if (
      state.governor.voiceRequests >= COST_GOVERNOR.maxVoiceRequestsPerDay ||
      estimatedCostUsd > COST_GOVERNOR.maxEstimatedRequestUsd ||
      state.governor.spentUsd + estimatedCostUsd >
        COST_GOVERNOR.dailyBudgetUsd
    ) {
      return NextResponse.json(
        { error: "The daily natural-voice or session spending limit has been reached." },
        { status: 429 },
      );
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    type OpenAiSpeechVoice = Parameters<
      OpenAI["audio"]["speech"]["create"]
    >[0]["voice"];
    const audio = await client.audio.speech.create({
      model: JIPITY_SPEECH_MODEL,
      voice: voice as OpenAiSpeechVoice,
      input: text,
      instructions:
        "Speak as Jipity: warm, calm, intelligent, conversational, expressive, and natural. Use clear, relaxed Australian English. Never sound robotic.",
      response_format: "mp3",
    });
    const governor = {
      ...state.governor,
      spentUsd: Number(
        (state.governor.spentUsd + estimatedCostUsd).toFixed(6),
      ),
      voiceRequests: state.governor.voiceRequests + 1,
    };
    const auditReceipt = await issueAuditReceipt(state, {
      action: "voice_generated",
      outcome: "ok",
      model: JIPITY_SPEECH_MODEL,
      estimatedCostUsd,
    });
    const response = new NextResponse(await audio.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, no-store",
        "X-Jipity-Governor": JSON.stringify(governor),
        "X-Jipity-Estimated-Cost-Usd": estimatedCostUsd.toFixed(6),
        "X-Jipity-Audit-Receipt": auditReceipt,
      },
    });

    await setUsageCookie(response, request, { ...state, governor });

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
