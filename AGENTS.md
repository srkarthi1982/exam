⚠️ Mandatory: AI agents must read this file before writing or modifying any code.

MANDATORY: After completing each task, update this repo’s AGENTS.md Task Log (newest-first) before marking the task done.
This file complements the workspace-level Ansiversa-workspace/AGENTS.md (source of truth). Read workspace first.

⚠️ Mandatory: AI agents must read this file before writing or modifying any code in the exam repo.

# AGENTS.md
## Exam Repo – Session Notes (Codex)

This file records what was built/changed so far for the exam repo. Read first.

---

## 1. Current Architecture (Exam)

- Exam Simulator mini-app aligned to Ansiversa AppStarter standards.
- Auth + billing locals normalized in middleware with DEV_BYPASS support.
- AppShell includes parent notification unread count (SSR) and standard AppStarter routing.
- Alpine store (`exam`) manages papers, attempts, timer, and answer state.
- Dashboard summary schema + webhook push wired for key events.
- Parent notification emits on exam submission.

---

## 2. DB Tables

- `ExamPapers`
- `ExamQuestionsSnapshot`
- `ExamAttempts`
- `ExamAnswers`

---

## 3. Task Log (Newest first)

- 2026-02-02 Fixed dashboard push: getExamPaper no longer emits delete; deleteExamPaper pushes deleted event.
- 2026-02-02 Cleaned typecheck hints (redirect pages, seed, history import).
- 2026-02-02 Adjusted attempt runner to compute remaining seconds from startedAt.
- 2026-02-02 Implemented Exam V1 pages (papers, attempt runner, results, history, help).
- 2026-02-02 Added exam actions with FREE_LIMITS + requirePro gating.
- 2026-02-02 Added quiz API client + question snapshot storage.
- 2026-02-02 Added dashboard summary schema + webhook push.
- 2026-02-02 Added parent notification emit on exam submitted.
- 2026-02-02 Bootstrapped exam from AppStarter baseline (env, middleware, layouts, actions, modules).

---

## 4. Verification Log

- 2026-02-02 `npm run typecheck` (pass; 8 hints logged).
- 2026-02-02 `npm run build` (pass).
- 2026-02-02 `npm run typecheck` (pass; 0 hints).

---

## 5. Verification Checklist (Template)

- [x] Auth locals normalized
- [x] Billing flags present
- [x] `requirePro` guard works
- [x] Paywall UI pattern present
- [x] Dashboard webhook push works
- [x] Notifications helper wired
- [x] Admin guard works
- [x] Layout + `global.css` correct
- [x] Webhook timeouts + retries documented
- [x] Build/typecheck green

## Task Log (Recent)
- Keep newest first; include date and short summary.
- 2026-02-09 Enforced repo-level AGENTS mandatory task-log update rule for Codex/AI execution.
- 2026-02-09 Verified repo AGENTS contract linkage to workspace source-of-truth.
