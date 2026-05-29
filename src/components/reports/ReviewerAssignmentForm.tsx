"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

type ReviewerAssignmentFormProps = {
  assignedReviewer: string;
  useCaseId: number;
};

export function ReviewerAssignmentForm({
  assignedReviewer,
  useCaseId
}: ReviewerAssignmentFormProps) {
  const router = useRouter();
  const [value, setValue] = useState(assignedReviewer);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
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

    router.refresh();
  }

  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">Reviewer assignment</h2>
      <form className="mt-4 space-y-3" onSubmit={updateAssignment}>
        <label className="block text-sm font-medium text-ink">
          <span>Assigned reviewer</span>
          <input
            className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
        <button
          className="w-full rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSaving}
          type="submit"
        >
          {isSaving ? "Saving..." : "Save assignment"}
        </button>
        {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
      </form>
    </section>
  );
}
