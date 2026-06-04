import Link from "next/link";
import type { GovernanceReport } from "@/db/schema";
import { formatEnumLabel } from "@/lib/constants";
import { parseGovernanceReportJson } from "@/server/governance/reportTypes";

type ReportHistoryProps = {
  reports: GovernanceReport[];
  selectedReportId: number | null;
  useCaseId: number;
};

export function ReportHistory({
  reports,
  selectedReportId,
  useCaseId
}: ReportHistoryProps) {
  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Versions
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink">Report history</h2>
        </div>
        {reports.length > 0 ? (
          <span className="rounded-full border border-border bg-panel px-2.5 py-1 text-xs font-medium text-muted">
            {reports.length}
          </span>
        ) : null}
      </div>
      {reports.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-muted">
          No governance reports have been generated yet.
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {reports.map((report, index) => {
            const isSelected = selectedReportId === report.id;
            const previousReport = reports[index + 1] ?? null;
            const comparison = compareReports(report, previousReport);

            return (
              <li
                className={
                  isSelected
                    ? "rounded-md border border-slate-300 bg-panel p-3 shadow-sm"
                    : "rounded-md border border-border p-3 hover:bg-panel"
                }
                key={report.id}
              >
                <Link
                  className="block text-sm font-semibold text-ink hover:underline"
                  href={`/use-cases/${useCaseId}?reportId=${report.id}`}
                >
                  Version {report.reportVersion}
                </Link>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {formatEnumLabel(report.generationProvider)} -{" "}
                  {formatEnumLabel(report.riskLevel)} risk -{" "}
                  {formatEnumLabel(report.finalRecommendation)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {new Date(`${report.createdAt}Z`).toLocaleString()}
                </p>
                {comparison.length > 0 ? (
                  <div className="mt-3 grid gap-2">
                    {comparison.map((item) => (
                      <div
                        className="flex items-center justify-between gap-3 rounded-md bg-white px-2.5 py-2 text-xs"
                        key={item.label}
                      >
                        <span className="text-muted">{item.label}</span>
                        <span className={item.className}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                ) : index === reports.length - 1 ? (
                  <p className="mt-2 text-xs leading-5 text-muted">
                    Baseline version for comparisons.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function compareReports(
  current: GovernanceReport,
  previous: GovernanceReport | null
) {
  if (!previous) {
    return [];
  }

  const currentParsed = parseGovernanceReportJson(current.reportJson);
  const previousParsed = parseGovernanceReportJson(previous.reportJson);
  const readinessDelta =
    current.aiReadinessScore - previous.aiReadinessScore;
  const controlDelta =
    (currentParsed?.requiredControls.length ?? 0) -
    (previousParsed?.requiredControls.length ?? 0);
  const redFlagDelta =
    (currentParsed?.redFlags.length ?? 0) -
    (previousParsed?.redFlags.length ?? 0);

  return [
    {
      label: "Readiness",
      value: formatSignedDelta(readinessDelta),
      className: getPositiveDeltaClass(readinessDelta)
    },
    {
      label: "Controls",
      value: formatSignedDelta(controlDelta),
      className: getNeutralDeltaClass(controlDelta)
    },
    {
      label: "Red flags",
      value: formatSignedDelta(redFlagDelta),
      className: getNegativeDeltaClass(redFlagDelta)
    }
  ];
}

function formatSignedDelta(value: number) {
  if (value > 0) {
    return `+${value}`;
  }

  return String(value);
}

function getPositiveDeltaClass(value: number) {
  if (value > 0) {
    return "font-semibold text-emerald-700";
  }

  if (value < 0) {
    return "font-semibold text-red-700";
  }

  return "font-semibold text-muted";
}

function getNegativeDeltaClass(value: number) {
  if (value < 0) {
    return "font-semibold text-emerald-700";
  }

  if (value > 0) {
    return "font-semibold text-red-700";
  }

  return "font-semibold text-muted";
}

function getNeutralDeltaClass(value: number) {
  if (value === 0) {
    return "font-semibold text-muted";
  }

  return "font-semibold text-slate-800";
}
