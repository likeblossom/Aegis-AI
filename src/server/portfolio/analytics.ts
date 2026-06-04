import type { GovernanceReport, UseCase } from "@/db/schema";
import { parseGovernanceReportJson } from "@/server/governance/reportTypes";
import type { RankedPortfolioPriority } from "./prioritization";

type RankedItem = RankedPortfolioPriority<{
  proposal: UseCase;
  report: GovernanceReport;
}>;

export type PortfolioAnalytics = {
  averageReadiness: number;
  averagePriorityScore: number;
  approvalReadyCount: number;
  governanceReviewCount: number;
  criticalRiskCount: number;
  highDataSensitivityCount: number;
  totalRequiredControls: number;
  averageRequiredControls: number;
  riskDistribution: { label: string; count: number }[];
  recommendationDistribution: { label: string; count: number }[];
  departmentLeaders: { department: string; count: number; averageScore: number }[];
  topControlThemes: { theme: string; count: number }[];
};

export function analyzePortfolio(items: RankedItem[]): PortfolioAnalytics {
  const departmentStats = new Map<
    string,
    { count: number; totalScore: number }
  >();
  const controlThemes = new Map<string, number>();
  let totalRequiredControls = 0;

  for (const item of items) {
    const currentDepartment = departmentStats.get(item.proposal.department) ?? {
      count: 0,
      totalScore: 0
    };
    departmentStats.set(item.proposal.department, {
      count: currentDepartment.count + 1,
      totalScore: currentDepartment.totalScore + item.priorityScore
    });

    const parsedReport = parseGovernanceReportJson(item.report.reportJson);
    const controls = parsedReport?.requiredControls ?? [];
    totalRequiredControls += controls.length;

    for (const control of controls) {
      const theme = classifyControlTheme(control);
      controlThemes.set(theme, (controlThemes.get(theme) ?? 0) + 1);
    }
  }

  return {
    averageReadiness: average(items.map((item) => item.report.aiReadinessScore)),
    averagePriorityScore: average(items.map((item) => item.priorityScore)),
    approvalReadyCount: items.filter((item) =>
      ["Quick Win", "Strategic Bet"].includes(item.priorityCategory)
    ).length,
    governanceReviewCount: items.filter(
      (item) => item.priorityCategory === "Needs Governance Review"
    ).length,
    criticalRiskCount: items.filter((item) =>
      ["HIGH", "CRITICAL"].includes(item.report.riskLevel)
    ).length,
    highDataSensitivityCount: items.filter((item) =>
      ["CONFIDENTIAL", "SENSITIVE"].includes(item.proposal.dataSensitivity)
    ).length,
    totalRequiredControls,
    averageRequiredControls: averageRequiredControls(
      totalRequiredControls,
      items.length
    ),
    riskDistribution: buildDistribution(items, (item) => item.report.riskLevel),
    recommendationDistribution: buildDistribution(
      items,
      (item) => item.report.finalRecommendation
    ),
    departmentLeaders: Array.from(departmentStats.entries())
      .map(([department, stats]) => ({
        department,
        count: stats.count,
        averageScore: Math.round(stats.totalScore / stats.count)
      }))
      .sort((a, b) => b.averageScore - a.averageScore || b.count - a.count)
      .slice(0, 4),
    topControlThemes: Array.from(controlThemes.entries())
      .map(([theme, count]) => ({ theme, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  };
}

function buildDistribution(
  items: RankedItem[],
  getValue: (item: RankedItem) => string
) {
  const counts = new Map<string, number>();

  for (const item of items) {
    const value = getValue(item);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function classifyControlTheme(control: string) {
  const normalized = control.toLowerCase();

  if (/human|oversight|review|approval/.test(normalized)) {
    return "Human oversight";
  }

  if (/data|privacy|retention|access|security/.test(normalized)) {
    return "Data governance";
  }

  if (/monitor|metric|audit|log|drift/.test(normalized)) {
    return "Monitoring";
  }

  if (/training|change|communication|adoption/.test(normalized)) {
    return "Change readiness";
  }

  return "Operational controls";
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(
    values.reduce((total, value) => total + value, 0) / values.length
  );
}

function averageRequiredControls(totalControls: number, itemCount: number) {
  if (itemCount === 0) {
    return 0;
  }

  return Math.round((totalControls / itemCount) * 10) / 10;
}
