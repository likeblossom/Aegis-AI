type QueueSummaryProps = {
  approved: number;
  criticalOrHighRisk: number;
  needsReview: number;
  pending: number;
  rejected: number;
  total: number;
  withoutReport: number;
};

export function QueueSummary({
  approved,
  criticalOrHighRisk,
  needsReview,
  pending,
  rejected,
  total,
  withoutReport
}: QueueSummaryProps) {
  const items = [
    { label: "Total", tone: "neutral", value: total },
    { label: "Pending", tone: "neutral", value: pending },
    { label: "Needs review", tone: "warning", value: needsReview },
    { label: "High risk", tone: "danger", value: criticalOrHighRisk },
    { label: "No report", tone: "warning", value: withoutReport },
    { label: "Approved", tone: "success", value: approved },
    { label: "Rejected", tone: "danger", value: rejected }
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {items.map((item) => (
        <div
          className="metric-tile"
          key={item.label}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="section-eyebrow">{item.label}</p>
            <span className={`h-2 w-2 rounded-full ${dotClass(item.tone)}`} />
          </div>
          <p className="mt-2 text-2xl font-semibold leading-none text-ink">
            {item.value}
          </p>
        </div>
      ))}
    </section>
  );
}

function dotClass(tone: string) {
  if (tone === "success") {
    return "bg-emerald-500";
  }

  if (tone === "warning") {
    return "bg-amber-500";
  }

  if (tone === "danger") {
    return "bg-red-500";
  }

  return "bg-slate-400";
}
