import Link from "next/link";
import { formatEnumLabel } from "@/lib/constants";
import type { UseCase } from "@/db/schema";
import { StatusBadge } from "@/components/ui/status-badge";

type ProposalTableProps = {
  proposals: UseCase[];
};

export function ProposalTable({ proposals }: ProposalTableProps) {
  if (proposals.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center text-sm text-muted">
        No proposals have been submitted yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-left text-sm">
          <thead className="bg-panel text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Title</th>
              <th className="px-4 py-3 font-semibold">Department</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Data</th>
              <th className="px-4 py-3 font-semibold">Decision</th>
              <th className="px-4 py-3 font-semibold">Created</th>
              <th className="px-4 py-3 font-semibold">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {proposals.map((proposal) => (
              <tr key={proposal.id}>
                <td className="max-w-xs px-4 py-4 font-medium text-ink">
                  {proposal.title}
                </td>
                <td className="px-4 py-4 text-muted">{proposal.department}</td>
                <td className="px-4 py-4">
                  <StatusBadge value={proposal.status} />
                </td>
                <td className="px-4 py-4 text-muted">
                  {formatEnumLabel(proposal.dataSensitivity)}
                </td>
                <td className="px-4 py-4 text-muted">
                  {formatEnumLabel(proposal.decisionImpact)}
                </td>
                <td className="px-4 py-4 text-muted">
                  {new Date(`${proposal.createdAt}Z`).toLocaleDateString()}
                </td>
                <td className="px-4 py-4">
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
