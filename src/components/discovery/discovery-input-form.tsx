"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import type { OpportunityDiscoveryInput } from "@/server/discovery/discoveryTypes";

const initialDiscoveryInput: OpportunityDiscoveryInput = {
  businessProblem: "",
  department: "",
  affectedTeams: "",
  currentPainPoints: "",
  goals: ""
};

export function DiscoveryInputForm() {
  const router = useRouter();
  const [input, setInput] = useState(initialDiscoveryInput);
  const [error, setError] = useState<string | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);

  function updateInput<K extends keyof OpportunityDiscoveryInput>(
    field: K,
    value: OpportunityDiscoveryInput[K]
  ) {
    setInput((current) => ({ ...current, [field]: value }));
  }

  async function runDiscovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsDiscovering(true);

    const response = await fetch("/api/discovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });

    setIsDiscovering(false);

    if (!response.ok) {
      setError("Check the discovery fields and try again.");
      return;
    }

    const body = (await response.json()) as { sessionId: number };
    router.push(`/discovery/results/${body.sessionId}`);
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={runDiscovery}>
      <div>
        <p className="section-eyebrow">Discovery brief</p>
        <h2 className="section-title mt-1">Define the operational problem</h2>
        <p className="body-copy mt-1">
          Keep the brief specific so opportunities can be ranked by practical
          impact and governance risk.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <TextInput
          label="Department"
          value={input.department}
          onChange={(value) => updateInput("department", value)}
        />
        <TextInput
          label="Affected team(s)"
          value={input.affectedTeams}
          onChange={(value) => updateInput("affectedTeams", value)}
        />
      </div>
      <TextArea
        label="Business problem"
        help="Describe the decision, workflow, or bottleneck the team wants to improve."
        value={input.businessProblem}
        onChange={(value) => updateInput("businessProblem", value)}
      />
      <TextArea
        label="Current pain points"
        help="List the operational problems reviewers should understand first."
        value={input.currentPainPoints}
        onChange={(value) => updateInput("currentPainPoints", value)}
      />
      <TextArea
        label="Goals"
        required={false}
        value={input.goals}
        onChange={(value) => updateInput("goals", value)}
      />

      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

      <button
        className="btn btn-primary"
        disabled={isDiscovering}
        type="submit"
      >
        {isDiscovering ? "Discovering..." : "Discover opportunities"}
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
    <label className="field-label">
      <span>{label}</span>
      <input
        className="field-control"
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextArea({
  help,
  label,
  value,
  required = true,
  onChange
}: {
  help?: string;
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field-label">
      <span>{label}</span>
      <textarea
        className="field-control min-h-32"
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {help ? <span className="field-help">{help}</span> : null}
    </label>
  );
}
