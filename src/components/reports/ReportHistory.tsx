import Link from "next/link";
import type { GovernanceReport } from "@/db/schema";
import { formatEnumLabel } from "@/lib/constants";

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
      <h2 className="text-lg font-semibold text-ink">Report history</h2>
      {reports.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-muted">
          No governance reports have been generated yet.
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {reports.map((report) => {
            const isSelected = selectedReportId === report.id;

            return (
              <li
                className={
                  isSelected
                    ? "rounded-md border border-slate-300 bg-panel p-3"
                    : "rounded-md border border-border p-3"
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
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
