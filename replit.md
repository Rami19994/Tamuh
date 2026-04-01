# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Main product: Arabic RTL secure case-management platform for University of the People students affected by the situation in Sweida, Syria.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, RTL Arabic, Tailwind CSS

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── sweida-platform/    # Arabic RTL React frontend
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Platform Description

**منصة مساعدة طلاب السويداء** — A secure, Arabic RTL humanitarian platform for University of the People students who cannot submit proof of secondary school completion due to ongoing violence in Sweida, Syria since July 2024.

### Key Principles
- Service is completely free
- Minimum necessary disclosure (students only see their current step)
- Student privacy protected
- Advisor emails never exposed to students
- Watermark/variation tracking in email drafts

### Public Pages
- `/` — Home page with warning banner, hero, trust pillars, FAQ
- `/how-it-works` — High-level 4-step process (no internal details exposed)
- `/privacy` — Data and privacy policy
- `/report` — Exploitation report form
- `/submit` — Student case submission form
- `/track` — Case status tracking (minimal disclosure)

### Admin Pages (protected)
- `/admin/login` — Admin login
- `/admin` — Dashboard with stats, case list, filters
- `/admin/cases/:caseNumber` — Full case detail with notes, status history, draft management

### Case Statuses
received → under_review → need_more_info → approved_for_guidance → draft_prepared → awaiting_student_sending → sent_by_student → follow_up_in_progress → completed / closed

### Admin Credentials (demo)
- Username: `admin`, Password: `admin123`
- Username: `intake1`, Password: `intake123`
- Username: `verifier1`, Password: `verify123`

## Database Schema (lib/db/src/schema/cases.ts)

Tables:
- `cases` — main case records with status, assignment, draft
- `case_status_history` — full audit trail of status changes
- `internal_notes` — admin-only notes per case
- `uploads` — file uploads metadata
- `generated_drafts` — email drafts with variation tracking
- `exploitation_reports` — confidential exploitation reports
- `admin_users` — admin accounts with roles
- `audit_logs` — sensitive action audit trail

## API Routes (artifacts/api-server/src/routes/)

### Public (cases.ts)
- `POST /api/cases` — submit new case → returns case number + verification code
- `POST /api/cases/track` — track status by case number + email
- `POST /api/cases/:caseNumber/documents` — upload document
- `POST /api/cases/:caseNumber/confirm-sent` — student confirms email sent
- `POST /api/reports/exploitation` — submit exploitation report

### Admin (admin.ts) — Bearer token required
- `POST /api/admin/login` — login → returns JWT-like base64 token
- `GET /api/admin/cases` — list cases with filter/search/pagination
- `GET /api/admin/cases/:caseNumber` — full case detail
- `PATCH /api/admin/cases/:caseNumber/status` — update status
- `POST /api/admin/cases/:caseNumber/notes` — add internal note
- `POST /api/admin/cases/:caseNumber/draft` — generate/publish email draft
- `PATCH /api/admin/cases/:caseNumber/assign` — assign to team member
- `GET /api/admin/stats` — dashboard statistics

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json`. Root `tsconfig.json` lists lib packages as project references. Leaf artifacts are not in root references.

## Packages

### `artifacts/sweida-platform` (`@workspace/sweida-platform`)

React + Vite Arabic RTL frontend. All public text in Arabic. Admin pages bilingual.
Port: 21725, served at `/`

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Port: 8080, served at `/api`.
- `pnpm --filter @workspace/api-server run dev` — dev mode
- `pnpm --filter @workspace/api-server run build` — production bundle

### `lib/db` (`@workspace/db`)

Drizzle ORM. Run `pnpm --filter @workspace/db run push` after schema changes.

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI spec in `openapi.yaml`. Run `pnpm --filter @workspace/api-spec run codegen` after spec changes.
