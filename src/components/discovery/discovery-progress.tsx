const steps = [
  "Discover",
  "Analyze",
  "Evaluate",
  "Generate Proposal",
  "Governance Review"
];

export function DiscoveryProgress({ currentStep }: { currentStep: number }) {
  return (
    <nav className="mb-6 rounded-lg border border-border bg-white p-3 shadow-sm">
      <ol className="grid gap-2 text-xs font-semibold text-muted sm:grid-cols-5">
        {steps.map((step, index) => {
          const active = index + 1 === currentStep;
          const complete = index + 1 < currentStep;

          return (
            <li
              key={step}
              className={`rounded-md border px-3 py-2 ${
                active
                  ? "border-slate-700 bg-slate-100 text-ink"
                  : complete
                    ? "border-emerald-600 bg-emerald-100 text-emerald-950"
                    : "border-border bg-panel"
              }`}
            >
              {index + 1}. {step}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
