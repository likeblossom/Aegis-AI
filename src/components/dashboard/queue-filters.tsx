import {
  REVIEW_STATUS_VALUES,
  RISK_LEVEL_VALUES,
  formatEnumLabel
} from "@/lib/constants";
import type { ReactNode } from "react";

export type QueueFilterValues = {
  department: string;
  reviewer: string;
  risk: string;
  sort: string;
  status: string;
};

type QueueFiltersProps = {
  departments: string[];
  filters: QueueFilterValues;
  reviewers: string[];
};

const SORT_OPTIONS = [
  { label: "Newest created", value: "created-desc" },
  { label: "Oldest created", value: "created-asc" },
  { label: "Recently updated", value: "updated-desc" },
  { label: "Highest risk", value: "risk-desc" },
  { label: "Status", value: "status-asc" }
];

export function QueueFilters({
  departments,
  filters,
  reviewers
}: QueueFiltersProps) {
  return (
    <form className="app-panel p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-eyebrow">Filters</p>
          <h2 className="section-title mt-1">Narrow the queue</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary min-h-9 px-3 py-1.5" type="submit">
            Apply filters
          </button>
          <a
            className="btn btn-secondary min-h-9 px-3 py-1.5"
            href="/"
          >
            Clear
          </a>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <FilterSelect label="Status" name="status" value={filters.status}>
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          {REVIEW_STATUS_VALUES.map((status) => (
            <option key={status} value={status}>
              {formatEnumLabel(status)}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect label="Reviewer" name="reviewer" value={filters.reviewer}>
          <option value="">All reviewers</option>
          {reviewers.map((reviewer) => (
            <option key={reviewer} value={reviewer}>
              {reviewer}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          label="Department"
          name="department"
          value={filters.department}
        >
          <option value="">All departments</option>
          {departments.map((department) => (
            <option key={department} value={department}>
              {department}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect label="Risk" name="risk" value={filters.risk}>
          <option value="">All risk levels</option>
          <option value="NO_REPORT">No report</option>
          {RISK_LEVEL_VALUES.map((risk) => (
            <option key={risk} value={risk}>
              {formatEnumLabel(risk)}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect label="Sort" name="sort" value={filters.sort}>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </FilterSelect>
      </div>
    </form>
  );
}

function FilterSelect({
  children,
  label,
  name,
  value
}: {
  children: ReactNode;
  label: string;
  name: string;
  value: string;
}) {
  return (
    <label className="field-label">
      <span>{label}</span>
      <select
        className="field-control"
        defaultValue={value}
        name={name}
      >
        {children}
      </select>
    </label>
  );
}
