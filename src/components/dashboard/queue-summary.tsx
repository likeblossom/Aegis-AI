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
    { label: "Total", value: total },
    { label: "Pending", value: pending },
    { label: "Needs review", value: needsReview },
    { label: "Approved", value: approved },
    { label: "Rejected", value: rejected },
    { label: "High risk", value: criticalOrHighRisk },
    { label: "No report", value: withoutReport }
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {items.map((item) => (
        <div
          className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm"
          key={item.label}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {item.label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-ink">{item.value}</p>
        </div>
      ))}
    </section>
  );
}
