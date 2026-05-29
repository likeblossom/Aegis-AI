import { notFound } from "next/navigation";
import { ExploreOpportunityButton } from "@/components/discovery/explore-opportunity-button";
import { DiscoveryProgress } from "@/components/discovery/discovery-progress";
import { BackLink, PageShell } from "@/components/ui/page-shell";
import {
  getDiscoveryOpportunities,
  getDiscoverySession
} from "@/server/discovery/discoveryRepository";
import type { DiscoveredOpportunity } from "@/server/discovery/discoveryTypes";

export const runtime = "nodejs";

type DiscoveryResultsPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function DiscoveryResultsPage({
  params
}: DiscoveryResultsPageProps) {
  const { sessionId } = await params;
  const numericSessionId = Number(sessionId);

  if (!Number.isInteger(numericSessionId)) {
    notFound();
  }

  const session = getDiscoverySession(numericSessionId);

  if (!session) {
    notFound();
  }

  const opportunities = getDiscoveryOpportunities(session.id);
  const analytics = JSON.parse(session.analyticsJson) as {
    recommendedOpportunity: string;
    expectedValueSummary: string;
    expectedEfficiencyImpact: string;
  };

  return (
    <PageShell maxWidth="wide">
      <div className="mb-6">
        <BackLink href="/discovery">New discovery</BackLink>
        <h1 className="mt-4 text-2xl font-semibold text-ink">
          Opportunity Discovery Results
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Compare AI opportunities generated for {session.department}. Explore
          an opportunity before creating a governance proposal.
        </p>
      </div>

      <DiscoveryProgress currentStep={2} />

      <section className="mb-5 rounded-lg border border-border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-ink">Discovery analytics</h2>
        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
          {session.generationMode}
          {session.model ? ` - ${session.model}` : ""}
        </p>
        <dl className="mt-4 grid gap-4 md:grid-cols-3">
          <AnalysisItem
            label="Recommended opportunity"
            value={analytics.recommendedOpportunity}
          />
          <AnalysisItem
            label="Expected value"
            value={analytics.expectedValueSummary}
          />
          <AnalysisItem
            label="Efficiency impact"
            value={analytics.expectedEfficiencyImpact}
          />
        </dl>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {opportunities.map(({ record, opportunity }) => (
          <OpportunityCard
            key={record.id}
            opportunity={opportunity}
            opportunityId={record.id}
          />
        ))}
      </section>
    </PageShell>
  );
}

function OpportunityCard({
  opportunity,
  opportunityId
}: {
  opportunity: DiscoveredOpportunity;
  opportunityId: number;
}) {
  return (
    <article className="flex h-full flex-col rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="flex-1">
        <h3 className="text-base font-semibold text-ink">{opportunity.title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted">
          {opportunity.description}
        </p>
        <InfoBlock title="AI approach" value={opportunity.aiApproach} />
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
          <Badge label={`Value: ${opportunity.estimatedBusinessValue}`} />
          <Badge label={`Complexity: ${opportunity.implementationComplexity}`} />
          <Badge label={`Confidence: ${opportunity.confidence}`} />
        </div>
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Expected benefits
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-muted">
            {opportunity.expectedBenefits.map((benefit) => (
              <li key={benefit}>{benefit}</li>
            ))}
          </ul>
        </div>
        <InfoBlock title="Reasoning" value={opportunity.reasoning} />
      </div>
      <ExploreOpportunityButton opportunityId={opportunityId} />
    </article>
  );
}

function AnalysisItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-panel p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-sm leading-6 text-ink">{value}</dd>
    </div>
  );
}

function InfoBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </p>
      <p className="mt-1 text-sm leading-6 text-muted">{value}</p>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-slate-400 bg-slate-100 px-2.5 py-1 text-slate-800">
      {label}
    </span>
  );
}
