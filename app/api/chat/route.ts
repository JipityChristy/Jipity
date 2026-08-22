import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  COST_GOVERNOR,
  MODEL_CONFIG,
  estimateCostUsd,
  type JipityMode,
} from "../../../lib/cost-governor";
import { JIPITY_INSTRUCTIONS } from "../../../lib/jipity-prompt";
import {
  readAuthenticatedState,
  setUsageCookie,
} from "../../../lib/jipity-security";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const state = await readAuthenticatedState(req);

    if (!state) {
      return NextResponse.json(
        { error: "Private access is required." },
        { status: 401 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 },
      );
    }

    const body = await req.json();
    const mode: JipityMode =
      body?.mode === "deep" || body?.mode === "spiritual"
        ? body.mode
        : "standard";
    const config = MODEL_CONFIG[mode];
    const messages = Array.isArray(body?.messages)
      ? body.messages.slice(-COST_GOVERNOR.maxMessages)
      : [];

    const input = messages
      .filter(
        (message: unknown): message is { role: string; content: string } =>
          typeof message === "object" &&
          message !== null &&
          "role" in message &&
          "content" in message &&
          (message.role === "assistant" || message.role === "user") &&
          typeof message.content === "string" &&
          message.content.trim().length > 0,
      )
      .map(
        (message: { role: string; content: string }) =>
          `${message.role === "assistant" ? "JIPITY" : "CHRISTY"}: ${message.content.slice(0, COST_GOVERNOR.maxMessageCharacters)}`,
      )
      .join("\n\n")
      .slice(-COST_GOVERNOR.maxInputCharacters);

    if (!input) {
      return NextResponse.json(
        { error: "Please enter a message before contacting Jipity." },
        { status: 400 },
      );
    }

    const { spentUsd, requests, spiritualRequests, deepRequests } =
      state.governor;
    const estimatedInputTokens = Math.ceil(
      (JIPITY_INSTRUCTIONS.length + input.length) / 2,
    );
    const maximumEstimatedCostUsd = estimateCostUsd(
      mode,
      estimatedInputTokens,
      config.maxOutputTokens,
    );

    if (
      requests >= COST_GOVERNOR.maxRequestsPerDay ||
      (mode === "spiritual" &&
        spiritualRequests >= COST_GOVERNOR.maxSpiritualRequestsPerDay) ||
      (mode === "deep" &&
        deepRequests >= COST_GOVERNOR.maxDeepRequestsPerDay) ||
      maximumEstimatedCostUsd > COST_GOVERNOR.maxEstimatedRequestUsd ||
      spentUsd + maximumEstimatedCostUsd > COST_GOVERNOR.dailyBudgetUsd
    ) {
      return NextResponse.json(
        { error: "The Jipity cost governor has reached its daily safety limit." },
        { status: 429 },
      );
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const reasoning =
      mode === "deep"
        ? { effort: "high" as const }
        : mode === "standard"
          ? { effort: "minimal" as const }
          : undefined;
    const response = await client.responses.create({
      model: config.model,
      instructions: JIPITY_INSTRUCTIONS,
      input,
      max_output_tokens: config.maxOutputTokens,
      ...(reasoning ? { reasoning } : {}),
    });

    const inputTokens = response.usage?.input_tokens ?? estimatedInputTokens;
    const outputTokens =
      response.usage?.output_tokens ?? config.maxOutputTokens;
    const estimatedCostUsd = estimateCostUsd(
      mode,
      inputTokens,
      outputTokens,
    );
    const governor = {
      ...state.governor,
      spentUsd: Number((state.governor.spentUsd + estimatedCostUsd).toFixed(6)),
      requests: state.governor.requests + 1,
      spiritualRequests:
        state.governor.spiritualRequests + (mode === "spiritual" ? 1 : 0),
      deepRequests:
        state.governor.deepRequests + (mode === "deep" ? 1 : 0),
    };
    const result = NextResponse.json({
      text: response.output_text || "I didn't get a usable response that time.",
      mode,
      model: response.model || config.model,
      usage: {
        inputTokens,
        outputTokens,
        estimatedCostUsd,
      },
      governor,
    });

    await setUsageCookie(result, req, { ...state, governor });

    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
