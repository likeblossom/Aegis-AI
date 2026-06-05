import { asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { GovernanceReportView } from "@/components/reports/GovernanceReportView";
import { ReportActions } from "@/components/reports/ReportActions";
import { ReportHistory } from "@/components/reports/ReportHistory";
import { ReviewerAssignmentForm } from "@/components/reports/ReviewerAssignmentForm";
import { ReviewerNotesList } from "@/components/reports/ReviewerNotesList";
import { BackLink, PageShell } from "@/components/ui/page-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { db } from "@/db";
import {
  auditLogs,
  governanceReports,
  reviewerNotes,
  useCases
} from "@/db/schema";
import {
  formatAuditActionLabel,
  formatAuditNoteForDisplay,
  getAuditActorLabel
} from "@/lib/audit-log-formatter";
import { formatEnumLabel } from "@/lib/constants";
import { parseGovernanceReportJson } from "@/server/governance/reportTypes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reportId?: string }>;
};

export default async function UseCaseDetailPage({
  params,
  searchParams
}: DetailPageProps) {
  const { id } = await params;
  const { reportId } = await searchParams;
  const numericId = Number(id);
  const selectedReportId = reportId ? Number(reportId) : null;

  if (
    !Number.isInteger(numericId) ||
    (reportId !== undefined && !Number.isInteger(selectedReportId))
  ) {
    notFound();
  }

  const proposal = db
    .select()
    .from(useCases)
    .where(eq(useCases.id, numericId))
    .get();

  if (!proposal) {
    notFound();
  }

  const logs = db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.useCaseId, proposal.id))
    .orderBy(asc(auditLogs.createdAt))
    .all();

  const reportRecords = db
    .select()
    .from(governanceReports)
    .where(eq(governanceReports.useCaseId, proposal.id))
    .orderBy(desc(governanceReports.createdAt))
    .all();

  const latestReportRecord = reportRecords[0] ?? null;
  const reportRecord = selectedReportId
    ? reportRecords.find((record) => record.id === selectedReportId)
    : latestReportRecord;

  if (selectedReportId && !reportRecord) {
    notFound();
  }

  const report = reportRecord
    ? parseGovernanceReportJson(reportRecord.reportJson)
    : null;
  const latestReport = latestReportRecord
    ? parseGovernanceReportJson(latestReportRecord.reportJson)
    : null;

  const notes = db
    .select()
    .from(reviewerNotes)
    .where(eq(reviewerNotes.useCaseId, proposal.id))
    .orderBy(asc(reviewerNotes.createdAt))
    .all();
  const assignedReviewer = proposal.assignedReviewer;
  const reviewerAssignedCases =
    assignedReviewer === "Unassigned"
      ? []
      : db
          .select()
          .from(useCases)
          .where(eq(useCases.assignedReviewer, assignedReviewer))
          .all();
  const reviewerQueueCount =
    assignedReviewer === "Unassigned"
      ? 0
      : reviewerAssignedCases.filter((item) =>
          ["PENDING", "NEEDS_REVIEW", "REJECTED"].includes(item.status)
        ).length;
  const reviewerRecentCount =
    assignedReviewer === "Unassigned"
      ? 0
      : db
          .select()
          .from(reviewerNotes)
          .where(eq(reviewerNotes.reviewerName, assignedReviewer))
          .all().length;

  return (
    <PageShell>
      <div className="mb-6 space-y-5">
        <BackLink />
        <section className="app-panel p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={proposal.status} />
                <span className="rounded-full border border-line bg-panel px-2.5 py-1 text-xs font-medium text-muted">
                  {proposal.department}
                </span>
                <span className="rounded-full border border-line bg-panel px-2.5 py-1 text-xs font-medium text-muted">
                  ID {proposal.id}
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-normal text-ink">
                {proposal.title}
              </h1>
              <p className="body-copy mt-3">
                {proposal.proposedSolution}
              </p>
            </div>
            <div className="grid min-w-full gap-3 sm:grid-cols-2 lg:min-w-[360px]">
              <SummaryTile label="Reviewer" value={proposal.assignedReviewer} />
              <SummaryTile
                label="Report"
                value={latestReportRecord ? `v${latestReportRecord.reportVersion}` : "Not generated"}
              />
              <SummaryTile
                label="Risk"
                value={latestReport ? formatEnumLabel(latestReport.riskLevel) : "Pending"}
              />
              <SummaryTile
                label="Recommendation"
                value={
                  latestReport
                    ? formatEnumLabel(latestReport.finalRecommendation)
                    : "Pending analysis"
                }
              />
            </div>
          </div>
        </section>
        <div className="grid gap-3 md:grid-cols-4">
          <MetricPill
            label="Data sensitivity"
            value={formatEnumLabel(proposal.dataSensitivity)}
          />
          <MetricPill
            label="Decision impact"
            value={formatEnumLabel(proposal.decisionImpact)}
          />
          <MetricPill
            label="Human oversight"
            value={formatEnumLabel(proposal.humanOversightPlanned)}
          />
          <MetricPill label="Timeline" value={proposal.implementationTimeline} />
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          <section className="app-panel p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="section-eyebrow">
                  Intake summary
                </p>
                <h2 className="section-title mt-1">
                  Proposal details
                </h2>
              </div>
              <p className="text-xs leading-5 text-muted">
                Created {new Date(`${proposal.createdAt}Z`).toLocaleDateString()}
              </p>
            </div>

            <div className="mt-5 grid gap-5">
              <DetailGroup title="Ownership">
                <DetailItem label="Team owner" value={proposal.teamOwner} />
                <DetailItem
                  label="Assigned reviewer"
                  value={proposal.assignedReviewer}
                />
                <DetailItem label="Department" value={proposal.department} />
              </DetailGroup>

              <DetailGroup title="Operating context">
                <DetailItem
                  label="Current process"
                  value={proposal.currentProcess}
                  prominent
                />
                <DetailItem
                  label="Proposed AI solution"
                  value={proposal.proposedSolution}
                  prominent
                />
                <DetailItem
                  label="Expected benefit"
                  value={proposal.expectedBenefit}
                  prominent
                />
              </DetailGroup>

              <DetailGroup title="Governance inputs">
                <DetailItem
                  label="Data sensitivity"
                  value={formatEnumLabel(proposal.dataSensitivity)}
                />
                <DetailItem
                  label="Decision impact"
                  value={formatEnumLabel(proposal.decisionImpact)}
                />
                <DetailItem
                  label="Human oversight planned"
                  value={formatEnumLabel(proposal.humanOversightPlanned)}
                />
                <DetailItem
                  label="Affected stakeholders"
                  value={proposal.affectedStakeholders}
                  prominent
                />
                <DetailItem
                  label="Implementation timeline"
                  value={proposal.implementationTimeline}
                />
              </DetailGroup>
            </div>
          </section>

          <GovernanceReportView
            report={report}
            reportLabel={
              reportRecord?.id === latestReportRecord?.id
                ? "Latest report"
                : "Historical report"
            }
            reportRecord={reportRecord}
          />
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6">
          <ReviewerAssignmentForm
            assignedReviewer={proposal.assignedReviewer}
            reviewerQueueCount={reviewerQueueCount}
            reviewerRecentCount={reviewerRecentCount}
            useCaseId={proposal.id}
          />

          <ReportActions
            currentStatus={proposal.status}
            hasReport={Boolean(latestReportRecord)}
            useCaseId={proposal.id}
          />

          <ReviewerNotesList notes={notes} useCaseId={proposal.id} />

          <ReportHistory
            reports={reportRecords}
            selectedReportId={reportRecord?.id ?? null}
            useCaseId={proposal.id}
          />

          <section className="app-panel p-5">
            <div>
              <p className="section-eyebrow">
                Activity
              </p>
              <h2 className="section-title mt-1">Audit log</h2>
            </div>
            <ol className="mt-4 space-y-4">
              {logs.map((log) => (
                <li key={log.id} className="relative pl-5">
                  <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border border-slate-300 bg-white" />
                  <div className="border-l border-border pb-4 pl-4">
                    <p className="text-sm font-semibold text-ink">
                      {formatAuditActionLabel(log.action)}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      {formatAuditNoteForDisplay(log.action, log.note)}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {getAuditActorLabel(log.action)} -{" "}
                      {new Date(`${log.createdAt}Z`).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </PageShell>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line bg-panel px-4 py-3">
      <p className="section-eyebrow">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile">
      <p className="section-eyebrow">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-6 text-ink">{value}</p>
    </div>
  );
}

function DetailGroup({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function DetailItem({
  label,
  value,
  prominent = false
}: {
  label: string;
  value: string;
  prominent?: boolean;
}) {
  return (
    <div
      className={
        prominent
          ? "border border-line bg-panel p-4 sm:col-span-2"
          : "border border-line bg-panel p-4"
      }
    >
      <p className="section-eyebrow">{label}</p>
      <p className="mt-1 text-sm leading-6 text-ink">{value}</p>
    </div>
  );
}
