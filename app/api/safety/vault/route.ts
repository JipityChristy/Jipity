import { NextResponse } from "next/server";
import {
  ALWAYS_REMEMBER_RULES,
  MEMORY_LIMITS,
  NEVER_REMEMBER_RULES,
} from "../../../../lib/jipity-memory";
import { GUARDED_TOOLS, TASK_LIMITS } from "../../../../lib/jipity-guardrails";
import {
  derivePrivateVaultKey,
  readAuthenticatedState,
} from "../../../../lib/jipity-security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const state = await readAuthenticatedState(request);

    if (!state) {
      return NextResponse.json(
        { error: "Private access is required." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        key: await derivePrivateVaultKey(),
        storage: "encrypted-device-only",
        algorithm: "AES-256-GCM",
        policy: {
          always: ALWAYS_REMEMBER_RULES,
          never: NEVER_REMEMBER_RULES,
        },
        limits: MEMORY_LIMITS,
        guardrails: GUARDED_TOOLS,
        taskLimits: TASK_LIMITS,
        providers: {
          openai: true,
          grokConnected: Boolean(process.env.XAI_API_KEY),
          gatewayConfigured: Boolean(process.env.AI_GATEWAY_API_KEY),
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
          Pragma: "no-cache",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Encrypted private memory is temporarily unavailable." },
      { status: 500 },
    );
  }
}
