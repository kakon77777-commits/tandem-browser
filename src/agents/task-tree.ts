import type { TaskManager, AITask } from './task-manager';
import type { WorkspaceManager, Workspace } from '../workspaces/manager';
import type { TabManager } from '../tabs/manager';

// ─── Types ──────────────────────────────────────────────────────────

export interface TaskTreeView {
  id: string;
  webContentsId: number;
  title: string;
  url: string;
  active: boolean;
}

export interface TaskTreeResult {
  task: AITask;
  workspace: Workspace | null;
  views: TaskTreeView[];
}

export interface TaskTreeContext {
  taskManager: TaskManager;
  workspaceManager: WorkspaceManager;
  tabManager: TabManager;
}

export interface EnsureTaskWorkspaceOptions {
  workspaceId?: string;
  name?: string;
  icon?: string;
  color?: string;
}

// ─── Composition ────────────────────────────────────────────────────

/**
 * Compose a task with its scoped workspace and views — the SRW paper's
 * Φ: T_A → P(T_B) mapping (an agent task node to its browser state nodes).
 *
 * Returns null if the task doesn't exist. `workspace`/`views` are empty
 * when the task has no linked workspace yet (see ensureTaskWorkspace).
 */
export function buildTaskTree(ctx: TaskTreeContext, taskId: string): TaskTreeResult | null {
  const task = ctx.taskManager.getTask(taskId);
  if (!task) return null;

  const workspace = task.workspaceId ? ctx.workspaceManager.get(task.workspaceId) ?? null : null;
  if (!workspace) {
    return { task, workspace: null, views: [] };
  }

  const tabIdSet = new Set(workspace.tabIds);
  const views: TaskTreeView[] = ctx.tabManager.listTabs()
    .filter((tab) => tabIdSet.has(tab.webContentsId))
    .map((tab) => ({
      id: tab.id,
      webContentsId: tab.webContentsId,
      title: tab.title,
      url: tab.url,
      active: tab.active,
    }));

  return { task, workspace, views };
}

/**
 * Ensure a task has a workspace scoped to its browser work.
 *
 * - If `opts.workspaceId` is given, links that existing workspace (throws if not found).
 * - Else if the task already has a valid linked workspace, keeps it.
 * - Else creates a new workspace named after the task description and links it.
 */
export function ensureTaskWorkspace(
  ctx: TaskTreeContext,
  taskId: string,
  opts?: EnsureTaskWorkspaceOptions,
): TaskTreeResult | null {
  const task = ctx.taskManager.getTask(taskId);
  if (!task) return null;

  if (opts?.workspaceId) {
    const existing = ctx.workspaceManager.get(opts.workspaceId);
    if (!existing) throw new Error(`Workspace ${opts.workspaceId} not found`);
    ctx.taskManager.setTaskWorkspace(taskId, opts.workspaceId);
    return buildTaskTree(ctx, taskId);
  }

  if (task.workspaceId && ctx.workspaceManager.get(task.workspaceId)) {
    return buildTaskTree(ctx, taskId);
  }

  const created = ctx.workspaceManager.create({
    name: opts?.name || task.description.slice(0, 60) || `Task ${taskId}`,
    icon: opts?.icon,
    color: opts?.color,
  });
  ctx.taskManager.setTaskWorkspace(taskId, created.id);
  return buildTaskTree(ctx, taskId);
}
