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

type FormState = CreateUseCaseInput;

const initialState: FormState = {
  title: "",
  department: "",
  teamOwner: "",
  currentProcess: "",
  proposedSolution: "",
  expectedBenefit: "",
  dataSensitivity: "INTERNAL",
  decisionImpact: "LOW",
  humanOversightPlanned: "YES",
  affectedStakeholders: "",
  implementationTimeline: ""
};

export function ProposalForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const response = await fetch("/api/use-cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });

    if (!response.ok) {
      setIsSubmitting(false);
      setError("Check the required fields and try submitting again.");
      return;
    }

    const created = (await response.json()) as { id: number };
    router.push(`/use-cases/${created.id}`);
    router.refresh();
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="grid gap-5 md:grid-cols-2">
        <TextInput
          label="Title"
          value={form.title}
          onChange={(value) => updateField("title", value)}
        />
        <TextInput
          label="Department"
          value={form.department}
          onChange={(value) => updateField("department", value)}
        />
        <TextInput
          label="Team owner"
          value={form.teamOwner}
          onChange={(value) => updateField("teamOwner", value)}
        />
        <TextInput
          label="Implementation timeline"
          value={form.implementationTimeline}
          onChange={(value) => updateField("implementationTimeline", value)}
        />
        <SelectInput
          label="Data sensitivity"
          value={form.dataSensitivity}
          values={DATA_SENSITIVITY_VALUES}
          onChange={(value) => updateField("dataSensitivity", value)}
        />
        <SelectInput
          label="Decision impact"
          value={form.decisionImpact}
          values={DECISION_IMPACT_VALUES}
          onChange={(value) => updateField("decisionImpact", value)}
        />
        <SelectInput
          label="Human oversight planned"
          value={form.humanOversightPlanned}
          values={HUMAN_OVERSIGHT_VALUES}
          onChange={(value) => updateField("humanOversightPlanned", value)}
        />
      </div>

      <TextArea
        label="Current process"
        value={form.currentProcess}
        onChange={(value) => updateField("currentProcess", value)}
      />
      <TextArea
        label="Proposed AI solution"
        value={form.proposedSolution}
        onChange={(value) => updateField("proposedSolution", value)}
      />
      <TextArea
        label="Expected benefit"
        value={form.expectedBenefit}
        onChange={(value) => updateField("expectedBenefit", value)}
      />
      <TextArea
        label="Affected stakeholders"
        value={form.affectedStakeholders}
        onChange={(value) => updateField("affectedStakeholders", value)}
      />

      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

      <button
        className="rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Submitting..." : "Submit proposal"}
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
