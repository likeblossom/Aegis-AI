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
      <div className="app-panel border-dashed p-8 text-center text-sm text-muted">
        {emptyMessage ?? "No proposals have been submitted yet."}
      </div>
    );
  }

  return (
    <div className="app-panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-[1180px] table-fixed divide-y divide-line text-left text-sm xl:min-w-full">
          <colgroup>
            <col className="w-[290px]" />
            <col className="w-[180px]" />
            <col className="w-[150px]" />
            <col className="w-[140px]" />
            <col className="w-[230px]" />
            <col className="w-[210px]" />
            <col className="w-[130px]" />
            <col className="w-[90px]" />
          </colgroup>
          <thead className="bg-surface-muted text-xs uppercase tracking-[0.08em] text-muted">
            <tr>
              <th className="px-5 py-3 font-semibold">Proposal</th>
              <th className="px-5 py-3 font-semibold">Reviewer</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Risk</th>
              <th className="px-5 py-3 font-semibold">Recommendation</th>
              <th className="px-5 py-3 font-semibold">Inputs</th>
              <th className="px-5 py-3 font-semibold">Created</th>
              <th className="px-5 py-3 font-semibold">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-white">
            {proposals.map((proposal) => (
              <tr className="hover:bg-panel" key={proposal.id}>
                <td className="px-5 py-5 align-top font-medium leading-6 text-ink">
                  <div>{proposal.title}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs font-medium leading-5 text-muted">
                    <span>{proposal.department}</span>
                    <span>Report {proposal.latestReport ? `v${proposal.latestReport.reportVersion}` : "not generated"}</span>
                  </div>
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
                  <div>{formatEnumLabel(proposal.dataSensitivity)}</div>
                  <div className="mt-1 text-xs">
                    {formatEnumLabel(proposal.decisionImpact)} impact
                  </div>
                </td>
                <td className="px-5 py-5 align-top text-muted">
                  {new Date(`${proposal.createdAt}Z`).toLocaleDateString()}
                </td>
                <td className="px-5 py-5 align-top">
                  <Link
                    className="font-semibold text-slate-800 underline underline-offset-4 hover:text-black"
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
