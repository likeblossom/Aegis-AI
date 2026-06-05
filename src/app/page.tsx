import Link from "next/link";
import { desc } from "drizzle-orm";
import { ProposalTable, type ProposalQueueItem } from "@/components/dashboard/proposal-table";
import {
  QueueFilters,
  type QueueFilterValues
} from "@/components/dashboard/queue-filters";
import { QueueSummary } from "@/components/dashboard/queue-summary";
import { PageShell } from "@/components/ui/page-shell";
import { db } from "@/db";
import { governanceReports, useCases } from "@/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DashboardPageProps = {
  searchParams: Promise<Partial<QueueFilterValues>>;
};

const RISK_WEIGHT: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const filters = normalizeFilters(params);
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

  const queueItems: ProposalQueueItem[] = proposals.map((proposal) => ({
    ...proposal,
    latestReport: latestReportByUseCaseId.get(proposal.id) ?? null
  }));

  const departments = uniqueSorted(queueItems.map((item) => item.department));
  const reviewers = uniqueSorted(queueItems.map((item) => item.assignedReviewer));
  const filteredItems = sortQueueItems(
    queueItems.filter((item) => matchesFilters(item, filters)),
    filters.sort
  );
  const summary = buildSummary(queueItems);

  return (
    <PageShell maxWidth="wide">
      <section className="mb-6 flex flex-col gap-5 border-b border-line pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="section-eyebrow">Review queue</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-ink">
            AI use-case governance
          </h1>
          <p className="body-copy mt-2">
            Triage proposed AI initiatives, monitor reviewer ownership, and
            keep high-risk recommendations visible.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            className="btn btn-secondary"
            href="/discovery"
          >
            Discover opportunities
          </Link>
          <Link
            className="btn btn-secondary"
            href="/portfolio"
          >
            Portfolio priorities
          </Link>
          <Link
            className="btn btn-primary"
            href="/use-cases/new"
          >
            New proposal
          </Link>
        </div>
      </section>

      <div className="space-y-5">
        <QueueSummary {...summary} />
        <QueueFilters
          departments={departments}
          filters={filters}
          reviewers={reviewers}
        />
        <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
          <div>
            <p className="section-eyebrow">Active work</p>
            <h2 className="section-title mt-1">Review queue</h2>
          </div>
          <p className="text-sm text-muted">
            Showing {filteredItems.length} of {queueItems.length}
          </p>
        </div>
        <ProposalTable
          emptyMessage="No proposals match the current queue filters."
          proposals={filteredItems}
        />
      </div>
    </PageShell>
  );
}

function normalizeFilters(
  params: Partial<QueueFilterValues>
): QueueFilterValues {
  return {
    department: params.department ?? "",
    reviewer: params.reviewer ?? "",
    risk: params.risk ?? "",
    sort: params.sort ?? "created-desc",
    status: params.status ?? ""
  };
}

function matchesFilters(item: ProposalQueueItem, filters: QueueFilterValues) {
  if (filters.status && item.status !== filters.status) {
    return false;
  }

  if (filters.reviewer && item.assignedReviewer !== filters.reviewer) {
    return false;
  }

  if (filters.department && item.department !== filters.department) {
    return false;
  }

  if (filters.risk === "NO_REPORT" && item.latestReport) {
    return false;
  }

  if (
    filters.risk &&
    filters.risk !== "NO_REPORT" &&
    item.latestReport?.riskLevel !== filters.risk
  ) {
    return false;
  }

  return true;
}

function sortQueueItems(items: ProposalQueueItem[], sort: string) {
  return [...items].sort((a, b) => {
    if (sort === "created-asc") {
      return compareDates(a.createdAt, b.createdAt);
    }

    if (sort === "updated-desc") {
      return compareDates(b.updatedAt, a.updatedAt);
    }

    if (sort === "risk-desc") {
      return (
        (RISK_WEIGHT[b.latestReport?.riskLevel ?? ""] ?? 0) -
        (RISK_WEIGHT[a.latestReport?.riskLevel ?? ""] ?? 0)
      );
    }

    if (sort === "status-asc") {
      return a.status.localeCompare(b.status);
    }

    return compareDates(b.createdAt, a.createdAt);
  });
}

function compareDates(a: string, b: string) {
  return new Date(`${a}Z`).getTime() - new Date(`${b}Z`).getTime();
}

function buildSummary(items: ProposalQueueItem[]) {
  return {
    approved: items.filter((item) =>
      ["APPROVED", "APPROVED_WITH_CONTROLS"].includes(item.status)
    ).length,
    criticalOrHighRisk: items.filter((item) =>
      ["CRITICAL", "HIGH"].includes(item.latestReport?.riskLevel ?? "")
    ).length,
    needsReview: items.filter((item) => item.status === "NEEDS_REVIEW").length,
    pending: items.filter((item) => item.status === "PENDING").length,
    rejected: items.filter((item) => item.status === "REJECTED").length,
    total: items.length,
    withoutReport: items.filter((item) => !item.latestReport).length
  };
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}
