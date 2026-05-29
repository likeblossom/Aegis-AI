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
    return "border-sky-500 bg-sky-100 text-sky-950";
  }

  if (["APPROVED", "LOW"].includes(value)) {
    return "border-emerald-600 bg-emerald-100 text-emerald-950";
  }

  if (["APPROVED_WITH_CONTROLS", "MEDIUM"].includes(value)) {
    return "border-yellow-500 bg-yellow-100 text-yellow-950";
  }

  if (["NEEDS_REVIEW", "HIGH"].includes(value)) {
    return "border-red-600 bg-red-100 text-red-950";
  }

  if (["REJECTED", "CRITICAL"].includes(value)) {
    return "border-red-700 bg-red-200 text-red-950";
  }

  return "border-border bg-white text-ink";
}
