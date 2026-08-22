import { NextResponse } from "next/server";
import {
  clearSessionCookies,
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

  const response = NextResponse.json({ ok: true });
  clearSessionCookies(response, request);

  return response;
}
