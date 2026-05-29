import { formatEnumLabel } from "@/lib/constants";

type StatusBadgeProps = {
  value: string;
};

export function StatusBadge({ value }: StatusBadgeProps) {
  const style = getBadgeStyle(value);

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${style}`}
    >
      {formatEnumLabel(value)}
    </span>
  );
}

function getBadgeStyle(value: string) {
  if (value === "PENDING") {
    return "border-sky-200 bg-sky-50 text-sky-800";
  }

  if (["APPROVED", "LOW"].includes(value)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (["APPROVED_WITH_CONTROLS", "MEDIUM"].includes(value)) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (["NEEDS_REVIEW", "HIGH"].includes(value)) {
    return "border-orange-200 bg-orange-50 text-orange-800";
  }

  if (["REJECTED", "CRITICAL"].includes(value)) {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  return "border-border bg-white text-ink";
}
