import { db } from "./index";
import { auditLogs, governanceReports, reviewerNotes, useCases } from "./schema";

const proposals = [
  {
    title: "Public IT FAQ summarization",
    department: "Information Technology",
    teamOwner: "IT Service Desk",
    currentProcess:
      "Employees search a public-facing internal FAQ page or open tickets for common hardware and access questions.",
    proposedSolution:
      "Use AI to summarize approved public IT FAQ entries and suggest relevant help articles for employees.",
    expectedBenefit:
      "Reduce repetitive support tickets and help employees find approved support information faster.",
    dataSensitivity: "PUBLIC",
    decisionImpact: "LOW",
    humanOversightPlanned: "YES",
    affectedStakeholders: "Employees, IT service desk analysts",
    implementationTimeline: "Pilot within 4 weeks",
    assignedReviewer: "IT Governance"
  },
  {
    title: "Internal meeting transcript summarization",
    department: "Operations",
    teamOwner: "Continuous Improvement Office",
    currentProcess:
      "Project managers manually summarize internal meeting notes and action items after weekly planning meetings.",
    proposedSolution:
      "Use AI to summarize internal meeting transcripts and draft action item lists for human review.",
    expectedBenefit:
      "Save time for project managers and improve consistency of meeting follow-up.",
    dataSensitivity: "INTERNAL",
    decisionImpact: "LOW",
    humanOversightPlanned: "YES",
    affectedStakeholders: "Project managers, meeting participants, operations leadership",
    implementationTimeline: "Trial during next quarterly planning cycle",
    assignedReviewer: "Operations Governance"
  },
  {
    title: "Job applicant screening",
    department: "Human Resources",
    teamOwner: "Talent Acquisition",
    currentProcess:
      "Recruiters review resumes and manually create shortlists for hiring managers.",
    proposedSolution:
      "Use AI to rank job applicants based on resume content and job description alignment.",
    expectedBenefit:
      "Reduce initial screening time and improve consistency across open roles.",
    dataSensitivity: "SENSITIVE",
    decisionImpact: "HIGH",
    humanOversightPlanned: "PARTIAL",
    affectedStakeholders: "Applicants, recruiters, hiring managers, HR compliance",
    implementationTimeline: "Desired pilot next quarter",
    assignedReviewer: "HR Compliance"
  },
  {
    title: "Vendor approval automation",
    department: "Procurement",
    teamOwner: "Vendor Management",
    currentProcess:
      "Procurement analysts review vendor questionnaires, risk flags, and business justification before routing approvals.",
    proposedSolution:
      "Use AI to recommend approval or rejection decisions for new vendor requests.",
    expectedBenefit:
      "Shorten vendor onboarding timelines and reduce manual review burden.",
    dataSensitivity: "CONFIDENTIAL",
    decisionImpact: "HIGH",
    humanOversightPlanned: "PARTIAL",
    affectedStakeholders: "Procurement, legal, finance, business requesters, vendors",
    implementationTimeline: "Phased rollout over 3 months",
    assignedReviewer: "Legal and Procurement Risk"
  },
  {
    title: "Supplier onboarding document summarization",
    department: "Supply Chain",
    teamOwner: "Supplier Enablement",
    currentProcess:
      "Supplier onboarding specialists manually read submitted policy, insurance, and certification documents.",
    proposedSolution:
      "Use AI to summarize supplier onboarding documents and flag missing sections for specialist review.",
    expectedBenefit:
      "Speed up document review while keeping final onboarding decisions with the supplier enablement team.",
    dataSensitivity: "CONFIDENTIAL",
    decisionImpact: "MEDIUM",
    humanOversightPlanned: "YES",
    affectedStakeholders: "Suppliers, onboarding specialists, compliance reviewers",
    implementationTimeline: "Pilot with one supplier category in 6 weeks",
    assignedReviewer: "Supply Chain Compliance"
  }
] as const;

db.delete(governanceReports).run();
db.delete(reviewerNotes).run();
db.delete(auditLogs).run();
db.delete(useCases).run();

for (const proposal of proposals) {
  const created = db
    .insert(useCases)
    .values({
      ...proposal,
      status: "PENDING"
    })
    .returning()
    .get();

  db.insert(auditLogs)
    .values({
      useCaseId: created.id,
      action: "PROPOSAL_CREATED",
      note: "Proposal created."
    })
    .run();
}

console.log(`Seeded ${proposals.length} use-case proposals.`);
