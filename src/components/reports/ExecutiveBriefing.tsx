import type { ExecutiveBriefing as ExecutiveBriefingObject } from "@/server/governance/reportTypes";

type ExecutiveBriefingProps = {
  briefing: ExecutiveBriefingObject;
};

export function ExecutiveBriefing({ briefing }: ExecutiveBriefingProps) {
  return (
    <section className="border border-slate-300 bg-slate-50 p-4">
      <div>
        <p className="section-eyebrow">Executive Briefing</p>
        <h3 className="mt-1 text-xl font-semibold leading-7 text-ink">
          {briefing.headline}
        </h3>
      </div>

      <div className="mt-4 grid gap-x-6 gap-y-4 lg:grid-cols-2">
        <BriefingBlock
          title="Recommendation summary"
          content={briefing.recommendationSummary}
        />
        <BriefingBlock
          title="Expected business value"
          content={briefing.expectedBusinessValue}
        />
        <BriefingList title="Top risks" items={briefing.topRisks} />
        <BriefingList
          title="Required controls"
          items={briefing.requiredControls}
        />
      </div>

      <div className="mt-4 grid gap-x-6 gap-y-4 border-t border-slate-300 pt-4 lg:grid-cols-2">
        <BriefingBlock
          title="Suggested next step"
          content={briefing.suggestedNextStep}
        />
        <BriefingBlock
          title="Decision question"
          content={briefing.decisionQuestion}
        />
      </div>
    </section>
  );
}

function BriefingBlock({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-ink">{title}</h4>
      <p className="mt-1 text-sm leading-7 text-muted">{content}</p>
    </div>
  );
}

function BriefingList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-ink">{title}</h4>
      {items.length > 0 ? (
        <ul className="mt-1 list-disc space-y-1.5 pl-5 text-sm leading-7 text-muted">
          {itemList(items)}
        </ul>
      ) : (
        <p className="mt-1 text-sm leading-7 text-muted">
          No specific items identified.
        </p>
      )}
    </div>
  );
}

function itemList(items: string[]) {
  return items.map((item) => <li key={item}>{item}</li>);
}
