import type {
  AssessmentArea,
  AssessmentBreakdown as AssessmentBreakdownObject
} from "@/server/governance/reportTypes";

const assessmentLabels: Array<{
  key: keyof AssessmentBreakdownObject;
  label: string;
}> = [
  { key: "businessValue", label: "Business Value" },
  { key: "implementationComplexity", label: "Implementation Complexity" },
  { key: "governanceRisk", label: "Governance Risk" },
  { key: "changeManagementRisk", label: "Change Management Risk" },
  { key: "dataReadiness", label: "Data Readiness" },
  { key: "humanOversightStrength", label: "Human Oversight Strength" },
  { key: "strategicAlignment", label: "Strategic Alignment" }
];

export function AssessmentExecutiveSummary({
  assessment
}: {
  assessment: AssessmentBreakdownObject;
}) {
  const ranked = assessmentLabels
    .map((item) => ({
      ...item,
      area: assessment[item.key]
    }))
    .sort((a, b) => b.area.score - a.area.score);
  const strengths = ranked.slice(0, 2);
  const concerns = [...ranked].sort((a, b) => a.area.score - b.area.score).slice(0, 2);
  const mostImpactfulImprovement =
    concerns[0]?.area.improvementActions[0] ??
    "Define a focused improvement action before expanding the pilot.";

  return (
    <section className="rounded-md border border-border bg-panel p-4">
      <h3 className="text-base font-semibold text-ink">Assessment summary</h3>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        <SummaryList
          label="Top Strengths"
          items={strengths.map(
            (strength) => `${strength.label}: ${strength.area.score}/100`
          )}
        />
        <SummaryList
          label="Top Concerns"
          items={concerns.map((concern) => `${concern.label}: ${concern.area.score}/100`)}
        />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Most Impactful Improvement
          </p>
          <p className="mt-2 text-sm leading-6 text-ink">
            {mostImpactfulImprovement}
          </p>
        </div>
      </div>
    </section>
  );
}

export function AssessmentBreakdown({
  assessment
}: {
  assessment: AssessmentBreakdownObject;
}) {
  return (
    <section>
      <h3 className="text-base font-semibold text-ink">Assessment Breakdown</h3>
      <div className="mt-3 grid gap-4">
        {assessmentLabels.map(({ key, label }) => (
          <AssessmentAreaView key={key} label={label} area={assessment[key]} />
        ))}
      </div>
    </section>
  );
}

function SummaryList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <ul className="mt-2 space-y-1 text-sm leading-6 text-ink">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function AssessmentAreaView({
  label,
  area
}: {
  label: string;
  area: AssessmentArea;
}) {
  return (
    <article className="rounded-md border border-border bg-panel p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-ink">{label}</h4>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
            Confidence: {area.confidence}
          </p>
        </div>
        <div className="min-w-40">
          <p className="text-sm font-semibold text-ink">Score: {area.score}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-ink"
              style={{ width: `${area.score}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Rationale
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">{area.rationale}</p>
        </div>
        <AssessmentList label="Evidence" items={area.evidenceFromProposal} />
        <AssessmentList label="Improvement Actions" items={area.improvementActions} />
      </div>
    </article>
  );
}

function AssessmentList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
