import { ProposalForm } from "@/components/forms/proposal-form";
import { BackLink, PageShell } from "@/components/ui/page-shell";

export const runtime = "nodejs";

export default function NewUseCasePage() {
  return (
    <PageShell>
      <div className="mb-6">
        <BackLink />
        <h1 className="mt-4 text-2xl font-semibold text-ink">
          Submit AI use-case proposal
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Capture the core business context needed for an initial governance
          review. AI analysis is intentionally not part of this first version.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-white p-5 shadow-sm sm:p-6">
        <ProposalForm />
      </section>
    </PageShell>
  );
}
