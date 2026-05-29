import type { SimulatedGovernanceReview } from "@/server/governance/reportTypes";

type SimulatedReviewsProps = {
  reviews: SimulatedGovernanceReview[];
};

export function SimulatedReviews({ reviews }: SimulatedReviewsProps) {
  return (
    <section>
      <h3 className="text-base font-semibold text-ink">
        Simulated governance reviews
      </h3>
      <div className="mt-3 grid gap-3">
        {reviews.map((review) => (
          <div key={review.reviewer} className="rounded-md border border-border p-4">
            <p className="font-medium text-ink">{review.reviewer}</p>
            <ReviewList title="Concerns" values={review.concerns} />
            <ReviewList title="Recommendations" values={review.recommendations} />
            <ReviewList
              title="Approval conditions"
              values={review.approvalConditions}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function ReviewList({ title, values }: { title: string; values: string[] }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-muted">
        {values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
    </div>
  );
}
