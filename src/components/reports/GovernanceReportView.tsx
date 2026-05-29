import type { GovernanceReport } from "@/db/schema";
import { formatEnumLabel } from "@/lib/constants";
import type { GovernanceReportObject } from "@/server/governance/reportTypes";
import { RationaleSection } from "./RationaleSection";
import { RedFlagsSection } from "./RedFlagsSection";
import { RiskBreakdown } from "./RiskBreakdown";
import { RolloutStrategy } from "./RolloutStrategy";
import { SimulatedReviews } from "./SimulatedReviews";

type GovernanceReportViewProps = {
  report: GovernanceReportObject | null;
  reportRecord?: GovernanceReport | null;
};

export function GovernanceReportView({
  report,
  reportRecord
}: GovernanceReportViewProps) {
  if (!report) {
    return (
      <section className="rounded-lg border border-dashed border-border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-ink">Governance analysis</h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          No governance report has been generated yet. Generate a local
          deterministic assessment to review risk, controls, rationale, and
          rollout guidance.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Governance analysis</h2>
          {reportRecord ? (
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
              Version {reportRecord.reportVersion} -{" "}
              {formatEnumLabel(reportRecord.generationProvider)} -{" "}
              {reportRecord.promptVersion}
              {reportRecord.model ? ` - ${reportRecord.model}` : ""}
            </p>
          ) : null}
          <p className="mt-2 text-sm leading-6 text-muted">
            {report.executiveSummary}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <RiskBreakdown
          aiReadinessScore={report.aiReadinessScore}
          confidenceLevel={report.confidenceLevel}
          finalRecommendation={report.finalRecommendation}
          riskLevel={report.riskLevel}
        />
      </div>

      <div className="mt-6 grid gap-6">
        <section>
          <h3 className="text-base font-semibold text-ink">
            Use-case classification
          </h3>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <ClassItem
              label="Data sensitivity"
              value={formatEnumLabel(report.useCaseClassification.dataSensitivity)}
            />
            <ClassItem
              label="Decision impact"
              value={formatEnumLabel(report.useCaseClassification.decisionImpact)}
            />
            <ClassItem
              label="Automation profile"
              value={report.useCaseClassification.automationProfile}
            />
            <ClassItem
              label="Department"
              value={report.useCaseClassification.department}
            />
          </dl>
        </section>

        <section>
          <h3 className="text-base font-semibold text-ink">
            Governance risk analysis
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            {report.governanceRiskAnalysis}
          </p>
        </section>

        <section>
          <h3 className="text-base font-semibold text-ink">
            Business impact analysis
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            {report.businessImpactAnalysis}
          </p>
        </section>

        <RedFlagsSection redFlags={report.redFlags} />

        <section>
          <h3 className="text-base font-semibold text-ink">Required controls</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
            {report.requiredControls.map((control) => (
              <li key={control}>{control}</li>
            ))}
          </ul>
        </section>

        <RationaleSection rationale={report.analysisRationale} />
        <RolloutStrategy steps={report.rolloutStrategy} />
        <SimulatedReviews reviews={report.simulatedGovernanceReviews} />
      </div>
    </section>
  );
}

function ClassItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-panel p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-ink">{value}</dd>
    </div>
  );
}
