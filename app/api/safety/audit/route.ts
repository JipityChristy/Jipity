import { NextResponse } from "next/server";
import {
  issueAuditReceipt,
  readAuditReceipt,
  readAuthenticatedState,
  type AuditAction,
} from "../../../../lib/jipity-security";

export const runtime = "nodejs";

const CLIENT_AUDIT_ACTIONS = new Set<AuditAction>([
  "memory_saved",
  "memory_deleted",
  "research_reused",
  "task_assessed",
  "task_blocked",
  "privacy_blocked",
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

    const body: unknown = await request.json();

    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { error: "Choose an approved activity or receipts to verify." },
        { status: 400 },
      );
    }

    if ("receipts" in body) {
      if (
        !Array.isArray(body.receipts) ||
        body.receipts.length > 100 ||
        body.receipts.some(
          (receipt: unknown) =>
            typeof receipt !== "string" || receipt.length > 2500,
        )
      ) {
        return NextResponse.json(
          { error: "Choose no more than 100 valid activity receipts." },
          { status: 400 },
        );
      }

      const receipts = await Promise.all(
        body.receipts.map((receipt: string) => readAuditReceipt(receipt)),
      );
      const verified = receipts.filter((receipt) => receipt !== null);

      return NextResponse.json({
        valid: verified.length === body.receipts.length,
        checked: body.receipts.length,
        verified: verified.length,
        invalid: body.receipts.length - verified.length,
        currentSession: verified.filter(
          (receipt) => receipt.sid === state.session.sid,
        ).length,
      });
    }

    const action = "action" in body ? body.action : undefined;
    const outcome = "outcome" in body ? body.outcome : "ok";
    const shelf = "shelf" in body ? body.shelf : undefined;

    if (
      typeof action !== "string" ||
      !CLIENT_AUDIT_ACTIONS.has(action as AuditAction) ||
      (outcome !== "ok" &&
        outcome !== "blocked" &&
        outcome !== "approval-required") ||
      (shelf !== undefined &&
        shelf !== "always" &&
        shelf !== "verified" &&
        shelf !== "working" &&
        shelf !== "review")
    ) {
      return NextResponse.json(
        { error: "That activity cannot be signed from the browser." },
        { status: 400 },
      );
    }

    const receipt = await issueAuditReceipt(state, {
      action: action as AuditAction,
      outcome,
      ...(shelf ? { shelf } : {}),
    });

    return NextResponse.json({ receipt, action, outcome });
  } catch {
    return NextResponse.json(
      { error: "The activity record could not be processed." },
      { status: 400 },
    );
  }
}
