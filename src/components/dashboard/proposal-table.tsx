import Link from "next/link";
import { formatEnumLabel } from "@/lib/constants";
import type { GovernanceReport, UseCase } from "@/db/schema";
import { StatusBadge } from "@/components/ui/status-badge";

export type ProposalQueueItem = UseCase & {
  latestReport: GovernanceReport | null;
};

type ProposalTableProps = {
  emptyMessage?: string;
  proposals: ProposalQueueItem[];
};

export function ProposalTable({ emptyMessage, proposals }: ProposalTableProps) {
  if (proposals.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center text-sm text-muted">
        {emptyMessage ?? "No proposals have been submitted yet."}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[1540px] table-fixed divide-y divide-border text-left text-sm xl:min-w-full">
          <colgroup>
            <col className="w-[210px]" />
            <col className="w-[170px]" />
            <col className="w-[190px]" />
            <col className="w-[150px]" />
            <col className="w-[140px]" />
            <col className="w-[220px]" />
            <col className="w-[140px]" />
            <col className="w-[140px]" />
            <col className="w-[110px]" />
            <col className="w-[140px]" />
            <col className="w-[90px]" />
          </colgroup>
          <thead className="bg-panel text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-semibold">Title</th>
              <th className="px-5 py-3 font-semibold">Department</th>
              <th className="px-5 py-3 font-semibold">Reviewer</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Risk</th>
              <th className="px-5 py-3 font-semibold">Recommendation</th>
              <th className="px-5 py-3 font-semibold">Data</th>
              <th className="px-5 py-3 font-semibold">Decision</th>
              <th className="px-5 py-3 font-semibold">Report</th>
              <th className="px-5 py-3 font-semibold">Created</th>
              <th className="px-5 py-3 font-semibold">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {proposals.map((proposal) => (
              <tr key={proposal.id}>
                <td className="px-5 py-5 align-top font-medium leading-6 text-ink">
                  {proposal.title}
                </td>
                <td className="px-5 py-5 align-top leading-6 text-muted">
                  {proposal.department}
                </td>
                <td className="px-5 py-5 align-top leading-6 text-muted">
                  {proposal.assignedReviewer}
                </td>
                <td className="px-5 py-5 align-top">
                  <StatusBadge value={proposal.status} />
                </td>
                <td className="px-5 py-5 align-top text-muted">
                  {proposal.latestReport ? (
                    <StatusBadge value={proposal.latestReport.riskLevel} />
                  ) : (
                    "Not generated"
                  )}
                </td>
                <td className="px-5 py-5 align-top leading-6 text-muted">
                  {proposal.latestReport
                    ? formatEnumLabel(proposal.latestReport.finalRecommendation)
                    : "Pending analysis"}
                </td>
                <td className="px-5 py-5 align-top text-muted">
                  {formatEnumLabel(proposal.dataSensitivity)}
                </td>
                <td className="px-5 py-5 align-top text-muted">
                  {formatEnumLabel(proposal.decisionImpact)}
                </td>
                <td className="px-5 py-5 align-top text-muted">
                  {proposal.latestReport
                    ? `v${proposal.latestReport.reportVersion}`
                    : "-"}
                </td>
                <td className="px-5 py-5 align-top text-muted">
                  {new Date(`${proposal.createdAt}Z`).toLocaleDateString()}
                </td>
                <td className="px-5 py-5 align-top">
                  <Link
                    className="font-medium text-slate-800 underline underline-offset-4 hover:text-black"
                    href={`/use-cases/${proposal.id}`}
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
