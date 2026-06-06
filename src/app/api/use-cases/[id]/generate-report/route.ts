import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { useCases } from "@/db/schema";
import { reportGenerationRequestSchema } from "@/lib/validations";
import { generateGovernanceReportWithWorkflow } from "@/server/governance/generateGovernanceReportWorkflow";
import { validateReviewerAccessCode } from "@/server/reviewerAuth";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const numericId = Number(id);

  if (!Number.isInteger(numericId)) {
    return NextResponse.json({ error: "Invalid use case id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = reportGenerationRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid report generation request", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const authResult = validateReviewerAccessCode(parsed.data.reviewerAccessCode);

  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const proposal = db
    .select()
    .from(useCases)
    .where(eq(useCases.id, numericId))
    .get();

  if (!proposal) {
    return NextResponse.json({ error: "Use case not found" }, { status: 404 });
  }

  try {
    const result = await generateGovernanceReportWithWorkflow(proposal);

    return NextResponse.json(
      {
        reportRecord: result.reportRecord,
        report: result.report,
        analysisMode: result.analysisMode,
        fallbackReason: result.fallbackReason,
        workflowRunId: result.workflowRunId,
        workflowPath: result.workflowPath
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Governance report generation failed", error);

    return NextResponse.json(
      {
        error: "Governance report generation failed.",
        detail:
          error instanceof Error
            ? error.message
            : "An unexpected workflow error occurred."
      },
      { status: 500 }
    );
  }
}
