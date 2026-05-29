import type { ProposalChallenger } from "@/server/governance/reportTypes";

type StakeholderAnalysisSectionsProps = {
  stakeholderImpactAnalysis: string;
  proposalChallenger: ProposalChallenger;
  successMetrics: string[];
  assumptionsAndUncertainties: string[];
};

export function StakeholderAnalysisSections({
  stakeholderImpactAnalysis,
  proposalChallenger,
  successMetrics,
  assumptionsAndUncertainties
}: StakeholderAnalysisSectionsProps) {
  return (
    <section>
      <h3 className="text-base font-semibold text-ink">
        Stakeholder Analysis
      </h3>
      <p className="mt-2 text-sm leading-6 text-muted">
        {stakeholderImpactAnalysis || "No stakeholder impact analysis provided."}
      </p>

      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <ListBlock
          title="Proposal challenger"
          items={proposalChallenger.reasonsThisMightFail}
        />
        <ListBlock
          title="Assumptions to validate"
          items={proposalChallenger.assumptionsToValidate}
        />
        <ListBlock
          title="Questions for stakeholders"
          items={proposalChallenger.questionsForStakeholders}
        />
        <ListBlock title="Success metrics" items={successMetrics} />
        <ListBlock
          title="Assumptions and uncertainties"
          items={assumptionsAndUncertainties}
        />
      </div>
    </section>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-border bg-panel p-4">
      <h4 className="text-sm font-semibold text-ink">{title}</h4>
      {items.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-muted">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm leading-6 text-muted">
          No specific items identified.
        </p>
      )}
    </div>
  );
}
