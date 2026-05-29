# Aegis-AI

Aegis-AI is an AI governance and opportunity evaluation platform designed to help organizations assess AI initiatives before they are implemented.

Most AI projects focus on building models or generating outputs. I wanted to explore a different problem: how organizations decide whether an AI initiative should move forward in the first place.

Aegis-AI helps teams evaluate proposed AI use cases, identify governance risks, understand organizational readiness, generate stakeholder-facing analysis, and document review decisions through a structured workflow.

The project combines deterministic governance guardrails with Azure OpenAI-powered analysis to simulate how an enterprise AI review process might work in practice.

---

## Why I Built This

As AI adoption continues to accelerate, many organizations face the same questions:

* Is this AI use case actually worth pursuing?
* What risks does it introduce?
* What controls should be implemented?
* Who should review it?
* How do we ensure human oversight?
* How do we communicate recommendations to stakeholders?

Aegis-AI was built to explore those questions.

Instead of focusing on model training or prediction accuracy, the project focuses on AI adoption, governance, risk assessment, stakeholder communication, and decision support.

---

## How It Works

The platform supports two workflows.

### Opportunity Discovery

Users start with a business problem rather than an AI solution.

For example:

> "Supplier onboarding takes too long and requires significant manual effort."

Aegis-AI analyzes the problem and generates practical AI opportunities, explains the reasoning behind each recommendation, and helps users identify which initiatives may provide the most value.

Once an opportunity is selected, it can be converted into a formal governance proposal.

### Governance Review

Users can submit a proposed AI initiative directly.

The platform evaluates the proposal using deterministic governance rules and optional Azure OpenAI analysis.

The resulting report includes:

* Executive briefing
* Governance assessment
* Readiness analysis
* Stakeholder impact analysis
* Change management considerations
* Recommended controls
* Rollout strategy
* Reviewer perspectives
* Audit history

Human reviewers can then approve, reject, or request additional review.

---

## Features

### AI Opportunity Discovery

Generate practical AI opportunities from business problems and operational pain points.

### Governance Assessment

Evaluate proposed AI initiatives using risk scoring, readiness scoring, red-flag detection, and governance controls.

### Azure OpenAI Integration

Generate stakeholder-ready analysis, executive briefings, rollout strategies, change-management recommendations, and governance rationale.

### Deterministic Governance Guardrails

Critical governance decisions remain grounded in deterministic rules rather than model-generated outputs.

### Human Review Workflow

Assign reviewers, capture notes, update statuses, and maintain a traceable decision history.

### Audit Trail

Track proposal creation, report generation, reviewer actions, and governance decisions.

### Portfolio Prioritization

Compare and rank AI initiatives based on readiness, risk, and business value.

### Local Fallback Engine

Continue generating governance reports even when Azure OpenAI is unavailable.

---

## Architecture

Aegis-AI uses a hybrid approach:

```text
Business Problem / AI Proposal
            ↓
Deterministic Governance Engine
            ↓
Risk Scores
Readiness Scores
Red Flags
Recommendations
            ↓
Azure OpenAI Analysis
            ↓
Executive Briefings
Governance Analysis
Stakeholder Impact
Change Management
Rollout Strategy
            ↓
Human Review
            ↓
Audit Trail
```

This architecture ensures governance signals remain consistent while allowing Azure OpenAI to generate richer analysis and stakeholder-facing recommendations.

---

## Tech Stack

### Frontend

* **Next.js 15** – Full-stack React framework
* **React 19** – Component-based UI development
* **TypeScript** – End-to-end type safety
* **Tailwind CSS** – Utility-first styling

### Backend

* **Next.js Route Handlers** – API and server-side logic
* **Drizzle ORM** – Type-safe database access
* **SQLite** – Local-first persistence
* **better-sqlite3** – High-performance SQLite driver

### AI & Governance

* **Azure OpenAI** – Governance report generation, opportunity discovery, and stakeholder-facing analysis
* **LangGraph** – Multi-step AI workflow orchestration
* **Zod** – Runtime validation for AI-generated structured outputs
* **Deterministic Governance Engine** – Risk scoring, readiness assessment, red-flag detection, and recommendation logic

### Testing & Quality

* **Vitest** – Unit and integration testing
* **TypeScript Strict Mode** – Compile-time safety and maintainability

### Runtime & Tooling

* **Bun** – Package management and application runtime

---

## Getting Started

### Clone the Repository

```bash
git clone <repo-url>
cd Aegis-AI
```

### Install Dependencies

```bash
bun install
```

### Configure Environment Variables

Create a local environment file:

```bash
cp .env.example .env.local
```

For Azure OpenAI:

```env
AZURE_AI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_AI_KEY=your_key

AZURE_OPENAI_DEPLOYMENT=your_deployment_name
AZURE_OPENAI_API_VERSION=2024-10-21
```

If Azure credentials are not provided, the application automatically falls back to deterministic report generation.

### Create the Database

```bash
bun run db:push
```

### Seed Demo Data (Optional)

```bash
bun run db:seed
```

### Start the Application

```bash
bun run dev
```

Open:

```text
http://localhost:3000
```

---

## Available Scripts

```bash
bun run dev       # Start the local development server
bun run build     # Create a production build
bun run start     # Run the production build
bun run db:push   # Apply schema changes to SQLite
bun run db:seed   # Insert sample data
bun run test      # Run the Vitest test suite
```

By default, the application uses:

```text
aegis.db
```

To use a different SQLite file:

```bash
DB_FILE_NAME=local.db bun run db:push
```

---

## Project Goals

Aegis-AI explores how organizations can move beyond simply building AI systems and instead evaluate:

* Whether a use case should be implemented
* What governance concerns exist
* What controls are required
* How stakeholders may be impacted
* How adoption should be managed
* How decisions can remain explainable and auditable

The project sits at the intersection of:

* Generative AI
* AI Governance
* Risk Assessment
* Change Management
* Enterprise AI Adoption
* Decision Support Systems

---

## Disclaimer

Aegis-AI is a portfolio project intended to explore AI governance, opportunity assessment, and enterprise AI adoption workflows.

It is not intended to replace legal, compliance, security, risk, or governance professionals.
