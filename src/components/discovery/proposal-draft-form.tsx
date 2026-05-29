"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import {
  DATA_SENSITIVITY_VALUES,
  DECISION_IMPACT_VALUES,
  HUMAN_OVERSIGHT_VALUES,
  formatEnumLabel
} from "@/lib/constants";
import type { CreateUseCaseInput } from "@/lib/validations";

export function ProposalDraftForm({
  opportunityId,
  initialProposal
}: {
  opportunityId: number;
  initialProposal: CreateUseCaseInput;
}) {
  const router = useRouter();
  const [proposal, setProposal] = useState(initialProposal);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateProposal<K extends keyof CreateUseCaseInput>(
    field: K,
    value: CreateUseCaseInput[K]
  ) {
    setProposal((current) => ({ ...current, [field]: value }));
  }

  async function convertProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const response = await fetch("/api/discovery/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opportunityId, proposal })
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setError("Could not create this governance proposal.");
      return;
    }

    const created = (await response.json()) as { id: number };
    router.push(`/use-cases/${created.id}`);
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={convertProposal}>
      <div className="grid gap-5 md:grid-cols-2">
        <TextInput
          label="Title"
          value={proposal.title}
          onChange={(value) => updateProposal("title", value)}
        />
        <TextInput
          label="Department"
          value={proposal.department}
          onChange={(value) => updateProposal("department", value)}
        />
        <TextInput
          label="Team owner"
          value={proposal.teamOwner}
          onChange={(value) => updateProposal("teamOwner", value)}
        />
        <TextInput
          label="Implementation timeline"
          value={proposal.implementationTimeline}
          onChange={(value) => updateProposal("implementationTimeline", value)}
        />
        <SelectInput
          label="Data sensitivity"
          value={proposal.dataSensitivity}
          values={DATA_SENSITIVITY_VALUES}
          onChange={(value) => updateProposal("dataSensitivity", value)}
        />
        <SelectInput
          label="Decision impact"
          value={proposal.decisionImpact}
          values={DECISION_IMPACT_VALUES}
          onChange={(value) => updateProposal("decisionImpact", value)}
        />
        <SelectInput
          label="Human oversight planned"
          value={proposal.humanOversightPlanned}
          values={HUMAN_OVERSIGHT_VALUES}
          onChange={(value) => updateProposal("humanOversightPlanned", value)}
        />
      </div>

      <TextArea
        label="Current process"
        value={proposal.currentProcess}
        onChange={(value) => updateProposal("currentProcess", value)}
      />
      <TextArea
        label="Proposed AI solution"
        value={proposal.proposedSolution}
        onChange={(value) => updateProposal("proposedSolution", value)}
      />
      <TextArea
        label="Expected benefit"
        value={proposal.expectedBenefit}
        onChange={(value) => updateProposal("expectedBenefit", value)}
      />
      <TextArea
        label="Affected stakeholders"
        value={proposal.affectedStakeholders}
        onChange={(value) => updateProposal("affectedStakeholders", value)}
      />

      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

      <button
        className="rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Creating proposal..." : "Create governance proposal"}
      </button>
    </form>
  );
}

function TextInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium text-ink">
      <span>{label}</span>
      <input
        className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium text-ink">
      <span>{label}</span>
      <textarea
        className="mt-2 min-h-28 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SelectInput<T extends string>({
  label,
  value,
  values,
  onChange
}: {
  label: string;
  value: T;
  values: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="block text-sm font-medium text-ink">
      <span>{label}</span>
      <select
        className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {values.map((item) => (
          <option key={item} value={item}>
            {formatEnumLabel(item)}
          </option>
        ))}
      </select>
    </label>
  );
}
