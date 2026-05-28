import Link from "next/link";
import { desc } from "drizzle-orm";
import { ProposalTable } from "@/components/dashboard/proposal-table";
import { PageShell } from "@/components/ui/page-shell";
import { db } from "@/db";
import { useCases } from "@/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function DashboardPage() {
  const proposals = db.select().from(useCases).orderBy(desc(useCases.createdAt)).all();

  return (
    <PageShell>
      <section className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal text-ink">
            Aegis
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            AI Governance & Use-Case Evaluation Platform for collecting proposed
            AI initiatives and tracking review status.
          </p>
        </div>
        <Link
          className="inline-flex w-fit rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          href="/use-cases/new"
        >
          New proposal
        </Link>
      </section>

      <ProposalTable proposals={proposals} />
    </PageShell>
  );
}
