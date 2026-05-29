import type { ChangeManagementAnalysis } from "@/server/governance/reportTypes";

type ChangeManagementImpactProps = {
  analysis: ChangeManagementAnalysis;
};

export function ChangeManagementImpact({
  analysis
}: ChangeManagementImpactProps) {
  return (
    <section>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold text-ink">
          Change Management Impact
        </h3>
        <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-medium ${adoptionRiskStyle(analysis.adoptionRisk)}`}>
          {analysis.adoptionRisk} adoption risk
        </span>
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <ListBlock title="Affected teams" items={analysis.affectedTeams} />
        <ListBlock
          title="Expected resistance"
          items={analysis.expectedResistance}
        />
        <ListBlock title="Training needs" items={analysis.trainingNeeds} />
        <ListBlock
          title="Communication plan"
          items={analysis.communicationPlan}
        />
        <ListBlock
          title="Mitigation actions"
          items={analysis.mitigationActions}
        />
      </div>
    </section>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-border bg-panel p-4">
      <h4 className="text-sm font-semibold text-ink">{title}</h4>
      {items.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-muted">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm leading-6 text-muted">
          No specific items identified.
        </p>
      )}
    </div>
  );
}

function adoptionRiskStyle(risk: ChangeManagementAnalysis["adoptionRisk"]) {
  if (risk === "High") {
    return "border-red-700 bg-red-200 text-red-950";
  }

  if (risk === "Medium") {
    return "border-yellow-500 bg-yellow-100 text-yellow-950";
  }

  return "border-emerald-600 bg-emerald-100 text-emerald-950";
}
