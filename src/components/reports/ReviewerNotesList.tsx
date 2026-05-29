"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import type { ReviewerNote } from "@/db/schema";
import { formatEnumLabel } from "@/lib/constants";

type ReviewerNotesListProps = {
  notes: ReviewerNote[];
  useCaseId: number;
};

export function ReviewerNotesList({ notes, useCaseId }: ReviewerNotesListProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing(note: ReviewerNote) {
    setEditingId(note.id);
    setNoteText(note.note);
    setReviewerName(note.reviewerName);
    setError(null);
  }

  function stopEditing() {
    setEditingId(null);
    setNoteText("");
    setReviewerName("");
    setError(null);
  }

  async function updateNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (editingId === null) {
      return;
    }

    setError(null);
    setIsSaving(true);

    const response = await fetch(
      `/api/use-cases/${useCaseId}/reviewer-notes/${editingId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteText, reviewerName })
      }
    );

    setIsSaving(false);

    if (!response.ok) {
      setError("Could not update the reviewer note.");
      return;
    }

    stopEditing();
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">Reviewer notes</h2>
      {notes.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-muted">
          No reviewer notes have been added yet.
        </p>
      ) : (
        <ol className="mt-4 space-y-4">
          {notes.map((note) => (
            <li key={note.id} className="border-l-2 border-border pl-4">
              {editingId === note.id ? (
                <form className="space-y-3" onSubmit={updateNote}>
                  <label className="block text-sm font-medium text-ink">
                    <span>Reviewer name</span>
                    <input
                      className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                      value={reviewerName}
                      onChange={(event) => setReviewerName(event.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    <span>Review note</span>
                    <textarea
                      className="mt-2 min-h-24 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                      value={noteText}
                      onChange={(event) => setNoteText(event.target.value)}
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isSaving}
                      type="submit"
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      className="rounded-md border border-border bg-panel px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-100"
                      type="button"
                      onClick={stopEditing}
                    >
                      Cancel
                    </button>
                  </div>
                  {error ? (
                    <p className="text-sm font-medium text-red-700">{error}</p>
                  ) : null}
                </form>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-ink">
                      {formatEnumLabel(note.status)}
                    </p>
                    <button
                      className="text-xs font-semibold text-slate-800 underline underline-offset-4 hover:text-black"
                      type="button"
                      onClick={() => startEditing(note)}
                    >
                      Edit
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-muted">{note.note}</p>
                  <p className="mt-1 text-xs text-muted">
                    {note.reviewerName} -{" "}
                    {new Date(`${note.createdAt}Z`).toLocaleString()}
                    {note.updatedAt !== note.createdAt
                      ? ` - Edited ${new Date(`${note.updatedAt}Z`).toLocaleString()}`
                      : ""}
                  </p>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
