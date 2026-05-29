type RolloutStrategyProps = {
  steps: string[];
};

export function RolloutStrategy({ steps }: RolloutStrategyProps) {
  return (
    <section>
      <h3 className="text-base font-semibold text-ink">Rollout strategy</h3>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-muted">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </section>
  );
}
