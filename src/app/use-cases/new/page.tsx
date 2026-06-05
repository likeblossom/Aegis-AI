import { ProposalForm } from "@/components/forms/proposal-form";
import { BackLink, PageShell } from "@/components/ui/page-shell";

export const runtime = "nodejs";

export default function NewUseCasePage() {
  return (
    <PageShell>
      <div className="mb-6 border-b border-line pb-6">
        <BackLink />
        <p className="section-eyebrow mt-4">Proposal intake</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">
          Submit AI use-case proposal
        </h1>
        <p className="body-copy mt-2">
          Capture the core business context needed for an initial governance
          review. AI analysis is intentionally not part of this first version.
        </p>
      </div>

      <section className="app-panel p-5 sm:p-6">
        <ProposalForm />
      </section>
    </PageShell>
  );
}
