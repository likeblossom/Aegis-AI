import Link from "next/link";
import { desc } from "drizzle-orm";
import { PageShell } from "@/components/ui/page-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { db } from "@/db";
import { governanceReports, useCases } from "@/db/schema";
import { formatEnumLabel } from "@/lib/constants";
import {
  prioritizePortfolio,
  type PriorityCategory
} from "@/server/portfolio/prioritization";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PortfolioPage() {
  const proposals = db.select().from(useCases).orderBy(desc(useCases.createdAt)).all();
  const reports = db
    .select()
    .from(governanceReports)
    .orderBy(desc(governanceReports.createdAt))
    .all();

  const latestReportByUseCaseId = new Map<number, (typeof reports)[number]>();

  for (const report of reports) {
    if (!latestReportByUseCaseId.has(report.useCaseId)) {
      latestReportByUseCaseId.set(report.useCaseId, report);
    }
  }

  const rankedProposals = prioritizePortfolio(
    proposals.flatMap((proposal) => {
      const report = latestReportByUseCaseId.get(proposal.id);

      if (!report) {
        return [];
      }

      return [
        {
          proposal,
          report
        }
      ];
    })
  );

  return (
    <PageShell maxWidth="wide">
      <section className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <Link
            className="text-sm font-medium text-slate-700 hover:text-ink"
            href="/"
          >
            Back to dashboard
          </Link>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal text-ink">
            AI Opportunity Prioritization
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Portfolio-level ranking for submitted proposals with generated
            governance reports, calculated from readiness, risk, recommendation,
            decision impact, data sensitivity, and available complexity signals.
          </p>
        </div>
        <Link
          className="inline-flex w-fit rounded-md border border-border bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:bg-panel"
          href="/use-cases/new"
        >
          New proposal
        </Link>
      </section>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Ranked proposals" value={rankedProposals.length} />
        <SummaryCard
          label="Quick wins"
          value={
            rankedProposals.filter(
              (item) => item.priorityCategory === "Quick Win"
            ).length
          }
        />
        <SummaryCard
          label="Governance review"
          value={
            rankedProposals.filter(
              (item) => item.priorityCategory === "Needs Governance Review"
            ).length
          }
        />
      </div>

      {rankedProposals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center text-sm text-muted">
          No proposals have generated governance reports yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1320px] table-fixed divide-y divide-border text-left text-sm xl:min-w-full">
              <colgroup>
                <col className="w-[78px]" />
                <col className="w-[260px]" />
                <col className="w-[100px]" />
                <col className="w-[170px]" />
                <col className="w-[120px]" />
                <col className="w-[120px]" />
                <col className="w-[210px]" />
                <col className="w-[360px]" />
                <col className="w-[90px]" />
              </colgroup>
              <thead className="bg-panel text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Rank</th>
                  <th className="px-5 py-3 font-semibold">Proposal</th>
                  <th className="px-5 py-3 font-semibold">Score</th>
                  <th className="px-5 py-3 font-semibold">Category</th>
                  <th className="px-5 py-3 font-semibold">Risk</th>
                  <th className="px-5 py-3 font-semibold">Readiness</th>
                  <th className="px-5 py-3 font-semibold">Recommendation</th>
                  <th className="px-5 py-3 font-semibold">Explanation</th>
                  <th className="px-5 py-3 font-semibold">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rankedProposals.map((item) => (
                  <tr key={item.proposal.id}>
                    <td className="px-5 py-5 align-top text-2xl font-semibold text-ink">
                      {item.priorityRank}
                    </td>
                    <td className="px-5 py-5 align-top">
                      <div className="font-medium leading-6 text-ink">
                        {item.proposal.title}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-muted">
                        {item.proposal.department}
                      </div>
                    </td>
                    <td className="px-5 py-5 align-top">
                      <span className="text-lg font-semibold text-ink">
                        {item.priorityScore}
                      </span>
                      <span className="text-muted">/100</span>
                    </td>
                    <td className="px-5 py-5 align-top">
                      <CategoryBadge category={item.priorityCategory} />
                    </td>
                    <td className="px-5 py-5 align-top">
                      <StatusBadge value={item.report.riskLevel} />
                    </td>
                    <td className="px-5 py-5 align-top text-muted">
                      {item.report.aiReadinessScore}/100
                    </td>
                    <td className="px-5 py-5 align-top leading-6 text-muted">
                      {formatEnumLabel(item.report.finalRecommendation)}
                    </td>
                    <td className="px-5 py-5 align-top leading-6 text-muted">
                      {item.explanation}
                    </td>
                    <td className="px-5 py-5 align-top">
                      <Link
                        className="font-medium text-slate-800 underline underline-offset-4 hover:text-black"
                        href={`/use-cases/${item.proposal.id}`}
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
      )}
    </PageShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-muted">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-ink">{value}</div>
    </div>
  );
}

function CategoryBadge({ category }: { category: PriorityCategory }) {
  const style = getCategoryStyle(category);

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${style}`}
    >
      {category}
    </span>
  );
}

function getCategoryStyle(category: PriorityCategory) {
  if (category === "Quick Win") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (category === "Strategic Bet") {
    return "border-blue-200 bg-blue-50 text-blue-800";
  }

  if (category === "Needs Governance Review") {
    return "border-orange-200 bg-orange-50 text-orange-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}
