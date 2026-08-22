import { NextResponse } from "next/server";
import { assessTask } from "../../../../lib/jipity-guardrails";
import {
  issueAuditReceipt,
  readAuthenticatedState,
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

    const body: unknown = await request.json();
    const description =
      typeof body === "object" &&
      body !== null &&
      "description" in body &&
      typeof body.description === "string"
        ? body.description
        : "";
    const assessment = assessTask(description);
    const receipt = await issueAuditReceipt(state, {
      action: assessment.outcome === "blocked" ? "task_blocked" : "task_assessed",
      outcome:
        assessment.outcome === "ready-for-review"
          ? "ok"
          : assessment.outcome,
    });

    return NextResponse.json({ assessment, receipt });
  } catch {
    return NextResponse.json(
      { error: "The task could not be checked safely." },
      { status: 400 },
    );
  }
}
