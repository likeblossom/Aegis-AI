"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

type ReviewerAssignmentFormProps = {
  assignedReviewer: string;
  reviewerQueueCount: number;
  reviewerRecentCount: number;
  useCaseId: number;
};

export function ReviewerAssignmentForm({
  assignedReviewer,
  reviewerQueueCount,
  reviewerRecentCount,
  useCaseId
}: ReviewerAssignmentFormProps) {
  const router = useRouter();
  const [value, setValue] = useState(assignedReviewer);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const hasChanged = value.trim() !== assignedReviewer;

  async function updateAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSavedMessage(null);
    setIsSaving(true);

    const response = await fetch(`/api/use-cases/${useCaseId}/assignment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedReviewer: value })
    });

    setIsSaving(false);

    if (!response.ok) {
      setError("Could not update the assigned reviewer.");
      return;
    }

    setSavedMessage("Assignment updated.");
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Ownership
        </p>
        <h2 className="mt-1 text-lg font-semibold text-ink">
          Reviewer assignment
        </h2>
      </div>
      <form className="mt-4 space-y-3" onSubmit={updateAssignment}>
        <label className="block text-sm font-medium text-ink">
          <span>Assigned reviewer</span>
          <input
            className="mt-2 w-full rounded-md border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-slate-500"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <ReviewerMetric label="Open queue" value={reviewerQueueCount} />
          <ReviewerMetric label="Recent notes" value={reviewerRecentCount} />
        </div>
        <p className="text-xs leading-5 text-muted">
          Open queue counts proposals assigned to this reviewer that are still
          pending, rejected, or waiting for additional review.
        </p>
        <button
          className="w-full rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSaving || !hasChanged}
          type="submit"
        >
          {isSaving ? "Saving..." : "Save assignment"}
        </button>
        {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
        {savedMessage ? (
          <p className="text-sm font-medium text-emerald-700">{savedMessage}</p>
        ) : null}
      </form>
    </section>
  );
}

function ReviewerMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-panel px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}
