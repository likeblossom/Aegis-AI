import Link from "next/link";
import { desc } from "drizzle-orm";
import type { ReactNode } from "react";
import { PageShell } from "@/components/ui/page-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { db } from "@/db";
import { governanceReports, useCases } from "@/db/schema";
import { formatEnumLabel } from "@/lib/constants";
import { analyzePortfolio } from "@/server/portfolio/analytics";
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
  const analytics = analyzePortfolio(rankedProposals);

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

      <div className="mb-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
        <SummaryCard
          label="Avg readiness"
          value={`${analytics.averageReadiness}%`}
        />
        <SummaryCard
          label="High risk"
          value={analytics.criticalRiskCount}
        />
        <SummaryCard
          label="Avg controls"
          value={analytics.averageRequiredControls}
        />
      </div>

      {rankedProposals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center text-sm text-muted">
          No proposals have generated governance reports yet.
        </div>
      ) : (
        <>
          <section className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <AnalyticsPanel title="Portfolio posture">
              <AnalyticsRow
                label="Approval-ready candidates"
                value={analytics.approvalReadyCount}
              />
              <AnalyticsRow
                label="Governance bottlenecks"
                value={analytics.governanceReviewCount}
              />
              <AnalyticsRow
                label="Confidential or sensitive data"
                value={analytics.highDataSensitivityCount}
              />
              <AnalyticsRow
                label="Required controls captured"
                value={analytics.totalRequiredControls}
              />
            </AnalyticsPanel>
            <AnalyticsPanel title="Risk distribution">
              {analytics.riskDistribution.map((item) => (
                <BarRow
                  count={item.count}
                  key={item.label}
                  label={formatEnumLabel(item.label)}
                  total={rankedProposals.length}
                />
              ))}
            </AnalyticsPanel>
            <AnalyticsPanel title="Top control themes">
              {analytics.topControlThemes.length > 0 ? (
                analytics.topControlThemes.map((item) => (
                  <AnalyticsRow
                    key={item.theme}
                    label={item.theme}
                    value={item.count}
                  />
                ))
              ) : (
                <p className="text-sm leading-6 text-muted">
                  No required controls were available in the latest reports.
                </p>
              )}
            </AnalyticsPanel>
          </section>
          <section className="mb-5 grid gap-4 lg:grid-cols-2">
            <AnalyticsPanel title="Leading departments">
              {analytics.departmentLeaders.map((item) => (
                <AnalyticsRow
                  key={item.department}
                  label={`${item.department} (${item.count})`}
                  value={`${item.averageScore}/100`}
                />
              ))}
            </AnalyticsPanel>
            <AnalyticsPanel title="Recommendation mix">
              {analytics.recommendationDistribution.map((item) => (
                <BarRow
                  count={item.count}
                  key={item.label}
                  label={formatEnumLabel(item.label)}
                  total={rankedProposals.length}
                />
              ))}
            </AnalyticsPanel>
          </section>
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
        </>
      )}
    </PageShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-muted">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-ink">{value}</div>
    </div>
  );
}

function AnalyticsPanel({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function AnalyticsRow({
  label,
  value
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="leading-5 text-muted">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}

function BarRow({
  label,
  count,
  total
}: {
  label: string;
  count: number;
  total: number;
}) {
  const width = total === 0 ? 0 : Math.round((count / total) * 100);

  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="leading-5 text-muted">{label}</span>
        <span className="font-semibold text-ink">{count}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-panel">
        <div
          className="h-2 rounded-full bg-slate-700"
          style={{ width: `${width}%` }}
        />
      </div>
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
