import { NextResponse } from "next/server";
import {
  createSession,
  issueAuditReceipt,
  setSessionCookies,
  verifyAccessCode,
} from "../../../../lib/jipity-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const accessCode =
      typeof body === "object" &&
      body !== null &&
      "accessCode" in body &&
      typeof body.accessCode === "string"
        ? body.accessCode.trim()
        : "";

    if (!(await verifyAccessCode(accessCode))) {
      return NextResponse.json(
        { error: "That private access code is not correct." },
        { status: 401 },
      );
    }

    const state = await createSession(request);
    const auditReceipt = await issueAuditReceipt(state, {
      action: state.deviceId ? "spend_guard_restored" : "session_started",
      outcome: "ok",
    });
    const response = NextResponse.json({
      ok: true,
      governor: state.governor,
      auditReceipt,
      deviceGuardRestored: Boolean(state.deviceId),
    });

    await setSessionCookies(response, request, state);

    return response;
  } catch {
    return NextResponse.json(
      { error: "Private access is temporarily unavailable." },
      { status: 500 },
    );
  }
}
