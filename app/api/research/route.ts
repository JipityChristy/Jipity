import { NextResponse } from "next/server";
import { COST_GOVERNOR } from "../../../lib/cost-governor";
import {
  PUBLIC_RESEARCH_PROVIDERS,
  formatPublicResearchAnswer,
  screenPublicResearchQuery,
  searchApprovedPublicSources,
} from "../../../lib/jipity-research";
import {
  issueAuditReceipt,
  issueResearchApproval,
  readAuthenticatedState,
  setUsageCookie,
  verifyResearchApproval,
  type AuthenticatedState,
} from "../../../lib/jipity-security";

export const runtime = "nodejs";

async function rejected(
  state: AuthenticatedState,
  error: string,
  status: number,
  privacy = false,
) {
  const auditReceipt = await issueAuditReceipt(state, {
    action: privacy ? "privacy_blocked" : "research_blocked",
    outcome: "blocked",
    estimatedCostUsd: 0,
  });

  return NextResponse.json(
    { error, auditReceipt },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  let state: AuthenticatedState | null = null;

  try {
    state = await readAuthenticatedState(request);

    if (!state) {
      return NextResponse.json(
        { error: "Private access is required." },
        { status: 401 },
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return rejected(state, "Choose a public research topic to review first.", 400);
    }

    if (typeof body !== "object" || body === null) {
      return rejected(state, "Choose a public research topic to review first.", 400);
    }

    const action = "action" in body ? body.action : undefined;
    const screened = screenPublicResearchQuery("query" in body ? body.query : null);

    if (!screened.allowed) {
      return rejected(
        state,
        screened.reasons.join(" ") || "That research query is not public-safe.",
        400,
        true,
      );
    }

    if (
      state.governor.researchRequests >=
      COST_GOVERNOR.maxPublicResearchRequestsPerDay
    ) {
      return rejected(
        state,
        "The signed daily free-research allowance has been reached.",
        429,
      );
    }

    if (action === "review") {
      const approval = await issueResearchApproval(state, screened.query);
      const auditReceipt = await issueAuditReceipt(state, {
        action: "research_reviewed",
        outcome: "approval-required",
        estimatedCostUsd: 0,
      });

      return NextResponse.json(
        {
          query: screened.query,
          approvalToken: approval.token,
          expiresAt: approval.expiresAt,
          providers: PUBLIC_RESEARCH_PROVIDERS,
          estimatedCostUsd: 0,
          searchesRemaining:
            COST_GOVERNOR.maxPublicResearchRequestsPerDay -
            state.governor.researchRequests,
          auditReceipt,
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }

    if (
      action !== "search" ||
      !("approved" in body) ||
      body.approved !== true ||
      !("approvalToken" in body) ||
      !(await verifyResearchApproval(
        state,
        body.approvalToken,
        screened.query,
      ))
    ) {
      return rejected(
        state,
        "Approve this exact public research query before anything is searched.",
        403,
      );
    }

    const result = await searchApprovedPublicSources(screened.query);
    const governor = {
      ...state.governor,
      researchRequests: state.governor.researchRequests + 1,
    };
    const auditReceipt = await issueAuditReceipt(state, {
      action: "research_completed",
      outcome: "ok",
      model: "public-source-research",
      estimatedCostUsd: 0,
    });
    const response = NextResponse.json(
      {
        query: screened.query,
        sources: result.sources,
        providers: result.providers,
        answer: formatPublicResearchAnswer(result.sources),
        governor,
        estimatedCostUsd: 0,
        searchesRemaining:
          COST_GOVERNOR.maxPublicResearchRequestsPerDay -
          governor.researchRequests,
        auditReceipt,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );

    await setUsageCookie(response, request, { ...state, governor });
    return response;
  } catch {
    if (state) {
      try {
        return await rejected(
          state,
          "Free public sources are temporarily unavailable. No AI model was used.",
          502,
        );
      } catch {
        // Do not expose request details if signed logging is unavailable.
      }
    }

    return NextResponse.json(
      { error: "Public research is temporarily unavailable." },
      { status: 502 },
    );
  }
}
