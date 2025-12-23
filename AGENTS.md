# Repository Guidelines

## Purpose
This repository contains design/spec documents and an initial TypeScript monorepo scaffold for a “lean” school library management system. Contributions should focus on clarity, consistent terminology, traceable sources, and incremental, reviewable changes.

## Project Structure & Module Organization
- `README.md`: repository entrypoint and document map.
- `starter-design.md`: the main starting point / conversation export that frames scope and requirements.
- `MVP-SPEC.md`: MVP scope, roles, workflows, and non-functional requirements.
- `DATA-DICTIONARY.md`: MVP entities and field-level recommendations.
- `ARCHITECTURE.md`: tech stack and extensible architecture decisions.
- `USER-STORIES.md`: user stories with acceptance criteria.
- `API-DRAFT.md`: REST API draft (v1).
- `reference-docs/`: supporting reference exports/drafts (`ChatGPT-文獻 A`–`J`) used to justify terminology, data fields, and workflows.
- `apps/api/`: backend API (NestJS / TypeScript).
- `apps/web/`: frontend app (Next.js / TypeScript).
- `packages/shared/`: shared TypeScript types/utilities.
- `db/`: database schema draft and notes.

## Build, Test, and Development Commands
Common local doc workflows:
- List all docs: `Get-ChildItem -Recurse -Filter *.md`
- Search across docs: `Select-String -Path .\\*.md, .\\reference-docs\\*.md -Pattern "circulation" -CaseSensitive:$false`

Code scaffold (requires Node.js + Docker):
- Start database: `docker compose up -d postgres`
- Install deps: `npm install`
- Run dev (all workspaces): `npm run dev`
- Run just API: `npm run dev:api`
- Run just Web: `npm run dev:web`

## Coding Style & Naming Conventions (Docs)
- Markdown only; use descriptive headings and keep sections short.
- Preserve UTF-8 encoding (existing files are UTF-8). Avoid tooling that rewrites encodings or reformats entire exports.
- Prefer Traditional Chinese for prose; keep established English standards/terms when appropriate (e.g., MARC 21, RDA, Dublin Core).
- Keep exported transcript scaffolding intact (`**User:**`, timestamps, `## Prompt:`, `## Response:`). Add commentary/edits below rather than rewriting the original prompt/response.
- New reference docs should follow the existing naming pattern: `reference-docs/ChatGPT-文獻 <Letter> <Topic>.md`.

## Agent-Specific Instructions
- Communicate in Traditional Chinese and explain design/implementation decisions; when changing architecture/API/data model, update the relevant docs under `docs/`.

## Testing Guidelines (Docs Review)
- Preview Markdown rendering (tables, lists, headings) before submitting.
- Validate links you touch; use relative paths for intra-repo links (e.g., `reference-docs/...`).

## Testing Guidelines (Code)
Automated tests are not set up yet; when added, prefer running the most specific test command for the area you changed.

## Commit & Pull Request Guidelines
- Use a clear convention such as Conventional Commits:
  - `docs: clarify circulation workflow`
  - `docs(reference-docs): add weeding policy notes`
- PRs should include a short summary, affected files, and sources/links for new claims. Avoid adding personal data or credentials; redact sensitive details in exports or screenshots.
