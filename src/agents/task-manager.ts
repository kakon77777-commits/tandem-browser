/**
 * TaskManager — Agent Autonomy (Phase 4)
 *
 * Manages AI tasks, approval workflow, risk assessment, and emergency stop.
 * Tasks are persisted to ~/.tandem/tasks/ as JSON files.
 *
 * Risk levels:
 * - none: read, screenshot, scroll → auto-approve
 * - low: navigate, open tabs → auto-approve (configurable)
 * - medium: click, select → ask for unknown sites
 * - high: type, forms, purchase → always ask
 */

import fs from 'fs';
import { EventEmitter } from 'events';
import { tandemDir, ensureDir } from '../utils/paths';
import { assertSinglePathSegment, hostnameMatches, resolvePathWithinRoot, tryParseUrl } from '../utils/security';
import { checkVersion } from '../utils/version-conflict';
import { isScope, InvalidScopePromotionError, type Scope } from '../utils/scope';

export { InvalidScopePromotionError } from '../utils/scope';

// ─── Types ───────────────────────────────────────────────────────────────────

export type RiskLevel = 'none' | 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'running' | 'paused' | 'waiting-approval' | 'ready-to-resume' | 'done' | 'failed' | 'cancelled';
export type StepStatus = 'pending' | 'running' | 'done' | 'skipped' | 'rejected';
export type StepWaitState = 'approval' | 'human' | 'review';

export interface TaskStep {
  id: string;
  description: string;
  action: { type: string; params: Record<string, unknown> };
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  status: StepStatus;
  result?: unknown;
  startedAt?: number;
  completedAt?: number;
  handoffId?: string;
  waitingOn?: StepWaitState;
  readyToResumeAt?: number;
  /**
   * PMW scoped-memory primitive (Private→Shared) — see src/utils/scope.ts.
   * Defaults to SHARED (matches pre-existing behavior: every step was
   * implicitly visible before this field existed). Promote via
   * TaskManager.promoteStepScope() — the SHARE operator. NOT YET ENFORCED:
   * nothing filters PRIVATE steps by caller today, same documented gap as
   * AnnotationManager's scope field.
   */
  scope?: Scope;
}

export interface AITask {
  id: string;
  description: string;
  createdBy: 'user' | 'claude' | 'openclaw';
  assignedTo: 'claude' | 'openclaw';
  status: TaskStatus;
  steps: TaskStep[];
  currentStep: number;
  results: unknown[];
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  /** Workspace this task's browser work is scoped to (SRW task↔workspace mapping). See src/agents/task-tree.ts */
  workspaceId?: string;
  /** Compare-and-set version, incremented on every saveTask(). See src/utils/version-conflict.ts. */
  version: number;
}

export interface TaskActivityEntry {
  timestamp: number;
  agent: string;
  taskId?: string;
  action: string;
  target?: string;
  riskLevel?: RiskLevel;
  approved?: boolean;
  approvedBy?: 'user' | 'auto';
}

export interface AutonomySettings {
  autoApproveRead: boolean;
  autoApproveNavigate: boolean;
  autoApproveClick: boolean;
  autoApproveType: boolean;
  autoApproveForms: boolean;
  trustedSites: string[];
}

// ── Risk assessment ──

const ACTION_RISK: Record<string, RiskLevel> = {
  'read_page': 'none',
  'screenshot': 'none',
  'scroll': 'none',
  'get_links': 'none',
  'get_context': 'none',
  'list_tabs': 'none',
  'navigate': 'low',
  'open_tab': 'low',
  'close_tab': 'low',
  'focus_tab': 'low',
  'go_back': 'low',
  'go_forward': 'low',
  'reload': 'low',
  'click': 'medium',
  'select': 'medium',
  'execute_js': 'high',
  'type': 'high',
  'fill_form': 'high',
  'submit': 'high',
};

export function getRiskLevel(actionType: string): RiskLevel {
  return ACTION_RISK[actionType] || 'medium';
}

// ── Defaults & sanitizers ──

const DEFAULT_AUTONOMY: AutonomySettings = {
  autoApproveRead: true,
  autoApproveNavigate: true,
  autoApproveClick: false,
  autoApproveType: false,
  autoApproveForms: false,
  trustedSites: ['google.com', 'wikipedia.org', 'duckduckgo.com'],
};

function sanitizeTrustedSites(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_AUTONOMY.trustedSites];
  }

  const sanitized = value
    .filter((site): site is string => typeof site === 'string')
    .map((site) => site.trim().toLowerCase())
    .filter((site) => site.length > 0 && !site.includes('/') && !site.includes('\\'))
    .filter((site, index, arr) => arr.indexOf(site) === index);

  return sanitized.length > 0 ? sanitized : [...DEFAULT_AUTONOMY.trustedSites];
}

function sanitizeAutonomySettings(raw: unknown, base: AutonomySettings = DEFAULT_AUTONOMY): AutonomySettings {
  const patch = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Partial<Record<keyof AutonomySettings, unknown>>
    : {};

  return {
    autoApproveRead: typeof patch.autoApproveRead === 'boolean' ? patch.autoApproveRead : base.autoApproveRead,
    autoApproveNavigate: typeof patch.autoApproveNavigate === 'boolean' ? patch.autoApproveNavigate : base.autoApproveNavigate,
    autoApproveClick: typeof patch.autoApproveClick === 'boolean' ? patch.autoApproveClick : base.autoApproveClick,
    autoApproveType: typeof patch.autoApproveType === 'boolean' ? patch.autoApproveType : base.autoApproveType,
    autoApproveForms: typeof patch.autoApproveForms === 'boolean' ? patch.autoApproveForms : base.autoApproveForms,
    trustedSites: patch.trustedSites !== undefined ? sanitizeTrustedSites(patch.trustedSites) : [...base.trustedSites],
  };
}

// ─── Manager ─────────────────────────────────────────────────────────────────

/**
 * TaskManager — Manages AI tasks, approval workflow, risk assessment, and emergency stop.
 */
export class TaskManager extends EventEmitter {

  // === 1. Private state ===

  private tasksDir: string;
  private activityLog: TaskActivityEntry[] = [];
  private emergencyStopped = false;
  private autonomy: AutonomySettings;

  // === 2. Constructor ===

  constructor() {
    super();
    this.tasksDir = ensureDir(tandemDir('tasks'));
    this.autonomy = this.loadAutonomySettings();
    this.activityLog = this.loadActivityLog();
  }

  // === 4. Public methods ===

  // ── Autonomy Settings ──

  getAutonomySettings(): AutonomySettings {
    return { ...this.autonomy };
  }

  updateAutonomySettings(patch: Partial<AutonomySettings>): AutonomySettings {
    this.autonomy = sanitizeAutonomySettings(patch, this.autonomy);
    this.saveAutonomySettings();
    return this.getAutonomySettings();
  }

  // ── Task CRUD ──

  createTask(description: string, createdBy: AITask['createdBy'], assignedTo: AITask['assignedTo'], steps: Omit<TaskStep, 'id' | 'status'>[], workspaceId?: string): AITask {
    const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const task: AITask = {
      id,
      description,
      createdBy,
      assignedTo,
      status: 'pending',
      steps: steps.map((s, i) => ({
        ...s,
        id: `${id}-step-${i}`,
        status: 'pending' as StepStatus,
      })),
      currentStep: 0,
      results: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 0, // saveTask() below unconditionally bumps this to 1 — see saveTask()
      ...(workspaceId ? { workspaceId } : {}),
    };
    this.saveTask(task);
    this.emit('task-created', task);
    return task;
  }

  /** Link a task to a workspace so its browser work is scoped to that workspace's tabs. */
  setTaskWorkspace(taskId: string, workspaceId: string): AITask | null {
    const task = this.getTask(taskId);
    if (!task) return null;
    task.workspaceId = workspaceId;
    this.saveTask(task);
    this.emit('task-updated', task);
    return task;
  }

  getTask(id: string): AITask | null {
    try {
      const filePath = this.getTaskFilePath(id);
      if (fs.existsSync(filePath)) {
        const task = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as AITask;
        // Files written before `version` existed load as version 1 — the
        // same value a fresh createTask() would have after its first save.
        if (typeof task.version !== 'number' || !Number.isInteger(task.version) || task.version < 1) {
          task.version = 1;
        }
        return task;
      }
    } catch { /* not found */ }
    return null;
  }

  listTasks(status?: TaskStatus): AITask[] {
    const tasks: AITask[] = [];
    try {
      const files = fs.readdirSync(this.tasksDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const task = JSON.parse(fs.readFileSync(resolvePathWithinRoot(this.tasksDir, file), 'utf-8'));
          if (!status || task.status === status) {
            tasks.push(task);
          }
        } catch { /* skip corrupt */ }
      }
    } catch { /* empty */ }
    return tasks.sort((a, b) => b.createdAt - a.createdAt);
  }

  // ── Approval Logic ──

  /**
   * Check if an action needs approval based on risk level, autonomy settings, and site trust.
   */
  needsApproval(actionType: string, targetUrl?: string): boolean {
    const risk = getRiskLevel(actionType);

    // None risk = never needs approval
    if (risk === 'none' && this.autonomy.autoApproveRead) return false;

    // Check trusted sites for medium risk
    if (risk === 'medium' && targetUrl) {
      try {
        const parsedUrl = tryParseUrl(targetUrl);
        if (!parsedUrl) {
          return true;
        }
        const isTrusted = this.autonomy.trustedSites.some(
          site => hostnameMatches(parsedUrl, site)
        );
        if (isTrusted && this.autonomy.autoApproveClick) return false;
      } catch { /* not a valid URL, require approval */ }
    }

    // Low risk
    if (risk === 'low' && this.autonomy.autoApproveNavigate) return false;

    // Medium risk click
    if (risk === 'medium' && this.autonomy.autoApproveClick) return false;

    // High risk type
    if (risk === 'high' && actionType === 'type' && this.autonomy.autoApproveType) return false;

    // High risk forms
    if (risk === 'high' && (actionType === 'fill_form' || actionType === 'submit') && this.autonomy.autoApproveForms) return false;

    // Default: require approval for medium and high
    return risk === 'medium' || risk === 'high';
  }

  /**
   * Request approval for a task step. Emits 'approval-request' event.
   * Returns a promise that resolves when Robin approves/rejects.
   */
  requestApproval(task: AITask, stepIndex: number): Promise<boolean> {
    const step = task.steps[stepIndex];
    if (!step) return Promise.resolve(false);

    task.status = 'waiting-approval';
    step.status = 'pending';
    this.saveTask(task);

    return new Promise((resolve) => {
      const requestId = `${task.id}:${step.id}`;
      this.emit('approval-request', {
        requestId,
        taskId: task.id,
        stepId: step.id,
        description: step.description,
        action: step.action,
        riskLevel: step.riskLevel,
      });

      const handler = (data: { requestId: string; approved: boolean }) => {
        if (data.requestId === requestId) {
          this.removeListener('approval-response', handler);
          resolve(data.approved);
        }
      };
      this.on('approval-response', handler);
    });
  }

  /**
   * Called when Robin approves or rejects a step.
   */
  respondToApproval(taskId: string, stepId: string, approved: boolean): void {
    const task = this.getTask(taskId);
    if (!task) return;

    const step = task.steps.find(s => s.id === stepId);
    if (!step) return;

    if (approved) {
      step.status = 'running';
      task.status = 'running';
    } else {
      step.status = 'rejected';
      task.status = 'paused';
    }
    this.saveTask(task);

    this.emit('approval-response', {
      requestId: `${taskId}:${stepId}`,
      approved,
    });

    this.logActivity({
      timestamp: Date.now(),
      agent: task.assignedTo,
      taskId: task.id,
      action: approved ? 'step-approved' : 'step-rejected',
      target: step.description,
      riskLevel: step.riskLevel,
      approved,
      approvedBy: 'user',
    });
  }

  getStep(taskId: string, stepId: string): { task: AITask; step: TaskStep; stepIndex: number } | null {
    const task = this.getTask(taskId);
    if (!task) return null;

    const stepIndex = task.steps.findIndex(step => step.id === stepId);
    if (stepIndex < 0) return null;

    const step = task.steps[stepIndex];
    if (!step) return null;

    return { task, step, stepIndex };
  }

  pauseTaskForHandoff(taskId: string, stepId: string, handoffId: string, waitingOn: Extract<StepWaitState, 'approval' | 'human'>): AITask | null {
    const context = this.getStep(taskId, stepId);
    if (!context) return null;

    const { task, step } = context;
    step.handoffId = handoffId;
    step.waitingOn = waitingOn;
    delete step.readyToResumeAt;

    if (step.status === 'running') {
      step.status = 'pending';
    }

    task.status = waitingOn === 'approval' ? 'waiting-approval' : 'paused';
    this.saveTask(task);
    this.emit('task-updated', task);
    return task;
  }

  linkStepHandoff(taskId: string, stepId: string, handoffId: string, waitingOn: StepWaitState): AITask | null {
    const context = this.getStep(taskId, stepId);
    if (!context) return null;

    const { task, step } = context;
    step.handoffId = handoffId;
    step.waitingOn = waitingOn;
    if (waitingOn !== 'human') {
      delete step.readyToResumeAt;
    }

    this.saveTask(task);
    this.emit('task-updated', task);
    return task;
  }

  markTaskReadyToResume(taskId: string, stepId: string, handoffId: string): AITask | null {
    const context = this.getStep(taskId, stepId);
    if (!context) return null;

    const { task, step } = context;
    if (step.status === 'done' || step.status === 'skipped' || step.status === 'rejected') {
      return task;
    }

    step.handoffId = handoffId;
    delete step.waitingOn;
    step.readyToResumeAt = Date.now();
    if (step.status === 'running') {
      step.status = 'pending';
    }

    task.status = 'ready-to-resume';
    this.saveTask(task);
    this.emit('task-updated', task);
    return task;
  }

  resumeTask(taskId: string, stepId: string, handoffId?: string): AITask | null {
    const context = this.getStep(taskId, stepId);
    if (!context) return null;

    const { task, step } = context;
    if (step.status === 'done' || step.status === 'skipped' || step.status === 'rejected') {
      return null;
    }

    if (handoffId && step.handoffId && step.handoffId !== handoffId) {
      return null;
    }

    step.status = 'running';
    step.startedAt = Date.now();
    delete step.waitingOn;
    delete step.readyToResumeAt;
    delete step.handoffId;

    task.status = 'running';
    this.saveTask(task);
    this.emit('task-updated', task);
    return task;
  }

  clearStepHandoff(taskId: string, stepId: string, handoffId?: string): AITask | null {
    const context = this.getStep(taskId, stepId);
    if (!context) return null;

    const { task, step } = context;
    if (handoffId && step.handoffId && step.handoffId !== handoffId) {
      return null;
    }

    delete step.handoffId;
    delete step.waitingOn;
    delete step.readyToResumeAt;

    this.saveTask(task);
    this.emit('task-updated', task);
    return task;
  }

  // ── Task Execution Updates ──

  /**
   * @param expectedVersion - optional CAS guard. Omit for today's
   * last-write-wins behavior; pass `task.version` to reject the write with
   * VersionConflictError if something else updated the task first.
   */
  updateStepStatus(taskId: string, stepIndex: number, status: StepStatus, result?: unknown, expectedVersion?: number): AITask | null {
    const task = this.getTask(taskId);
    if (!task || !this.isValidStepIndex(task, stepIndex)) return null;
    checkVersion(taskId, task.version, expectedVersion);

    const step = task.steps.at(stepIndex);
    if (!step) return null;

    step.status = status;
    if (result !== undefined) {
      step.result = result;
      if (stepIndex >= task.results.length) {
        task.results.length = stepIndex + 1;
      }
      task.results.splice(stepIndex, 1, result);
    }
    if (status === 'running') step.startedAt = Date.now();
    if (status === 'done' || status === 'skipped' || status === 'rejected') {
      step.completedAt = Date.now();
    }

    // Update task status
    const allDone = task.steps.every(s => s.status === 'done' || s.status === 'skipped');
    const anyFailed = task.steps.some(s => s.status === 'rejected');
    if (allDone) {
      task.status = 'done';
      task.completedAt = Date.now();
    } else if (anyFailed) {
      task.status = 'paused';
    }

    this.saveTask(task);
    this.emit('task-updated', task);
    return task;
  }

  /**
   * Promote a PRIVATE step to SHARED — the PMW SHARE operator, mirroring
   * AnnotationManager.promote(). Throws InvalidScopePromotionError if the
   * step is already SHARED (including a step with no `scope` set at all —
   * absent scope means "implicitly shared", same as the default everywhere
   * else this primitive is used).
   *
   * @param expectedVersion - optional CAS guard, see updateStepStatus()
   */
  promoteStepScope(taskId: string, stepIndex: number, expectedVersion?: number): AITask {
    const task = this.getTask(taskId);
    if (!task || !this.isValidStepIndex(task, stepIndex)) {
      throw new Error(`Task ${taskId} step ${stepIndex} not found`);
    }
    checkVersion(taskId, task.version, expectedVersion);

    const step = task.steps.at(stepIndex);
    if (!step) {
      throw new Error(`Task ${taskId} step ${stepIndex} not found`);
    }
    const currentScope: Scope = isScope(step.scope) ? step.scope : 'SHARED';
    if (currentScope === 'SHARED') {
      throw new InvalidScopePromotionError('task step', `${taskId}/${step.id}`, currentScope);
    }

    step.scope = 'SHARED';
    this.saveTask(task);
    this.emit('task-updated', task);
    return task;
  }

  markTaskRunning(taskId: string): void {
    const task = this.getTask(taskId);
    if (task) {
      task.status = 'running';
      this.saveTask(task);
      this.emit('task-updated', task);
    }
  }

  markTaskDone(taskId: string, results?: unknown[]): void {
    const task = this.getTask(taskId);
    if (task) {
      task.status = 'done';
      task.completedAt = Date.now();
      if (results) task.results = results;
      this.saveTask(task);
      this.emit('task-updated', task);
    }
  }

  markTaskFailed(taskId: string, error: string): void {
    const task = this.getTask(taskId);
    if (task) {
      task.status = 'failed';
      task.completedAt = Date.now();
      task.results.push({ error });
      this.saveTask(task);
      this.emit('task-updated', task);
    }
  }

  // ── Emergency Stop ──

  emergencyStop(): { stopped: number } {
    this.emergencyStopped = true;
    let stopped = 0;

    const tasks = this.listTasks();
    for (const task of tasks) {
      if (task.status === 'running' || task.status === 'waiting-approval' || task.status === 'pending') {
        task.status = 'paused';
        // Pause any running steps
        for (const step of task.steps) {
          if (step.status === 'running') step.status = 'pending';
        }
        this.saveTask(task);
        stopped++;
      }
    }

    this.emit('emergency-stop', { stopped });

    this.logActivity({
      timestamp: Date.now(),
      agent: 'system',
      action: 'emergency-stop',
      target: `${stopped} tasks paused`,
      approvedBy: 'user',
    });

    // Auto-reset after a brief moment so new tasks can be created
    setTimeout(() => { this.emergencyStopped = false; }, 1000);

    return { stopped };
  }

  isEmergencyStopped(): boolean {
    return this.emergencyStopped;
  }

  // ── Activity Log ──

  logActivity(entry: TaskActivityEntry): void {
    this.activityLog.push(entry);
    this.saveActivityLog();
    this.emit('activity', entry);
  }

  getActivityLog(limit = 50): TaskActivityEntry[] {
    return this.activityLog.slice(-limit);
  }

  // === 6. Cleanup ===

  destroy(): void {
    this.emergencyStop();
    this.removeAllListeners();
  }

  // === 7. Private helpers ===

  private loadAutonomySettings(): AutonomySettings {
    const settingsPath = tandemDir('autonomy-settings.json');
    try {
      if (fs.existsSync(settingsPath)) {
        const raw = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        return sanitizeAutonomySettings(raw);
      }
    } catch { /* use defaults */ }
    return { ...DEFAULT_AUTONOMY };
  }

  private saveAutonomySettings(): void {
    const settingsPath = tandemDir('autonomy-settings.json');
    try {
      fs.writeFileSync(settingsPath, JSON.stringify(this.autonomy, null, 2));
    } catch { /* silent */ }
  }

  private getTaskFilePath(taskId: string): string {
    const safeTaskId = assertSinglePathSegment(taskId, 'task id');
    return resolvePathWithinRoot(this.tasksDir, `${safeTaskId}.json`);
  }

  private isValidStepIndex(task: AITask, stepIndex: number): boolean {
    return Number.isInteger(stepIndex) && stepIndex >= 0 && stepIndex < task.steps.length;
  }

  private saveTask(task: AITask): void {
    task.updatedAt = Date.now();
    task.version = (task.version || 0) + 1;
    try {
      fs.writeFileSync(
        this.getTaskFilePath(task.id),
        JSON.stringify(task, null, 2)
      );
    } catch { /* silent */ }
  }

  private loadActivityLog(): TaskActivityEntry[] {
    const logPath = tandemDir('activity-log.json');
    try {
      if (fs.existsSync(logPath)) {
        const entries = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
        // Keep last 500 entries
        return Array.isArray(entries) ? entries.slice(-500) : [];
      }
    } catch { /* fresh start */ }
    return [];
  }

  private saveActivityLog(): void {
    const logPath = tandemDir('activity-log.json');
    try {
      // Keep last 500 entries
      const trimmed = this.activityLog.slice(-500);
      fs.writeFileSync(logPath, JSON.stringify(trimmed, null, 2));
    } catch { /* silent */ }
  }
}
