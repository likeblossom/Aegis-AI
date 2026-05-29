import { notFound } from "next/navigation";
import { DiscoveryProgress } from "@/components/discovery/discovery-progress";
import { ProposalDraftForm } from "@/components/discovery/proposal-draft-form";
import { BackLink, PageShell } from "@/components/ui/page-shell";
import { getDiscoveryOpportunity } from "@/server/discovery/discoveryRepository";
import type { CreateUseCaseInput } from "@/lib/validations";

export const runtime = "nodejs";

type DiscoveryProposalPageProps = {
  params: Promise<{ opportunityId: string }>;
};

export default async function DiscoveryProposalPage({
  params
}: DiscoveryProposalPageProps) {
  const { opportunityId } = await params;
  const numericOpportunityId = Number(opportunityId);

  if (!Number.isInteger(numericOpportunityId)) {
    notFound();
  }

  const context = getDiscoveryOpportunity(numericOpportunityId);

  if (!context) {
    notFound();
  }

  const proposal = buildProposalDraft(context);

  return (
    <PageShell>
      <div className="mb-6">
        <BackLink href={`/discovery/opportunity/${numericOpportunityId}`}>
          Back to opportunity analysis
        </BackLink>
        <h1 className="mt-4 text-2xl font-semibold text-ink">
          Generate Governance Proposal
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Review and edit the proposal fields before submitting this opportunity
          into the normal Aegis governance workflow.
        </p>
      </div>

      <DiscoveryProgress currentStep={4} />

      <section className="rounded-lg border border-border bg-white p-5 shadow-sm sm:p-6">
        <ProposalDraftForm
          initialProposal={proposal}
          opportunityId={numericOpportunityId}
        />
      </section>
    </PageShell>
  );
}

function buildProposalDraft(
  context: NonNullable<ReturnType<typeof getDiscoveryOpportunity>>
): CreateUseCaseInput {
  const { opportunity, session } = context;

  return {
    title: opportunity.title,
    department: session.department,
    teamOwner: session.affectedTeams,
    currentProcess: `${session.businessProblem}\n\nCurrent pain points: ${session.currentPainPoints}`,
    proposedSolution: `${opportunity.description}\n\nAI approach: ${opportunity.aiApproach}`,
    expectedBenefit: opportunity.expectedBenefits.join("\n"),
    dataSensitivity: "INTERNAL",
    decisionImpact:
      opportunity.estimatedBusinessValue === "High" ? "MEDIUM" : "LOW",
    humanOversightPlanned: "YES",
    affectedStakeholders: session.affectedTeams,
    implementationTimeline:
      opportunity.implementationComplexity === "Low"
        ? "6 weeks"
        : opportunity.implementationComplexity === "Medium"
          ? "12 weeks"
          : "6 months"
  };
}
