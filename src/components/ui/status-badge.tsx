import { formatEnumLabel } from "@/lib/constants";

type StatusBadgeProps = {
  value: string;
};

export function StatusBadge({ value }: StatusBadgeProps) {
  return (
    <span className="inline-flex rounded-full border border-border bg-white px-2.5 py-1 text-xs font-medium text-ink">
      {formatEnumLabel(value)}
    </span>
  );
}
