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
      <div className="mb-6">
        <BackLink />
        <h1 className="mt-4 text-2xl font-semibold text-ink">
          AI Opportunity Discovery Assistant
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Start with a business problem, identify practical AI opportunities,
          and convert the best option into a formal governance proposal.
        </p>
      </div>

      <DiscoveryProgress currentStep={1} />

      <section className="rounded-lg border border-border bg-white p-5 shadow-sm sm:p-6">
        <DiscoveryInputForm />
      </section>

      {recentSessions.length > 0 ? (
        <section className="mt-6 rounded-lg border border-border bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-ink">
            Recent discovery sessions
          </h2>
          <div className="mt-3 grid gap-3">
            {recentSessions.map((session) => (
              <Link
                key={session.id}
                className="rounded-md border border-border bg-panel p-3 hover:bg-white"
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
