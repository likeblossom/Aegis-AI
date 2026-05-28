import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, useCases } from "@/db/schema";
import { DEFAULT_USE_CASE_STATUS } from "@/lib/constants";
import { createUseCaseSchema } from "@/lib/validations";

export const runtime = "nodejs";

export async function GET() {
  const proposals = db.select().from(useCases).orderBy(desc(useCases.createdAt)).all();
  return NextResponse.json(proposals);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createUseCaseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const created = db
    .insert(useCases)
    .values({
      ...parsed.data,
      status: DEFAULT_USE_CASE_STATUS
    })
    .returning()
    .get();

  db.insert(auditLogs)
    .values({
      useCaseId: created.id,
      action: "PROPOSAL_CREATED",
      note: "Proposal submitted through intake form."
    })
    .run();

  return NextResponse.json(created, { status: 201 });
}
