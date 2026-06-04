"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { formatGenerationFailureReason } from "@/lib/audit-log-formatter";
import { REVIEW_STATUS_VALUES, formatEnumLabel } from "@/lib/constants";
import type { ReviewStatus } from "@/lib/validations";

type ReportActionsProps = {
  useCaseId: number;
  currentStatus: string;
  hasReport: boolean;
};

export function ReportActions({
  useCaseId,
  currentStatus,
  hasReport
}: ReportActionsProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [status, setStatus] = useState<ReviewStatus>(
    currentStatus === "PENDING" ? "NEEDS_REVIEW" : (currentStatus as ReviewStatus)
  );
  const [note, setNote] = useState("");
  const [reviewerName, setReviewerName] = useState("Governance reviewer");
  const [error, setError] = useState<string | null>(null);
  const [generationNotice, setGenerationNotice] = useState<string | null>(null);

  async function generateReport() {
    setError(null);
    setGenerationNotice(null);
    setIsGenerating(true);

    const response = await fetch(`/api/use-cases/${useCaseId}/generate-report`, {
      method: "POST"
    });

    setIsGenerating(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        detail?: string;
      } | null;
      setError(body?.error ?? "Could not generate the governance report.");
      return;
    }

    const body = (await response.json()) as {
      analysisMode: "AZURE_OPENAI" | "LOCAL_FALLBACK";
      fallbackReason: string | null;
    };

    setGenerationNotice(
      body.analysisMode === "AZURE_OPENAI"
        ? "Azure OpenAI generated the latest governance report with deterministic guardrails."
        : body.fallbackReason
          ? `${formatGenerationFailureReason(
              body.fallbackReason
            )}. Local fallback analysis generated the report.`
          : "Local fallback analysis generated the report."
    );
    router.refresh();
  }

  async function updateReviewStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsReviewing(true);

    const response = await fetch(`/api/use-cases/${useCaseId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, note, reviewerName })
    });

    setIsReviewing(false);

    if (!response.ok) {
      setError("Could not update the review status.");
      return;
    }

    setNote("");
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Workflow
        </p>
        <h2 className="mt-1 text-lg font-semibold text-ink">Review actions</h2>
      </div>
      <div className="mt-4 space-y-5">
        <button
          className="w-full rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isGenerating}
          type="button"
          onClick={generateReport}
        >
          {isGenerating ? "Generating..." : "Generate governance report"}
        </button>
        <p className="text-xs leading-5 text-muted">
          Azure analysis can take several seconds. If Azure is unavailable, Aegis-AI
          saves a local fallback report.
        </p>
        {generationNotice ? (
          <p className="rounded-md border border-border bg-panel px-3 py-2 text-xs leading-5 text-muted">
            {generationNotice}
          </p>
        ) : null}

        <form className="space-y-3" onSubmit={updateReviewStatus}>
          <label className="block text-sm font-medium text-ink">
            <span>Reviewer decision</span>
            <select
              className="mt-2 w-full rounded-md border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-slate-500"
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
          <label className="block text-sm font-medium text-ink">
            <span>Reviewer name</span>
            <input
              className="mt-2 w-full rounded-md border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-slate-500"
              value={reviewerName}
              onChange={(event) => setReviewerName(event.target.value)}
            />
          </label>
          <label className="block text-sm font-medium text-ink">
            <span>Review note</span>
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-slate-500"
              placeholder="Document rationale, required follow-up, or approval conditions."
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          {!hasReport ? (
            <p className="text-xs leading-5 text-muted">
              Approval decisions require a generated governance report.
            </p>
          ) : null}
          <button
            className="w-full rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
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
