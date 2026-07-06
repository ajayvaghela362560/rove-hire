# ROVE Hire

An internal recruitment tool for the ROVE HR team — manage candidates from the moment a resume arrives to the moment an offer letter is generated. Built for the ROVE full-stack take-home.

- **Live URL:** _add after deploy_
- **Test HR login:** `hr@rovehire.dev` / `rovehire-demo-2026` _(the `SEED_HR_PASSWORD` you set)_
- **Demo video:** _add link_

---

## Table of contents
1. [What it does](#what-it-does)
2. [Tech stack & why](#tech-stack--why)
3. [Architecture overview](#architecture-overview)
4. [Database design](#database-design)
5. [PDF generation](#pdf-generation)
6. [Security](#security)
7. [Local setup](#local-setup)
8. [Deployment guide](#deployment-guide)
9. [Testing](#testing)
10. [API reference](#api-reference)
11. [Design & product decisions](#design--product-decisions)
12. [What I'd do next / cut for time](#what-id-do-next--cut-for-time)
13. [What I would not ship to production yet](#what-i-would-not-ship-to-production-yet)

---

## What it does
- **HR sign-in** and a **dashboard** listing every candidate (name, role, status, last activity) with **status filter** and **name/role search**.
- **Job openings** with markdown descriptions, skill tags, Open/Closed status, and a live candidate count. Closed openings can't receive new candidates.
- **Add candidate**: upload a resume (PDF ≤ 10 MB, direct to S3), pick an open role, and get a **copyable single-use magic link**.
- **Public application page** (no login): the candidate fills in their details; the link is **single-use** and **expires in 14 days**, with clean expired/used/invalid screens.
- **Interviews**: schedule (screening/technical), a dedicated Interviews page sorted by date, and mark completed with **hire / no-hire / maybe feedback**.
- **Candidate profile** (the spine): details, resume + document downloads, a status badge, a most-recent-first **timeline**, and **status-conditional action buttons**.
- **Offer Letter + NDA generation**: fill a short form, generate two professional PDFs (stored and re-downloadable), and move the candidate to Offer Sent.
- **Hired / Rejected**: Hired requires a generated offer; Rejected requires a reason. Both are logged.

The deployment is **pre-seeded** with 4 openings (one Closed) and 5 candidates — one each in Applied, Form Submitted, Interview Scheduled (with feedback), Offer Sent (with real generated PDFs), and Rejected.

---

## Tech stack & why
| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15** (App Router, RSC, TypeScript) | One deployable for UI + API; Server Components read straight from the DB (no client-cache staleness); Server Actions keep mutations secure by default. |
| Styling | **Tailwind CSS + Radix primitives** (shadcn-style, hand-owned) | Linear/Notion-level polish from code I own and can restyle, not a theme I can't explain. |
| Database | **PostgreSQL** (Neon) via **Prisma** | The domain is relational (jobs → candidates → interviews/offers/documents/events) and correctness needs real transactions, row locks, and constraints. Neon's serverless Postgres resumes from scale-to-zero in ~1s, and Prisma gives typed transactions + migrations. |
| File storage | **AWS S3** (private bucket) | Resumes and generated PDFs must persist and be re-downloadable indefinitely — object storage survives redeploys, and a private bucket + short-lived presigned URLs is the right access-control model. Also works with any S3-compatible store (e.g. Cloudflare R2) via `AWS_ENDPOINT`. |
| Auth | **Hand-rolled** email+password (`scrypt`) + **DB-backed sessions** | The JD emphasises secure auth / OWASP; DB sessions are server-side revocable and every entry point re-validates against the DB. `scrypt` (node:crypto) is memory-hard with zero native dependencies, so it can't fail to build on serverless. |
| PDF | **@react-pdf/renderer** | Pure JS — no headless Chromium, so no 250 MB bundle, no multi-second cold starts, no font-CDN flakiness. Deterministic output, templates are React components. |
| Hosting | **Vercel** + **Neon** + **S3** | Single `git push` deploy; everything stateful lives off-box so "refresh loses nothing" is structural. |

---

## Architecture overview
```
Browser ──cookie──▶ Next.js (Vercel, Node runtime)
   └──magic token──▶ /apply            │
                                        ├─ RSC pages (read)      ── requireSession()
                                        ├─ Server Actions (write) ─ Zod + requireSession()
                                        └─ Route handlers (upload/download/health)
                                                    │
        domain/state-machine: transitionCandidate($tx)
          SELECT … FOR UPDATE → validate map → guards → status + timeline + last_activity
                                                    │
                   ┌────────────────────┬───────────┴───────────┐
                   ▼                    ▼                       ▼
            PostgreSQL (Neon)    @react-pdf → S3 (private)   presigned PUT/GET
```

**Clean architecture / layering** (`src/`):
- `app/` — delivery (pages, route handlers). HR pages sit under the `(hr)` route group behind an auth-guarded layout.
- `server/actions/` — use-cases: Zod-validate → `requireSession()` → orchestrate a transaction.
- `server/domain/` — **pure business rules** (state machine, transitions, token logic). Framework-free and unit-tested.
- `server/{db,storage,pdf,auth}/` — infrastructure adapters.
- `lib/` — env, logger, validation schemas, status display map, utils.

Dependencies point inward: the domain knows nothing about Next.js, Prisma, or S3.

**One state machine, three layers of authority.** Every status change funnels through `transitionCandidate(tx, id, to, event)` which, inside a Prisma interactive transaction, (1) `SELECT … FOR UPDATE`s the candidate row, (2) validates against an explicit allowed-transitions map, (3) runs guards (`Hired ⇒ offer exists`, etc.), (4) writes status + a timeline event + `last_activity_at` atomically. DB `CHECK`/enum constraints back the app guards, and the UI imports the same `allowedActions()` map to decide which buttons to show — so client and server can't disagree.

---

## Database design
Nine tables (see [`prisma/schema.prisma`](prisma/schema.prisma)). Highlights:
- **candidates** — status enum + application fields; `CHECK (status <> 'REJECTED' OR rejection_reason IS NOT NULL)`; unique `(job_id, email)`; index on `(status, last_activity_at desc)` for the dashboard.
- **application_tokens** — only a **SHA-256 hash** of the 256-bit token, with `expires_at`, `used_at`, `revoked_at`.
- **interviews** / **feedback** — feedback is 1:1 with a **unique** FK, so a double-submitted verdict is a constraint violation, not a duplicate row.
- **offers** — its own table, so "Hired requires an offer" is a relational `EXISTS`, not a flag.
- **documents** — S3 key + metadata; `kind ∈ {RESUME, OFFER_LETTER, NDA}`.
- **timeline_events** — append-only; an event is only ever written in the **same transaction** as the change it describes.
- **sessions** — SHA-256 hash of the cookie token + expiry.

`last_activity_at` is a deliberate denormalization for cheap dashboard sorting; it's written only via the domain layer alongside a timeline event.

---

## PDF generation
**Library:** `@react-pdf/renderer`, rendered server-side to a `Buffer` (`src/server/pdf/`). Templates (`OfferLetter`, `Nda`, `Resume`) are React components sharing a `Letterhead` and `SignatureBlock`, using the built-in standard PDF fonts (Helvetica/Times) so there are **no font files to bundle and nothing to fetch at render time** — generation can't flake on a cold start.

**Why not Puppeteer/headless Chromium:** on Vercel it risks the ~250 MB function bundle limit, multi-second cold-start binary extraction, and chromium-version/font brittleness. For two one-page documents, a pure-JS renderer is the correct trade.

**Durability ordering:** render → upload both PDFs to S3 → **then** one DB transaction inserting the offer, document rows, timeline event, and status transition. Files-first means the DB can never point at a missing file; the worst failure case is a harmless orphaned S3 object. Re-download goes through an authed route that mints a 60-second presigned GET and redirects, so the bucket is never public and bytes never stream through the function.

**At scale:** react-pdf layout is CPU-bound — for bulk generation I'd move it to a background queue (SQS + worker) and cache rendered documents. If templates ever needed rich HTML/CSS fidelity or legal review, I'd switch to an HTML→PDF service with a warm rendering pool.

---

## Security
- All HR routes/actions/handlers call **`requireSession()`** (DB-validated). Middleware only does a cookie-presence redirect for UX and is **never** the security boundary (the CVE-2025-29927 lesson).
- **Magic-link tokens:** 256-bit CSPRNG, stored **hashed**, single-use enforced by an **atomic conditional UPDATE** (no TOCTOU on double-submit), 14-day expiry checked in the same predicate, and the candidate is derived from the token — never from a form field.
- **Passwords:** `scrypt` with per-user salt + `timingSafeEqual`; unknown-email logins still run a dummy verification to avoid user enumeration.
- **Uploads:** presigned POST with an S3-enforced 10 MB + `application/pdf` policy; the server re-verifies with `HeadObject` and a `%PDF-` magic-byte sniff before creating the candidate.
- **State-machine guards** are enforced server-side (closed-job rejection, Hired-requires-offer, reason-required rejection) — not just hidden buttons.
- **Markdown** is rendered without raw HTML pass-through (XSS-safe). Cookies are `httpOnly; Secure; SameSite=Lax`.

---

## Local setup
Requires Node 20+, pnpm, a PostgreSQL database, and an S3 bucket.

```bash
pnpm install
cp .env.example .env          # fill in DATABASE_URL/DIRECT_URL, S3 creds, SESSION_SECRET, SEED_HR_PASSWORD
pnpm db:migrate               # apply migrations (prisma migrate deploy)
pnpm db:seed                  # populate demo data (prints the Applied candidate's magic link)
pnpm dev                      # http://localhost:3000
```

The S3 bucket needs a CORS rule allowing `POST`/`GET` from your app origin (the browser uploads
resumes directly via a presigned POST), and an IAM key with `s3:PutObject` + `s3:GetObject` on the
bucket. The storage adapter is also endpoint-configurable (`AWS_ENDPOINT` / `S3_FORCE_PATH_STYLE`),
so it works against any S3-compatible store such as Cloudflare R2.

---

## Deployment guide
1. **Database (Neon):** create a project; copy the **pooled** connection string into `DATABASE_URL` (keep `?pgbouncer=true`) and the **direct** one into `DIRECT_URL`.
2. **Storage (S3):** create a private bucket. Add a CORS rule allowing `POST`/`GET` from your app origin (needed for browser presigned uploads). Create an IAM user with `PutObject`/`GetObject`/`HeadObject` on the bucket.
3. **Vercel:** import the repo, set all env vars from `.env.example` (set `APP_URL` to the deployed URL — magic links are built from it), and deploy. `pnpm build` runs `prisma generate` automatically.
4. **Migrate + seed** (once, from your machine against prod): `pnpm db:migrate && pnpm db:seed`.
5. **Keep warm:** the included GitHub Action (`.github/workflows/keep-warm.yml`) pings `/api/health` every 6h so Neon is awake for reviewers — set the `APP_URL` repo variable.

---

## Testing
- `pnpm test` — unit tests for the pure state machine (transition legality, guards, `allowedActions`) — the highest-value logic to lock down.
- `pnpm typecheck` — full TypeScript check.
- `pnpm build` — production build (compiles every route, RSC boundary, and the Edge middleware).
- CI (`.github/workflows/ci.yml`) runs lint + typecheck + tests on every push.

---

## API reference
Mutations are **Server Actions** (`src/server/actions/`), each: Zod-validate → `requireSession()` (except public submit) → transactional domain call, returning `{ ok: true } | { ok: false, error, fieldErrors }`.

| Action | Purpose |
|---|---|
| `loginAction` / `logoutAction` | Session create / revoke |
| `createJobAction` / `updateJobAction` / `setJobStatusAction` | Job openings |
| `createCandidateAction` | Verify resume in S3, create candidate + token + event |
| `regenerateMagicLinkAction` | Revoke live tokens, issue a fresh link |
| `submitApplicationAction` | **Public** — atomic token claim + form persist |
| `scheduleInterviewAction` / `completeInterviewAction` | Interviews + feedback |
| `generateOfferDocumentsAction` | Render + store Offer Letter & NDA, → Offer Sent |
| `markHiredAction` / `markRejectedAction` | Terminal transitions |

**Route handlers** (HTTP semantics required):
| Route | Purpose |
|---|---|
| `POST /api/uploads/resume-presign` | Authed; returns a presigned POST (S3-enforced 10 MB + PDF) |
| `GET /api/documents/[id]/download` | Authed; 302 → 60s presigned GET |
| `GET /api/health` | `SELECT 1` liveness for the keep-warm cron |

---

## Design & product decisions
- **Auth method:** email + password (one seeded HR account). No self-serve signup — an internal tool provisions via IT/SSO, and open signup on a public URL would expose candidate PII.
- **Feature 6 vs 7 ambiguity:** feature 6 says "Move to Offer after a *completed* interview"; feature 7 says available from *Interview Scheduled* or later. I treat **feature 7 as authoritative** (it's the explicit spec for the centerpiece) and add a **non-blocking warning** in the offer dialog when no completed interview exists — honoring feature 6's intent without contradicting feature 7.
- **Form-submit never regresses status:** HR can schedule an interview before the candidate submits their form; on submission we always save the details and consume the token, but only advance to Form Submitted if the candidate is still in Applied.
- **Single active magic link:** regenerating revokes prior links; rejection revokes the outstanding link and shows a neutral "no longer active" screen rather than revealing the rejection.
- **Salary** is stored as integer minor units to avoid float error and formatted with `Intl.NumberFormat`. Currency is a small fixed list (USD/EUR/GBP/INR/CAD).
- **Interview times** are stored in UTC; per-user timezone rendering is a documented next step.
- **UX states:** every surface has loading, empty, and error states; the public link has dedicated expired/used/invalid screens.

---

## What I'd do next / cut for time
- **Automated e2e** (Playwright) driving the full grader path, and integration tests for token consumption / offer generation against a real Postgres.
- **Resume re-upload / versioning** from the profile (schema supports multiple documents; the UI flow was cut).
- **Richer Interviews page** (calendar view, reminders) and **bulk actions** on the dashboard.
- **Per-user timezones** and an audit view of who did what (actor is already recorded on every event).
- **Optimistic UI** on mutations instead of full `router.refresh()`.

---

## What I would not ship to production yet
- **No login rate-limiting / lockout** — needs a throttle (Redis or a small counter table) before real exposure.
- **Hand-rolled auth** has no password reset or 2FA; for production I'd add those (or adopt a hardened library) while keeping the DB-session model.
- **Orphaned S3 objects** from failed transactions aren't garbage-collected — I'd add an S3 lifecycle rule / reconciliation job.
- **No pagination** on the dashboard/jobs — fine for demo scale, needed beyond a few hundred rows.
- **Prisma + PgBouncer** (transaction pooling) is used without load testing; I'd validate connection behaviour under real concurrency.
- **Concurrency** is guarded with `FOR UPDATE` + conditional writes per transition, not global serializable isolation — sufficient for the enumerated transitions, but I wouldn't claim a proof.
