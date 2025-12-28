# K–12 Cloud Library System (Library System)

[繁體中文](README.md) | **English**

This project aims to build a lean, cloud-ready Library Management System (LMS) for K–12 schools in Taiwan, optimized for **limited staffing** and **tight budgets**—while keeping the data model correct and extensible.

This repository contains:
- **Domain references** (A–J: cataloging, classification, subject analysis, metadata, IR, collection management, circulation, users, information behavior, ethics/policy)
- **MVP deliverables you can implement** (user stories, API draft, data dictionary, DB schema)
- **A runnable code scaffold** (TypeScript monorepo: NestJS API + Next.js Web)

> If you’re new to TypeScript/Next.js/NestJS, start with `docs/README.md`.

## Current Status
- Docs are “implementation-ready”: `MVP-SPEC.md`, `USER-STORIES.md`, `API-DRAFT.md`, `DATA-DICTIONARY.md`, `db/schema.sql`
- Code scaffold exists: `apps/api` exposes `/health`, `apps/web` has a starter page (core features not implemented yet)
- Architecture decisions and trade-offs are documented: `ARCHITECTURE.md`, `docs/design-rationale.md`

## MVP Scope (What to Expect)
The MVP focuses on making the core school workflows reliable:
- CSV roster import: students/teachers, class grouping, deactivation (graduation/leave)
- Bibliographic records + item copies: multiple copies, barcode, call number, location, status
- OPAC search: keyword + field search (title/author/ISBN/subjects) with basic tolerance
- Circulation: checkout, check-in, renewals, holds, overdue lists (no fines; blocks/reminders instead)
- Reports (CSV): top circulation, circulation volume, overdue lists
- Audit trail: `audit_events` for checkout/check-in/import/status changes

Default MVP policies are defined in `MVP-SPEC.md`.

## Tech Stack & Extensibility
We use a **Modular Monolith** approach: low ops overhead for MVP, with clear boundaries so it can evolve into multiple services later if needed.

- Language: TypeScript (shared types across web+api)
- Backend: NestJS (modules, DI, testability)
- Frontend: Next.js (admin UI + OPAC; PWA-friendly)
- Database: PostgreSQL (transactions + constraints; FTS; can later add a search engine)

See `ARCHITECTURE.md` and `docs/design-rationale.md` for the reasoning and alternatives.

## Repository Structure
```
.
├─ apps/
│  ├─ api/          # NestJS API (currently health endpoint only)
│  └─ web/          # Next.js Web (starter page)
├─ packages/
│  └─ shared/       # Shared TS types/utils (reserved)
├─ db/
│  ├─ schema.sql    # PostgreSQL schema draft
│  └─ README.md     # DB notes
├─ reference-docs/  # A–J references/drafts
└─ docs/            # How it works, primer, design rationale
```

## Key Docs (Start Here)
- Entry point for newcomers: `docs/README.md`
- How the system works end-to-end: `docs/how-it-works.md`
- TypeScript/Next/Nest primer: `docs/typescript-nextjs-nestjs-primer.md`
- Design trade-offs & roadmap: `docs/design-rationale.md`
- “Source of truth” for implementation: `MVP-SPEC.md`, `USER-STORIES.md`, `API-DRAFT.md`, `DATA-DICTIONARY.md`, `db/schema.sql`

## Local Development (from zero to running)
Prerequisites:
- Node.js 20+ and npm
- Docker Desktop (PostgreSQL/Redis)

### 1) Start the database
```bash
docker compose up -d postgres redis
```

### 2) Install dependencies
```bash
npm install
```

### 3) Apply the DB schema (draft)
PowerShell example:
```powershell
Get-Content db\\schema.sql | docker compose exec -T postgres psql -U library -d library_system
```

### 4) Run dev servers (web + api)
```bash
npm run dev
```

Check:
- Web: `http://localhost:3000`
- API: `http://localhost:3001/health`

## Run the Full Stack in Docker (DB + API + Web + demo seed + smoke)
If you want both frontend and backend to run inside Docker (closer to a deployable setup):

### 1) Bring up the stack (build images)
```bash
npm run docker:up
```

If you hit port conflicts (common ones: `6379`/`5432`/`3000`/`3001`), override host ports via env vars:
```bash
REDIS_PORT=6380 POSTGRES_PORT=55432 API_HOST_PORT=3002 WEB_HOST_PORT=3003 npm run docker:up
```

### 2) Load demo seed data (idempotent)
```bash
npm run docker:seed
```

### 3) Run smoke tests (inside Docker network)
```bash
npm run docker:smoke
```

All-in-one (wipe DB volume → up → seed → smoke):
```bash
npm run docker:test
```

Shut down:
```bash
npm run docker:down
```

Remove volumes too (deletes DB data):
```bash
npm run docker:down:volumes
```

## Turning Docs into Code (Recommended Workflow)
1. Pick a story in `USER-STORIES.md` (e.g., US-040 checkout).
2. Align request/response/errors in `API-DRAFT.md`.
3. Verify fields and constraints in `DATA-DICTIONARY.md` and `db/schema.sql`.
4. Implement API (Controller → Service → DB transaction), then implement Web UI.
5. Update `docs/` to document decisions and trade-offs.

## Contributing
- Follow `AGENTS.md` (doc conventions, naming, commands, and “keep docs in sync” rule).
- Some `reference-docs/` exports may contain personal data (e.g., `**User:**` lines). Redact before making the repository public.
