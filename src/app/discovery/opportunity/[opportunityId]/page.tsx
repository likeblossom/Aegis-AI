import Link from "next/link";
import { notFound } from "next/navigation";
import { DiscoveryProgress } from "@/components/discovery/discovery-progress";
import { BackLink, PageShell } from "@/components/ui/page-shell";
import { generateOpportunityAnalysis } from "@/server/discovery/generateOpportunityAnalysis";
import {
  getDiscoveryOpportunity,
  getOpportunityAnalysis,
  saveOpportunityAnalysis
} from "@/server/discovery/discoveryRepository";
import type { OpportunityAnalysisResult } from "@/server/discovery/discoveryTypes";

export const runtime = "nodejs";

type OpportunityPageProps = {
  params: Promise<{ opportunityId: string }>;
};

export default async function OpportunityPage({ params }: OpportunityPageProps) {
  const { opportunityId } = await params;
  const numericOpportunityId = Number(opportunityId);

  if (!Number.isInteger(numericOpportunityId)) {
    notFound();
  }

  const context = getDiscoveryOpportunity(numericOpportunityId);

  if (!context) {
    notFound();
  }

  const existingAnalysis = getOpportunityAnalysis(numericOpportunityId);
  const analysis =
    existingAnalysis?.analysis ??
    (await generateAndSaveAnalysis({
      opportunityId: numericOpportunityId,
      context
    }));

  return (
    <PageShell maxWidth="wide">
      <div className="mb-6">
        <BackLink href={`/discovery/results/${context.session.id}`}>
          Back to discovery results
        </BackLink>
        <h1 className="mt-4 text-2xl font-semibold text-ink">
          Opportunity Analysis
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Review the business case, fit, governance preview, readiness, pilot
          plan, and scorecard before generating a proposal.
        </p>
      </div>

      <DiscoveryProgress currentStep={3} />

      <div className="grid gap-6">
        <section className="rounded-lg border border-border bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-ink">
            {context.opportunity.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            {context.opportunity.description}
          </p>
          <dl className="mt-4 grid gap-4 md:grid-cols-2">
            <TextBlock title="AI approach" value={context.opportunity.aiApproach} />
            <TextBlock
              title="Business problem"
              value={context.session.businessProblem}
            />
          </dl>
        </section>

        <Section title="Business Case">
          <div className="grid gap-4 md:grid-cols-2">
            <TextBlock
              title="Expected value"
              value={analysis.businessCase.expectedValueSummary}
            />
            <TextBlock
              title="Efficiency impact"
              value={analysis.businessCase.efficiencyImpact}
            />
            <TextBlock
              title="Cost reduction potential"
              value={analysis.businessCase.costReductionPotential}
            />
            <TextBlock
              title="Productivity impact"
              value={analysis.businessCase.productivityImpact}
            />
          </div>
        </Section>

        <Section title="Opportunity Fit Analysis">
          <TextBlock title="Why this fits" value={analysis.fitAnalysis.whyThisFits} />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <ListBlock
              title="Expected challenges"
              items={analysis.fitAnalysis.expectedChallenges}
            />
            <ListBlock
              title="Key dependencies"
              items={analysis.fitAnalysis.keyDependencies}
            />
          </div>
        </Section>

        <Section title="Governance Preview">
          <div className="grid gap-4 md:grid-cols-3">
            <TextBlock
              title="Predicted risk level"
              value={analysis.governancePreview.predictedRiskLevel}
            />
            <ListBlock
              title="Likely review teams"
              items={analysis.governancePreview.likelyReviewTeams}
            />
            <ListBlock
              title="Likely concerns"
              items={analysis.governancePreview.likelyConcerns}
            />
          </div>
        </Section>

        <Section title="AI Readiness Estimate">
          <div className="grid gap-3 md:grid-cols-4">
            <ScoreBar label="Data" value={analysis.readinessEstimate.dataReadiness} />
            <ScoreBar
              label="Process"
              value={analysis.readinessEstimate.processReadiness}
            />
            <ScoreBar
              label="Technical"
              value={analysis.readinessEstimate.technicalReadiness}
            />
            <ScoreBar
              label="Stakeholder"
              value={analysis.readinessEstimate.stakeholderReadiness}
            />
          </div>
        </Section>

        <Section title="Recommended Pilot">
          <div className="grid gap-4 md:grid-cols-2">
            <TextBlock
              title="Pilot team"
              value={analysis.recommendedPilot.pilotTeam}
            />
            <TextBlock
              title="Pilot duration"
              value={analysis.recommendedPilot.pilotDuration}
            />
            <ListBlock
              title="Success criteria"
              items={analysis.recommendedPilot.successCriteria}
            />
            <ListBlock
              title="Rollback criteria"
              items={analysis.recommendedPilot.rollbackCriteria}
            />
          </div>
        </Section>

        <Section title="Opportunity Scorecard">
          <div className="grid gap-3 md:grid-cols-5">
            <ScoreBar
              label="Business Value"
              value={analysis.scorecard.businessValue}
            />
            <ScoreBar label="AI Readiness" value={analysis.scorecard.aiReadiness} />
            <ScoreBar
              label="Implementation Effort"
              value={analysis.scorecard.implementationEffort}
            />
            <ScoreBar
              label="Governance Risk"
              value={analysis.scorecard.governanceRisk}
            />
            <ScoreBar
              label="Strategic Alignment"
              value={analysis.scorecard.strategicAlignment}
            />
          </div>
          <div className="mt-4 rounded-md border border-border bg-panel p-4">
            <p className="text-sm font-semibold text-ink">
              {analysis.scorecard.overallRecommendation}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted">
              {analysis.scorecard.recommendationExplanation}
            </p>
          </div>
        </Section>

        <div className="flex justify-end">
          <Link
            className="rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            href={`/discovery/proposal/${numericOpportunityId}`}
          >
            Generate Governance Proposal
          </Link>
        </div>
      </div>
    </PageShell>
  );
}

async function generateAndSaveAnalysis({
  opportunityId,
  context
}: {
  opportunityId: number;
  context: NonNullable<ReturnType<typeof getDiscoveryOpportunity>>;
}) {
  const analysis = await generateOpportunityAnalysis({
    input: {
      businessProblem: context.session.businessProblem,
      department: context.session.department,
      affectedTeams: context.session.affectedTeams,
      currentPainPoints: context.session.currentPainPoints,
      goals: context.session.goals
    },
    opportunity: context.opportunity
  });

  saveOpportunityAnalysis(opportunityId, analysis);

  return analysis;
}

function Section({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TextBlock({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </dt>
      <dd className="mt-1 text-sm leading-6 text-ink">{value}</dd>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-panel p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {label}
        </p>
        <p className="text-sm font-semibold text-ink">{value}</p>
      </div>
      <div className="mt-2 h-2 rounded-full bg-white">
        <div
          className="h-2 rounded-full bg-slate-700"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
