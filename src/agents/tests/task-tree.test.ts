import { describe, it, expect, vi } from 'vitest';
import { buildTaskTree, ensureTaskWorkspace, type TaskTreeContext } from '../task-tree';
import type { TaskManager, AITask } from '../task-manager';
import type { WorkspaceManager, Workspace } from '../../workspaces/manager';
import type { TabManager, Tab } from '../../tabs/manager';

function makeTask(overrides: Partial<AITask> = {}): AITask {
  return {
    id: 'task-1',
    description: 'Fix mobile header',
    createdBy: 'claude',
    assignedTo: 'claude',
    status: 'pending',
    steps: [],
    currentStep: 0,
    results: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function makeWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: 'ws-1',
    name: 'Fix mobile header',
    icon: 'briefcase',
    color: '#4285f4',
    order: 1,
    isDefault: false,
    tabIds: [],
    ...overrides,
  };
}

function makeTab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: 'tab-1',
    webContentsId: 1,
    title: 'Example',
    url: 'https://example.com',
    favicon: '',
    groupId: null,
    active: true,
    createdAt: 0,
    source: 'user',
    pinned: false,
    partition: 'persist:tandem',
    emoji: null,
    emojiFlash: false,
    ...overrides,
  };
}

function makeContext(opts: {
  task?: AITask | null;
  workspace?: Workspace | null;
  tabs?: Tab[];
  setTaskWorkspace?: ReturnType<typeof vi.fn>;
  createWorkspace?: ReturnType<typeof vi.fn>;
}): TaskTreeContext {
  // Mutable so setTaskWorkspace() writes are visible to the next getTask()
  // call, mirroring the real TaskManager (persists then re-reads by id).
  let currentTask = opts.task ?? null;

  const taskManager = {
    getTask: vi.fn().mockImplementation(() => currentTask),
    setTaskWorkspace: opts.setTaskWorkspace ?? vi.fn().mockImplementation((_id: string, workspaceId: string) => {
      if (currentTask) currentTask = { ...currentTask, workspaceId };
      return currentTask;
    }),
  } as unknown as TaskManager;

  const workspaceManager = {
    get: vi.fn().mockReturnValue(opts.workspace ?? undefined),
    create: opts.createWorkspace ?? vi.fn().mockReturnValue(makeWorkspace()),
  } as unknown as WorkspaceManager;

  const tabManager = {
    listTabs: vi.fn().mockReturnValue(opts.tabs ?? []),
  } as unknown as TabManager;

  return { taskManager, workspaceManager, tabManager };
}

describe('buildTaskTree()', () => {
  it('returns null when the task does not exist', () => {
    const ctx = makeContext({ task: null });
    expect(buildTaskTree(ctx, 'missing')).toBeNull();
  });

  it('returns an empty workspace/views when the task has no linked workspace', () => {
    const ctx = makeContext({ task: makeTask() });
    const tree = buildTaskTree(ctx, 'task-1');
    expect(tree).toEqual({ task: makeTask(), workspace: null, views: [] });
  });

  it('composes the task with its workspace and only the tabs assigned to that workspace', () => {
    const task = makeTask({ workspaceId: 'ws-1' });
    const workspace = makeWorkspace({ tabIds: [1, 2] });
    const tabs = [
      makeTab({ id: 'tab-1', webContentsId: 1, title: 'A' }),
      makeTab({ id: 'tab-2', webContentsId: 2, title: 'B' }),
      makeTab({ id: 'tab-3', webContentsId: 3, title: 'Unrelated' }),
    ];
    const ctx = makeContext({ task, workspace, tabs });

    const tree = buildTaskTree(ctx, 'task-1');

    expect(tree?.workspace?.id).toBe('ws-1');
    expect(tree?.views).toHaveLength(2);
    expect(tree?.views.map((v) => v.id)).toEqual(['tab-1', 'tab-2']);
  });
});

describe('ensureTaskWorkspace()', () => {
  it('returns null when the task does not exist', () => {
    const ctx = makeContext({ task: null });
    expect(ensureTaskWorkspace(ctx, 'missing')).toBeNull();
  });

  it('throws when an explicit workspaceId does not exist', () => {
    const ctx = makeContext({ task: makeTask(), workspace: undefined as unknown as Workspace });
    expect(() => ensureTaskWorkspace(ctx, 'task-1', { workspaceId: 'ghost' })).toThrow('ghost');
  });

  it('links an explicit existing workspaceId', () => {
    const workspace = makeWorkspace({ id: 'ws-2' });
    const setTaskWorkspace = vi.fn();
    const ctx = makeContext({ task: makeTask({ workspaceId: 'ws-2' }), workspace, setTaskWorkspace });

    const tree = ensureTaskWorkspace(ctx, 'task-1', { workspaceId: 'ws-2' });

    expect(setTaskWorkspace).toHaveBeenCalledWith('task-1', 'ws-2');
    expect(tree?.workspace?.id).toBe('ws-2');
  });

  it('keeps an already-linked valid workspace without creating a new one', () => {
    const workspace = makeWorkspace({ id: 'ws-1' });
    const createWorkspace = vi.fn();
    const ctx = makeContext({ task: makeTask({ workspaceId: 'ws-1' }), workspace, createWorkspace });

    const tree = ensureTaskWorkspace(ctx, 'task-1');

    expect(createWorkspace).not.toHaveBeenCalled();
    expect(tree?.workspace?.id).toBe('ws-1');
  });

  it('creates a new workspace named after the task when none is linked', () => {
    const created = makeWorkspace({ id: 'ws-new', name: 'Fix mobile header' });
    const createWorkspace = vi.fn().mockReturnValue(created);
    const ctx = makeContext({ task: makeTask(), workspace: created, createWorkspace });

    const tree = ensureTaskWorkspace(ctx, 'task-1');

    expect(createWorkspace).toHaveBeenCalledWith(expect.objectContaining({ name: 'Fix mobile header' }));
    expect(ctx.taskManager.setTaskWorkspace).toHaveBeenCalledWith('task-1', 'ws-new');
    expect(tree?.workspace?.id).toBe('ws-new');
  });
});
