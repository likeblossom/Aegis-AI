"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { REVIEW_STATUS_VALUES, formatEnumLabel } from "@/lib/constants";
import type { ReviewStatus } from "@/lib/validations";

type ReportActionsProps = {
  useCaseId: number;
  currentStatus: string;
};

export function ReportActions({ useCaseId, currentStatus }: ReportActionsProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [status, setStatus] = useState<ReviewStatus>(
    currentStatus === "PENDING" ? "NEEDS_REVIEW" : (currentStatus as ReviewStatus)
  );
  const [error, setError] = useState<string | null>(null);

  async function generateReport() {
    setError(null);
    setIsGenerating(true);

    const response = await fetch(`/api/use-cases/${useCaseId}/generate-report`, {
      method: "POST"
    });

    setIsGenerating(false);

    if (!response.ok) {
      setError("Could not generate the governance report.");
      return;
    }

    router.refresh();
  }

  async function updateReviewStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsReviewing(true);

    const response = await fetch(`/api/use-cases/${useCaseId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });

    setIsReviewing(false);

    if (!response.ok) {
      setError("Could not update the review status.");
      return;
    }

    router.refresh();
  }

  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">Review actions</h2>
      <div className="mt-4 space-y-5">
        <button
          className="w-full rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isGenerating}
          type="button"
          onClick={generateReport}
        >
          {isGenerating ? "Generating..." : "Generate governance report"}
        </button>

        <form className="space-y-3" onSubmit={updateReviewStatus}>
          <label className="block text-sm font-medium text-ink">
            <span>Reviewer decision</span>
            <select
              className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
              value={status}
              onChange={(event) => setStatus(event.target.value as ReviewStatus)}
            >
              {REVIEW_STATUS_VALUES.map((item) => (
                <option key={item} value={item}>
                  {formatEnumLabel(item)}
                </option>
              ))}
            </select>
          </label>
          <button
            className="w-full rounded-md border border-border bg-panel px-4 py-2.5 text-sm font-semibold text-ink hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isReviewing}
            type="submit"
          >
            {isReviewing ? "Updating..." : "Update review status"}
          </button>
        </form>

        {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
      </div>
    </section>
  );
}
