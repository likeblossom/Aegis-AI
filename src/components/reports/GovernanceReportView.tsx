import type { GovernanceReport } from "@/db/schema";
import { formatEnumLabel } from "@/lib/constants";
import { formatGenerationFailureReason } from "@/lib/audit-log-formatter";
import { StatusBadge } from "@/components/ui/status-badge";
import type { GovernanceReportObject } from "@/server/governance/reportTypes";
import {
  AssessmentBreakdown,
  AssessmentExecutiveSummary
} from "./AssessmentBreakdown";
import { ChangeManagementImpact } from "./ChangeManagementImpact";
import { ExecutiveBriefing } from "./ExecutiveBriefing";
import { RationaleSection } from "./RationaleSection";
import { RedFlagsSection } from "./RedFlagsSection";
import { RiskBreakdown } from "./RiskBreakdown";
import { RolloutStrategy } from "./RolloutStrategy";
import { SimulatedReviews } from "./SimulatedReviews";
import { StakeholderAnalysisSections } from "./StakeholderAnalysisSections";

type GovernanceReportViewProps = {
  report: GovernanceReportObject | null;
  reportRecord?: GovernanceReport | null;
  reportLabel?: string;
};

export function GovernanceReportView({
  report,
  reportRecord,
  reportLabel = "Latest report"
}: GovernanceReportViewProps) {
  if (!report) {
    return (
      <section className="rounded-lg border border-dashed border-border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-ink">Governance analysis</h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          No governance report has been generated yet.
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
              {reportLabel} - Version {reportRecord.reportVersion} -{" "}
              {formatEnumLabel(reportRecord.generationProvider)} -{" "}
              {reportRecord.promptVersion}
              {reportRecord.model ? ` - ${reportRecord.model}` : ""}
            </p>
          ) : null}
          {["deterministic", "LOCAL_FALLBACK"].includes(
            reportRecord?.generationProvider ?? ""
          ) ? (
            <p className="mt-2 rounded-md border border-border bg-panel px-3 py-2 text-xs leading-5 text-muted">
              This report was generated using local fallback analysis.
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="w-fit rounded-full border border-border bg-panel px-2.5 py-1 text-xs font-medium text-ink">
              {report.generationMetadata.fallbackUsed
                ? "Generated with Local Fallback"
                : "Generated with Azure OpenAI"}
            </span>
            {report.generationMetadata.fallbackUsed ? (
              <span className="text-xs leading-5 text-muted">
                Fallback reason:{" "}
                {formatGenerationFailureReason(
                  report.generationMetadata.failureReason
                )}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-xs leading-5 text-muted">
            Generation mode:{" "}
            {formatEnumLabel(report.generationMetadata.generationMode)}
            {report.generationMetadata.modelDeployment
              ? ` - ${report.generationMetadata.modelDeployment}`
              : ""}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">
            {report.executiveSummary}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <ExecutiveBriefing briefing={report.executiveBriefing} />
      </div>

      <div className="mt-5">
        <WorkflowTracePanel report={report} />
      </div>

      <div className="mt-5">
        <AssessmentExecutiveSummary assessment={report.assessmentBreakdown} />
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

        <AssessmentBreakdown assessment={report.assessmentBreakdown} />

        <section>
          <h3 className="text-base font-semibold text-ink">Required controls</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
            {report.requiredControls.map((control) => (
              <li key={control}>{control}</li>
            ))}
          </ul>
        </section>

        <RationaleSection rationale={report.analysisRationale} />
        <ChangeManagementImpact analysis={report.changeManagementAnalysis} />
        <StakeholderAnalysisSections
          assumptionsAndUncertainties={report.assumptionsAndUncertainties}
          proposalChallenger={report.proposalChallenger}
          stakeholderImpactAnalysis={report.stakeholderImpactAnalysis}
          successMetrics={report.successMetrics}
        />
        <RolloutStrategy steps={report.rolloutStrategy} />
        <SimulatedReviews reviews={report.simulatedGovernanceReviews} />
      </div>
    </section>
  );
}

function WorkflowTracePanel({ report }: { report: GovernanceReportObject }) {
  const trace = report.workflowTrace;
  const hasTrace = trace.path.length > 0 && trace.runId !== "legacy-report";

  return (
    <section className="rounded-md border border-border bg-panel p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-ink">Workflow trace</h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            {hasTrace
              ? "Governance council review generated reviewer findings, evidence, and controls for this proposal."
              : "Workflow trace unavailable for this historical report."}
          </p>
        </div>
        <span
          className={`w-fit rounded-full border px-2.5 py-1 text-xs font-medium ${getReviewRequirementBadgeStyle(
            trace.humanReviewRequired
          )}`}
        >
          {trace.humanReviewRequired
            ? "Human review required"
            : "Standard reviewer decision"}
        </span>
      </div>

      {hasTrace ? (
        <CouncilFindings report={report} variant="embedded" />
      ) : null}
    </section>
  );
}

function CouncilFindings({
  report,
  variant = "standalone"
}: {
  report: GovernanceReportObject;
  variant?: "embedded" | "standalone";
}) {
  const findings = report.workflowTrace.agentFindings;

  return (
    <section className={variant === "embedded" ? "mt-5" : ""}>
      <h3 className="text-base font-semibold text-ink">
        Council findings
      </h3>
      {findings.length === 0 ? (
        <p className="mt-2 text-sm leading-6 text-muted">
          No council findings were captured for this historical report.
        </p>
      ) : (
        <div className="mt-3 grid gap-3">
          {findings.map((finding) => (
            <div
              className={
                variant === "embedded"
                  ? "rounded-md border border-border bg-white p-4"
                  : "rounded-md border border-border bg-panel p-4"
              }
              key={finding.agent}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-ink">
                  {formatTraceLabel(finding.agent)}
                </h4>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge value={finding.riskLevel} />
                  <StatusBadge value={finding.confidence} />
                </div>
              </div>
              <p className="mt-3 text-sm font-medium leading-6 text-ink">
                {finding.summary}
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-muted">
                {finding.findings.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {finding.evidence.length > 0 ? (
                <div className="mt-3 rounded-md border border-border bg-white px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Evidence reviewed
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted">
                    {finding.evidence.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Recommended controls
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted">
                  {finding.recommendedControls.map((control) => (
                    <li key={control}>{control}</li>
                  ))}
                </ul>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {finding.controlRationale}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatTraceLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getReviewRequirementBadgeStyle(humanReviewRequired: boolean) {
  if (humanReviewRequired) {
    return "border-orange-500 bg-orange-100 text-orange-950";
  }

  return "border-emerald-600 bg-emerald-100 text-emerald-950";
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
