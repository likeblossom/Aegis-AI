import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { BackLink, PageShell } from "@/components/ui/page-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { db } from "@/db";
import { auditLogs, useCases } from "@/db/schema";
import { formatEnumLabel } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function UseCaseDetailPage({ params }: DetailPageProps) {
  const { id } = await params;
  const numericId = Number(id);

  if (!Number.isInteger(numericId)) {
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
    .all();

  return (
    <PageShell>
      <div className="mb-6">
        <BackLink />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-ink">{proposal.title}</h1>
            <p className="mt-2 text-sm text-muted">{proposal.department}</p>
          </div>
          <StatusBadge value={proposal.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-lg border border-border bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-ink">Proposal details</h2>
          <dl className="mt-5 grid gap-5">
            <DetailItem label="Team owner" value={proposal.teamOwner} />
            <DetailItem label="Current process" value={proposal.currentProcess} />
            <DetailItem
              label="Proposed AI solution"
              value={proposal.proposedSolution}
            />
            <DetailItem label="Expected benefit" value={proposal.expectedBenefit} />
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
            />
            <DetailItem
              label="Implementation timeline"
              value={proposal.implementationTimeline}
            />
          </dl>
        </section>

        <aside className="space-y-6">
          <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-ink">Governance analysis</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Governance analysis will be added in a future iteration.
            </p>
          </section>

          <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-ink">Audit log</h2>
            <ol className="mt-4 space-y-4">
              {logs.map((log) => (
                <li key={log.id} className="border-l-2 border-border pl-4">
                  <p className="text-sm font-medium text-ink">
                    {formatEnumLabel(log.action)}
                  </p>
                  <p className="mt-1 text-sm text-muted">{log.note}</p>
                  <p className="mt-1 text-xs text-muted">
                    {new Date(`${log.createdAt}Z`).toLocaleString()}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </PageShell>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-sm leading-6 text-ink">{value}</dd>
    </div>
  );
}
