import type { ReactNode } from "react";
import { formatEnumLabel } from "@/lib/constants";
import type { RedFlag } from "@/server/governance/reportTypes";

type RedFlagsSectionProps = {
  redFlags: RedFlag[];
};

export function RedFlagsSection({ redFlags }: RedFlagsSectionProps) {
  if (redFlags.length === 0) {
    return (
      <Section title="Red flags">
        <p className="text-sm leading-6 text-muted">
          No major deterministic red flags were detected.
        </p>
      </Section>
    );
  }

  return (
    <Section title="Red flags">
      <div className="space-y-3">
        {redFlags.map((flag) => (
          <div key={flag.issue} className="rounded-md border border-border p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <p className="font-medium text-ink">{flag.issue}</p>
              <span className="w-fit rounded-full border border-border bg-panel px-2.5 py-1 text-xs font-medium text-ink">
                {formatEnumLabel(flag.severity)}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted">{flag.explanation}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Section({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}
