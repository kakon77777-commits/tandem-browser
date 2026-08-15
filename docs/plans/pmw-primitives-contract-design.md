# PMW Primitives Contract — Design Note

> **Date:** 2026-08-10
> **Status:** Draft — documents shipped work (Phases 1-4); the AI Board sections are proposals, not authorized work
> **Author:** Claude, for Neo K.'s SRW fork
> **Depends on:** Phases 1-4 of the MCP/SRW main line (stateless MCP transport, CAS + handoff transitions, scoped memory + decision receipts, agents registry + ISOLATE) — all merged in this fork
> **Source theory:** Neo K.'s 5-paper series *跨對話智能協作與共享認知空間* (Persistent Multi-Agent Workspace) and its `pmw_mvp.py` reference implementation

---

## 1. Goal

Tandem Browser (this fork) and AI Board are two independently-built systems that have each, on their own, grown toward the same shape: durable objects, human-in-the-loop approval, explicit decisions, some notion of "who is allowed to do what." PMW theory gives that shape a name and a small, precise vocabulary — nine primitives, four operators, six invariants.

This document is the **contract**: for each PMW primitive/operator/invariant, what Tandem's concrete implementation is (shipped, with file paths), what AI Board's is (where one exists), and what a shared shape would look like if the two were ever to interoperate or be reviewed side by side. It is not a spec either system is bound to — it is a shared vocabulary so that future work on either system, or on anything that talks to both, doesn't have to re-derive the mapping from scratch.

Everything under "Tandem" in the tables below is real and shipped in this fork today, not proposed. Everything under "AI Board" is either "not yet" or a proposal explicitly marked as needing Neo's go-ahead before any code changes there — AI Board is a live external system with real ChatGPT/Claude.ai connectors, and this document does not authorize touching it.

---

## 2. Non-goals

- **Not a request to change AI Board.** Every AI Board row below is descriptive (what exists today) or explicitly marked `PROPOSAL — needs Neo's sign-off`. No code changes to AI Board follow from this document.
- **Not a rename of Tandem's existing vocabulary.** `Handoff` stays `Handoff`, not `wake_event`. The contract maps concepts, it doesn't force either system's internal naming to match PMW's or each other's.
- **Not a new runtime or shared library.** Tandem and AI Board stay two separate codebases (Electron/Express vs. Cloudflare Workers) with no shared dependency introduced by this document.
- **Not a claim that Tandem fully implements PMW.** Two operators (JOIN, and full Authority-based HANDOFF) and one invariant's enforcement (I4) are explicitly not implemented — see §5 and §6. This document names those gaps rather than papering over them.
- **Not a retrofit of every existing Tandem manager to the PMW naming.** Only the objects that were actually touched in Phases 1-4 are mapped; e.g. `Bookmark`/`HistoryEntry`/`Session` are ordinary Tandem data, not PMW primitives, and aren't forced into this table.

---

## 3. PMW vocabulary (recap)

From the theory series — kept intentionally brief here; the papers are the source of truth, not this section.

**Nine primitives:** `agents`, `events` (append-only log), `shared_state` (with CAS), `tasks`, `memory` (scoped Private/Shared), `wake_events` (idempotent), `handoffs`, `decision_receipts`, `topology_edges`.

**Four operators:** `ISOLATE` (exclusive ownership of a resource by one agent), `SHARE` (Private→Shared promotion, one-way), `JOIN` (merge previously-separate contexts back together), `HANDOFF` (transfer control/ownership, gated by authority).

**Six invariants:**
- **I1 State CAS** — writes to shared state are compare-and-set, not last-write-wins by default.
- **I2 Wake Idempotency** — a wake event delivered twice must not double-act.
- **I3 Scope Preservation** — a Private object stays Private until explicitly promoted; nothing silently becomes Shared.
- **I4 Authority Separation** — a HANDOFF recipient's capability set must cover what the sender could do (`Authority_B ⊆ Authority_A`); nothing lets a low-authority receiver silently inherit a high-authority sender's power.
- **I5 Append Events** — the event/decision log is append-only; no destructive edits.
- **I6 Explicit Receipt** — a wake that reaches a real decision point leaves a receipt (`ACK`/`NO_ACTION`/`ACTION`/`ERROR`).

---

## 4. Primitive mapping

| PMW primitive | Tandem (shipped) | AI Board (current) | Shared contract |
|---|---|---|---|
| `agents` | `AgentRegistry` — `{id, kind: 'human'|'ai', firstSeenAt, lastSeenAt}`. [`src/agents/agent-registry.ts`](../../src/agents/agent-registry.ts). No capability set yet (see I4). | Has an authorship/ontology model (per 2026-08-08 work) but not this exact shape. | An `agents` record needs at minimum a stable `id` and a `kind` discriminator. Capability/authority fields, if added to either side, should use the same field name (`authority` or `capabilities`) so a future cross-system audit doesn't have to translate two different names for the same concept. |
| `events` | `EventStreamManager` (`src/events/stream.ts`) — already append-only, already the general activity feed. | Has its own event/activity log. | No proposed change — both already satisfy I5 independently; this is the one primitive that needed no new work in either system. |
| `shared_state` | `Handoff`/`Annotation`/`AITask` all carry `version: number` + optional `expectedVersion` CAS (Phase 2). [`src/utils/version-conflict.ts`](../../src/utils/version-conflict.ts). | Not confirmed CAS'd — **PROPOSAL, needs Neo's sign-off before any AI Board change**: apply the same opt-in `expectedVersion` pattern to AI Board's durable objects, mapped to 409 the same way. | `version` as a plain incrementing integer, `expectedVersion` as an optional parameter that 409s on mismatch when supplied and is silently last-write-wins when omitted — this exact shape, not a vector clock or CRDT, is deliberately the smallest thing that satisfies I1. |
| `tasks` | `AITask` / `TaskManager` (`src/agents/task-manager.ts`), pre-existing, now CAS'd (Phase 2) and scope-aware (Phase 3). | Has tasks in its own domain model. | No proposed unification — task shapes are inherently domain-specific between a browser-automation tool and a discussion/board system. Not worth forcing a shared shape here. |
| `memory` (Private/Shared) | `Scope` (`'PRIVATE'|'SHARED'`) shared type + one-way `promote()`. [`src/utils/scope.ts`](../../src/utils/scope.ts). Applied to `Annotation` and `TaskStep` (Phase 3). | Not present. | If AI Board ever needs a Private/Shared distinction (e.g. a draft-vs-published state for AI-authored content), the same two-state enum + one-way promote is the minimal shape — resist adding a third state (e.g. "pending review") unless a real AI Board use case needs it; PMW's SHARE operator is explicitly binary. |
| `wake_events` | Not a separate primitive in Tandem — `Handoff.status` transitions (`waiting_approval`→`resolved` etc.) serve this role today, and idempotency is implicit in `HandoffManager.accept()`/`reject()` only accepting from a valid prior state. | Not confirmed. | Not proposing a new `WakeEvent` type in either system — the existing state-machine-gated transition already satisfies I2 (a second `accept()` on an already-accepted handoff throws `InvalidHandoffTransitionError`, it doesn't double-act). Documented here so a future reader doesn't go looking for a `wake_events` table that doesn't exist. |
| `handoffs` | `Handoff` / `HandoffManager` (`src/handoffs/manager.ts`), pre-existing, now state-machine-gated via `accept()`/`reject()` (Phase 2). | Has its own approval/review concept. | No unification proposed — Tandem's Handoff is tab/task-scoped by construction (`tabId`, `taskId`, `stepId`); forcing AI Board's approval concept into the same shape would be a worse fit for both. |
| `decision_receipts` | `DecisionReceiptManager` (`src/agents/decision-receipts.ts`), append-only, `ACK`/`NO_ACTION`/`ACTION`/`ERROR` vocabulary matching PMW exactly (Phase 3). | Not present. | This is the one primitive built with the shared vocabulary in mind from the start — the `Decision` enum is PMW's own wording, not Tandem's `approved`/`rejected`, specifically so a receipt from either system would read the same. **PROPOSAL, needs Neo's sign-off**: if AI Board ever needs a decision log, reuse this exact enum rather than inventing a third vocabulary. |
| `topology_edges` | Not implemented. `TabLockManager` (ISOLATE) and `Handoff.taskId`/`stepId` linkage are the closest things to a topology today, but neither is a general graph. | Not implemented. | Out of scope for both today. Not proposing a design here — no concrete consumer has asked for adaptive topology yet in either system, and inventing one speculatively would violate this fork's own "don't design for hypothetical requirements" discipline. |

---

## 5. Operator mapping

| PMW operator | Tandem (shipped) | Status |
|---|---|---|
| `ISOLATE` | `TabLockManager.acquire()`/`release()` (Phase 4), now grounded in `AgentRegistry` — every `acquire()` call touches the registry regardless of outcome. [`src/agents/tab-lock-manager.ts`](../../src/agents/tab-lock-manager.ts). | Shipped. |
| `SHARE` | `AnnotationManager.promote()` / `TaskManager.promoteStepScope()` (Phase 3), both one-way PRIVATE→SHARED, both throw `InvalidScopePromotionError` (409) if already SHARED. | Shipped. |
| `HANDOFF` | `HandoffManager.accept()`/`reject()` (Phase 2) validate the state-machine transition; `TaskHandoffCoordinator.approve()`/`reject()` (Phase 3, this line's fix) record a decision receipt on every real human decision, including through the public API/MCP surface, not just the desktop UI. | **Partially shipped.** The state-machine and receipt halves are done. The authority half (I4) is not — see below. |
| `JOIN` | Not implemented. | **Not shipped.** No concrete Tandem use case has needed "merge two previously-separate agent contexts back together" yet. State Tree's fork/compare (`src/state-tree/manager.ts`) is adjacent — it can *compare* two branches — but doesn't *merge* them. Left as a named gap, not invented speculatively. |

---

## 6. Invariant status

| Invariant | Tandem status | Gap, if any |
|---|---|---|
| I1 State CAS | Shipped (Phase 2) on Handoff/Annotation/AITask. | None — opt-in and backward compatible by design. |
| I2 Wake Idempotency | Shipped implicitly via handoff state-machine gating (`accept()`/`reject()` reject invalid-from-status transitions). | None known. |
| I3 Scope Preservation | Shipped (Phase 3) on Annotation/TaskStep via `Scope`/`promote()`. | None — promotion is the only path to SHARED, and it's one-way. |
| I4 Authority Separation | **Not enforced.** `HandoffManager.accept()`'s own doc comment names this gap explicitly; `AgentRegistry` (Phase 4) is the identity substrate a future capability check would consult, but no capability/authority field or check exists yet. | Real, open gap. Not closed by this document — closing it needs a concrete consumer (a case where two agents' authority actually needs comparing) to design against, not a speculative capability model built ahead of one. |
| I5 Append Events | Shipped — `EventStreamManager` (pre-existing) and `DecisionReceiptManager` (Phase 3) are both append-only; the latter has no update/delete API at all. | None. |
| I6 Explicit Receipt | Shipped (Phase 3), and extended this line to cover `approve()`/`reject()` (the public API/MCP path), not just the desktop UI's `handleApprovalResponse()`. | None known within Tandem's current decision points. |

---

## 7. Explicitly deferred

The following were identified during Phase-0 research as PMW-alignment opportunities on the **AI Board** side. None are authorized by this document. Each needs Neo's explicit go-ahead before any code change, because AI Board is a live external system with real ChatGPT/Claude.ai connectors and no staging environment:

- **Phase 6 (deferred):** AI Board CAS + its known dedup-race condition, using the same `version`/`expectedVersion` pattern as §4's `shared_state` row.
- **Phase 7 (deferred):** AI Board scoped memory (Private/Shared), an agents registry, and adaptive topology, using the same shapes as §4 where applicable.
- **Phase 8 (deferred, lower priority):** a cross-system provenance graph and Artifact Registry — no concrete consumer identified yet on either side; not designed here for the same reason JOIN isn't (§5).

---

## 8. Open questions for Neo

1. Is AI Board's CAS/dedup-race issue (Phase 6) actually a live problem worth prioritizing, or was it a Phase-0 research hypothesis that hasn't caused a real incident?
2. If Phase 6/7 go ahead, should they happen in a fresh conversation scoped to AI Board specifically (matching how the i18n work got split out), given this conversation's stated boundary of "PMW/AI Board/MCP main line" has so far meant researching AI Board's alignment, not modifying it?
3. Is `topology_edges` (adaptive topology) actually wanted, or is it PMW-theory completeness for its own sake? No concrete use case has surfaced in either system yet.
