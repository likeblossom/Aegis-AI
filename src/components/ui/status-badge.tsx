import { formatEnumLabel } from "@/lib/constants";

type StatusBadgeProps = {
  value: string;
};

export function StatusBadge({ value }: StatusBadgeProps) {
  const style = getBadgeStyle(value);

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${style}`}
    >
      {formatEnumLabel(value)}
    </span>
  );
}

function getBadgeStyle(value: string) {
  if (value === "PENDING") {
    return "border-sky-300 bg-sky-50 text-sky-900";
  }

  if (["APPROVED", "LOW"].includes(value)) {
    return "border-emerald-300 bg-emerald-50 text-emerald-900";
  }

  if (["APPROVED_WITH_CONTROLS", "MEDIUM"].includes(value)) {
    return "border-amber-300 bg-amber-50 text-amber-950";
  }

  if (["NEEDS_REVIEW", "HIGH"].includes(value)) {
    return "border-orange-300 bg-orange-50 text-orange-950";
  }

  if (["REJECTED", "CRITICAL"].includes(value)) {
    return "border-red-300 bg-red-50 text-red-950";
  }

  return "border-line bg-white text-ink";
}
