import { formatEnumLabel } from "@/lib/constants";

type RiskBreakdownProps = {
  riskLevel: string;
  aiReadinessScore: number;
  finalRecommendation: string;
  confidenceLevel: string;
};

export function RiskBreakdown({
  riskLevel,
  aiReadinessScore,
  finalRecommendation,
  confidenceLevel
}: RiskBreakdownProps) {
  const items = [
    ["Risk level", formatEnumLabel(riskLevel)],
    ["AI readiness", `${aiReadinessScore}/100`],
    ["Recommendation", formatEnumLabel(finalRecommendation)],
    ["Confidence", formatEnumLabel(confidenceLevel)]
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-md border border-border bg-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {label}
          </p>
          <p className="mt-2 text-lg font-semibold text-ink">{value}</p>
        </div>
      ))}
    </div>
  );
}
