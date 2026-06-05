"use client";

import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
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
      <FormSection
        eyebrow="Ownership"
        title="Who owns this use case?"
        description="Use clear business ownership so reviewers can route questions without hunting through the proposal."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <TextInput
            help="Use the business-facing name reviewers will recognize."
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
            help="Example: pilot in Q3, production by year end."
            label="Implementation timeline"
            value={form.implementationTimeline}
            onChange={(value) => updateField("implementationTimeline", value)}
          />
        </div>
      </FormSection>

      <FormSection
        eyebrow="Operating context"
        title="Describe the current process and proposed change"
        description="Short, concrete descriptions make the generated governance report easier to validate."
      >
        <div className="grid gap-5">
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
        </div>
      </FormSection>

      <FormSection
        eyebrow="Governance inputs"
        title="Classify the risk signals"
        description="These fields determine how much scrutiny the initial governance workflow should apply."
      >
        <div className="grid gap-5 md:grid-cols-3">
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
        <div className="mt-5">
          <TextArea
            label="Affected stakeholders"
            value={form.affectedStakeholders}
            onChange={(value) => updateField("affectedStakeholders", value)}
          />
        </div>
      </FormSection>

      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

      <button
        className="btn btn-primary"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Submitting..." : "Submit proposal"}
      </button>
    </form>
  );
}

function FormSection({
  children,
  description,
  eyebrow,
  title
}: {
  children: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <section className="border-b border-line pb-6 last:border-b-0 last:pb-0">
      <div className="mb-4">
        <p className="section-eyebrow">{eyebrow}</p>
        <h2 className="section-title mt-1">{title}</h2>
        <p className="body-copy mt-1">{description}</p>
      </div>
      {children}
    </section>
  );
}

function TextInput({
  help,
  label,
  value,
  onChange
}: {
  help?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field-label">
      <span>{label}</span>
      <input
        className="field-control"
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {help ? <span className="field-help">{help}</span> : null}
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
    <label className="field-label">
      <span>{label}</span>
      <textarea
        className="field-control min-h-32"
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
    <label className="field-label">
      <span>{label}</span>
      <select
        className="field-control"
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
