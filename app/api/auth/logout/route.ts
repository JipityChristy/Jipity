import { NextResponse } from "next/server";
import {
  clearSessionCookies,
  issueAuditReceipt,
  readAuthenticatedState,
} from "../../../../lib/jipity-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const state = await readAuthenticatedState(request);

  if (!state) {
    return NextResponse.json(
      { error: "Private access is required." },
      { status: 401 },
    );
  }

  const auditReceipt = await issueAuditReceipt(state, {
    action: "session_locked",
    outcome: "ok",
  });
  const response = NextResponse.json({ ok: true, auditReceipt });
  clearSessionCookies(response, request);

  return response;
}
