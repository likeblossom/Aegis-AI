"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function ExploreOpportunityButton({
  opportunityId
}: {
  opportunityId: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className="mt-4 rounded-md bg-ink px-3 py-2 text-center text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-600"
      disabled={isPending}
      onClick={() => {
        startTransition(() => {
          router.push(`/discovery/opportunity/${opportunityId}`);
        });
      }}
      type="button"
    >
      {isPending ? "Loading..." : "Explore Opportunity"}
    </button>
  );
}
