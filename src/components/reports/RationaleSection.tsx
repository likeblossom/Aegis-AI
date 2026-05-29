import type { RationaleItem } from "@/server/governance/reportTypes";

type RationaleSectionProps = {
  rationale: RationaleItem[];
};

export function RationaleSection({ rationale }: RationaleSectionProps) {
  return (
    <section>
      <h3 className="text-base font-semibold text-ink">Analysis rationale</h3>
      <div className="mt-3 space-y-3">
        {rationale.map((item) => (
          <div key={item.finding} className="rounded-md border border-border p-4">
            <p className="font-medium text-ink">{item.finding}</p>
            <dl className="mt-3 grid gap-3 text-sm leading-6">
              <TextItem label="Why it matters" value={item.whyItMatters} />
              <TextItem label="Evidence" value={item.evidenceFromProposal} />
              <TextItem label="Recommended action" value={item.recommendedAction} />
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

function TextItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-muted">{value}</dd>
    </div>
  );
}
