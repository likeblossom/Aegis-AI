import Link from "next/link";
import { DiscoveryInputForm } from "@/components/discovery/discovery-input-form";
import { DiscoveryProgress } from "@/components/discovery/discovery-progress";
import { BackLink, PageShell } from "@/components/ui/page-shell";
import { getRecentDiscoverySessions } from "@/server/discovery/discoveryRepository";

export const runtime = "nodejs";

export default function DiscoveryPage() {
  const recentSessions = getRecentDiscoverySessions();

  return (
    <PageShell maxWidth="wide">
      <div className="mb-6 border-b border-line pb-6">
        <BackLink />
        <p className="section-eyebrow mt-4">Opportunity discovery</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">
          AI Opportunity Discovery Assistant
        </h1>
        <p className="body-copy mt-2">
          Start with a business problem, identify practical AI opportunities,
          and convert the best option into a formal governance proposal.
        </p>
      </div>

      <DiscoveryProgress currentStep={1} />

      <section className="app-panel p-5 sm:p-6">
        <DiscoveryInputForm />
      </section>

      {recentSessions.length > 0 ? (
        <section className="mt-6 border-t border-line pt-6">
          <h2 className="section-title">Recent discovery sessions</h2>
          <div className="mt-3 grid gap-3">
            {recentSessions.map((session) => (
              <Link
                key={session.id}
                className="app-panel block p-3 hover:bg-panel"
                href={`/discovery/results/${session.id}`}
              >
                <p className="text-sm font-semibold text-ink">
                  {session.department}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {session.businessProblem}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}
