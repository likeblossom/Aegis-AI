import { NextResponse } from "next/server";
import { generateOpportunityDiscovery } from "@/server/discovery/generateOpportunityDiscovery";
import { opportunityDiscoveryInputSchema } from "@/server/discovery/discoveryTypes";
import { createDiscoverySession } from "@/server/discovery/discoveryRepository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = opportunityDiscoveryInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await generateOpportunityDiscovery(parsed.data);
  const { session } = createDiscoverySession(parsed.data, result);

  return NextResponse.json({ sessionId: session.id }, { status: 201 });
}
