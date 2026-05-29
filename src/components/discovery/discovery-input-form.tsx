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
        value={input.businessProblem}
        onChange={(value) => updateInput("businessProblem", value)}
      />
      <TextArea
        label="Current pain points"
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
        className="rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
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
  required = true,
  onChange
}: {
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium text-ink">
      <span>{label}</span>
      <textarea
        className="mt-2 min-h-28 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
