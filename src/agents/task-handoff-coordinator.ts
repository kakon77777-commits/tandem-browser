import type { Handoff, HandoffManager, AuthorityContext } from '../handoffs/manager';
import type { TaskManager, RiskLevel } from './task-manager';
import type { DecisionReceiptManager } from './decision-receipts';
import type { AgentRegistry } from './agent-registry';
import { wingmanAlert } from '../notifications/alert';

function appendHandoffNote(body: string, note: string): string {
  const trimmedBody = body.trim();
  return trimmedBody ? `${trimmedBody}\n\n${note}` : note;
}

/**
 * Keeps task execution state and durable human↔agent handoffs in sync.
 */
export class TaskHandoffCoordinator {
  constructor(
    private readonly taskManager: TaskManager,
    private readonly handoffManager: HandoffManager,
    private readonly decisionReceiptManager: DecisionReceiptManager,
    private readonly agentRegistry: AgentRegistry,
  ) {}

  handleApprovalRequest(data: Record<string, unknown>): Handoff | null {
    const taskId = typeof data.taskId === 'string' ? data.taskId : null;
    const stepId = typeof data.stepId === 'string' ? data.stepId : null;
    const task = taskId ? this.taskManager.getTask(taskId) : null;
    const action = data.action && typeof data.action === 'object'
      ? data.action as { params?: Record<string, unknown> }
      : null;
    const params = action?.params ?? {};

    const existing = taskId && stepId
      ? this.handoffManager.findOpenByTaskStep(taskId, stepId)
      : null;

    const payload = {
      status: 'waiting_approval' as const,
      title: 'Approval needed',
      body: typeof data.description === 'string' ? data.description : 'Agent action requires review.',
      reason: 'approval_required',
      actionLabel: 'Approve or reject this action',
      source: task?.createdBy ?? 'wingman',
      agentId: task?.assignedTo ?? null,
      taskId,
      stepId,
      workspaceId: typeof params.workspaceId === 'string' ? params.workspaceId : null,
      tabId: typeof params.tabId === 'string' ? params.tabId : null,
    };

    const isNew = !existing;
    const handoff = existing
      ? this.handoffManager.update(existing.id, payload)
      : this.handoffManager.create(payload);

    if (!handoff) {
      return null;
    }

    // Fire a native-OS notification (which plays the system sound on
    // macOS) so the user hears the agent stalling for input, even if
    // they're in a different workspace or away from the keyboard. Only
    // on the first creation — repeated emits for the same step (e.g.,
    // a retry) shouldn't spam.
    if (isNew) {
      wingmanAlert(handoff.title, handoff.body || handoff.reason);
    }

    this.syncHandoffState(handoff);
    return handoff;
  }

  handleApprovalResponse(data: { requestId: string; approved: boolean }): Handoff | null {
    const [taskId, stepId] = data.requestId.split(':');
    if (!taskId || !stepId) {
      return null;
    }

    const handoff = this.findLinkedHandoff(taskId, stepId);
    if (!handoff) {
      return null;
    }

    const updated = this.handoffManager.update(handoff.id, {
      status: 'resolved',
      open: false,
      actionLabel: data.approved ? 'Approval granted' : 'Approval rejected',
      body: appendHandoffNote(
        handoff.body,
        data.approved ? 'Approval granted.' : 'Approval rejected.',
      ),
    });

    if (!updated) {
      return null;
    }

    // PMW invariant I6 (Explicit Receipt): this is the point a real
    // human decision on an agent's requested action lands — record it,
    // in addition to (not replacing) TaskManager's own activity log.
    this.recordApprovalReceipt(taskId, stepId, handoff.id, data.approved);

    this.syncHandoffState(updated);
    return updated;
  }

  syncHandoffState(handoffOrId: string | Handoff): Handoff | null {
    const handoff = typeof handoffOrId === 'string'
      ? this.handoffManager.get(handoffOrId)
      : handoffOrId;
    if (!handoff) {
      return null;
    }
    if (!handoff.taskId || !handoff.stepId) {
      return handoff;
    }

    switch (handoff.status) {
      case 'waiting_approval':
        this.taskManager.pauseTaskForHandoff(handoff.taskId, handoff.stepId, handoff.id, 'approval');
        break;
      case 'needs_human':
      case 'blocked':
        this.taskManager.pauseTaskForHandoff(handoff.taskId, handoff.stepId, handoff.id, 'human');
        break;
      case 'completed_review':
        this.taskManager.linkStepHandoff(handoff.taskId, handoff.stepId, handoff.id, 'review');
        break;
      case 'ready_to_resume':
        this.taskManager.markTaskReadyToResume(handoff.taskId, handoff.stepId, handoff.id);
        break;
      case 'resolved':
        this.taskManager.clearStepHandoff(handoff.taskId, handoff.stepId, handoff.id);
        break;
      default:
        break;
    }

    return handoff;
  }

  /**
   * Marks a handoff ready for the agent to resume. Routes through
   * HandoffManager.accept() — the only path that may set `ready_to_resume` —
   * so an already-resolved handoff is correctly rejected (409, see
   * InvalidHandoffTransitionError) instead of silently "succeeding" the
   * way a raw update() would have.
   *
   * @param actorId - optional PMW I4 guard. Omit to keep prior behavior
   * (no authority check). When supplied, resolved against AgentRegistry to
   * find the actor's kind; `'user'` always resolves to `'human'` (matching
   * TabLockManager/AgentRegistry's own hardcoded treatment of that
   * sentinel elsewhere) even if it was never explicitly touch()'d, so a
   * real human can't get locked out of their own approval by a registry
   * that just hasn't seen `'user'` yet. Any other unregistered id fails
   * closed as `'ai'`, never `'human'`. Blocks an AI agent from
   * self-clearing a handoff linked to its own medium/high-risk step — see
   * HandoffManager.accept().
   */
  markReady(handoffId: string, actorId?: string): Handoff | null {
    const existing = this.requireHandoff(handoffId);
    if (!existing) {
      return null;
    }
    const authority: AuthorityContext | undefined = actorId
      ? { kind: actorId === 'user' ? 'human' : this.agentRegistry.get(actorId)?.kind ?? 'ai', riskLevel: this.linkedRiskLevel(existing) }
      : undefined;
    const handoff = this.handoffManager.accept(handoffId, {
      actionLabel: 'Resume agent',
      body: appendHandoffNote(existing.body, 'Human marked this task ready for the agent to resume.'),
    }, undefined, authority);
    this.syncHandoffState(handoff);
    return handoff;
  }

  resume(handoffId: string): Handoff | null {
    const handoff = this.requireHandoff(handoffId);
    if (!handoff) {
      return null;
    }

    if (handoff.taskId && handoff.stepId) {
      const resumed = this.taskManager.resumeTask(handoff.taskId, handoff.stepId, handoff.id);
      if (!resumed) {
        throw new Error(`Task ${handoff.taskId} step ${handoff.stepId} is not resumable`);
      }
    }

    const resolved = this.handoffManager.update(handoff.id, {
      status: 'resolved',
      open: false,
      actionLabel: 'Agent resumed',
      body: appendHandoffNote(handoff.body, 'Agent resumed from this handoff.'),
    });
    if (!resolved) {
      return null;
    }

    this.syncHandoffState(resolved);
    return resolved;
  }

  /**
   * @param actorId - recorded on the decision receipt for API-surface
   * symmetry with markReady(); NOT an I4 authority check here — this
   * design intentionally scopes I4 enforcement to markReady() -> accept()
   * only (see HandoffManager.accept()'s doc comment). Rewiring approve()/
   * reject() to route through accept()/reject() so they'd enforce it too
   * is a bigger behavioral change than this primitive, left for Neo to
   * decide as a follow-up rather than built silently.
   */
  approve(handoffId: string, actorId?: string): Handoff | null {
    const handoff = this.requireHandoff(handoffId);
    if (!handoff) {
      return null;
    }

    if (!handoff.taskId || !handoff.stepId) {
      return this.resolveStandaloneApproval(handoff, true);
    }

    this.requireTaskLinkedHandoff(handoffId, 'approve');

    this.taskManager.respondToApproval(handoff.taskId as string, handoff.stepId as string, true);
    this.recordApprovalReceipt(handoff.taskId, handoff.stepId, handoffId, true, actorId);
    return this.handoffManager.get(handoffId);
  }

  /** @param actorId - see approve()'s doc comment. */
  reject(handoffId: string, actorId?: string): Handoff | null {
    const handoff = this.requireHandoff(handoffId);
    if (!handoff) {
      return null;
    }

    if (!handoff.taskId || !handoff.stepId) {
      return this.resolveStandaloneApproval(handoff, false);
    }

    this.requireTaskLinkedHandoff(handoffId, 'reject');

    this.taskManager.respondToApproval(handoff.taskId as string, handoff.stepId as string, false);
    this.recordApprovalReceipt(handoff.taskId, handoff.stepId, handoffId, false, actorId);
    return this.handoffManager.get(handoffId);
  }

  /** Risk of the handoff's linked task step, or null if it isn't linked to one. */
  private linkedRiskLevel(handoff: Handoff): RiskLevel | null {
    if (!handoff.taskId || !handoff.stepId) return null;
    return this.taskManager.getStep(handoff.taskId, handoff.stepId)?.step.riskLevel ?? null;
  }

  /**
   * PMW invariant I6 (Explicit Receipt): records the same receipt shape
   * regardless of whether the human decision arrived via handleApprovalResponse
   * (desktop UI, IPC) or approve()/reject() (public API + MCP tools —
   * tandem_handoff_approve/reject). Both are real decision points.
   */
  private recordApprovalReceipt(taskId: string, stepId: string, handoffId: string, approved: boolean, actorId?: string): void {
    this.decisionReceiptManager.record({
      taskId,
      stepId,
      handoffId,
      actor: actorId ?? 'user',
      decision: approved ? 'ACTION' : 'NO_ACTION',
      riskLevel: this.taskManager.getStep(taskId, stepId)?.step.riskLevel ?? null,
    });
  }

  private findLinkedHandoff(taskId: string, stepId: string): Handoff | null {
    const taskContext = this.taskManager.getStep(taskId, stepId);
    const handoffId = taskContext?.step.handoffId;
    if (handoffId) {
      const linked = this.handoffManager.get(handoffId);
      if (linked) {
        return linked;
      }
    }
    return this.handoffManager.findOpenByTaskStep(taskId, stepId);
  }

  private requireHandoff(handoffId: string): Handoff | null {
    return this.handoffManager.get(handoffId);
  }

  private resolveStandaloneApproval(handoff: Handoff, approved: boolean): Handoff | null {
    const updated = this.handoffManager.update(handoff.id, {
      status: 'resolved',
      open: false,
      actionLabel: approved ? 'Approved' : 'Rejected',
      body: appendHandoffNote(
        handoff.body,
        approved ? 'Human approved this handoff.' : 'Human rejected this handoff.',
      ),
    });
    if (!updated) {
      return null;
    }
    this.decisionReceiptManager.record({
      taskId: null,
      stepId: null,
      handoffId: handoff.id,
      actor: 'user',
      decision: approved ? 'ACTION' : 'NO_ACTION',
      riskLevel: null,
    });
    this.syncHandoffState(updated);
    return updated;
  }

  private requireTaskLinkedHandoff(handoffId: string, verb: string): Handoff | null {
    const handoff = this.requireHandoff(handoffId);
    if (!handoff) {
      return null;
    }
    if (!handoff.taskId || !handoff.stepId) {
      throw new Error(`Cannot ${verb} a handoff that is not linked to a task step`);
    }
    if (!this.taskManager.getStep(handoff.taskId, handoff.stepId)) {
      throw new Error(`Linked task ${handoff.taskId} step ${handoff.stepId} was not found`);
    }
    return handoff;
  }
}
