import { NextResponse } from "next/server";
import {
  readAuthenticatedState,
  setUsageCookie,
} from "../../../../lib/jipity-security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const state = await readAuthenticatedState(request);

  if (!state) {
    return NextResponse.json(
      { error: "Private access is required." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({
    authenticated: true,
    governor: state.governor,
  });

  await setUsageCookie(response, request, state);

  return response;
}
