import { NextResponse } from "next/server";
import { createUseCaseSchema } from "@/lib/validations";
import { convertOpportunityToProposal } from "@/server/discovery/convertOpportunityToProposal";
import { getDiscoveryOpportunity } from "@/server/discovery/discoveryRepository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createUseCaseSchema.safeParse(body?.proposal ?? body);
  const opportunityId = Number(body?.opportunityId);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid proposal", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (!Number.isInteger(opportunityId) || !getDiscoveryOpportunity(opportunityId)) {
    return NextResponse.json(
      { error: "Invalid opportunity id" },
      { status: 400 }
    );
  }

  const created = convertOpportunityToProposal(parsed.data);

  return NextResponse.json(created, { status: 201 });
}
