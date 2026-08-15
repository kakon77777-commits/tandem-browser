import fs from 'fs';
import type { Request, Response, Router } from 'express';
import type { RouteContext } from '../context';
import { getSessionWC, resolveRequestedTab } from '../context';
import { handleRouteError } from '../../utils/errors';
import { saveStateScreenshot, truncateDomSummary } from '../../state-tree/capture';
import type { StateNode, StateTreeListFilters } from '../../state-tree/manager';
import { capturePagePng } from '../../utils/screenshot';

interface CaptureOptions {
  parentId?: string | null;
  joinedFromId?: string | null;
  taskId?: string | null;
  label?: string;
}

// Best-effort sub-captures get a short bound of their own rather than
// DEFAULT_TIMEOUT_MS (30s). capturePage()/getSnapshot() could hang
// indefinitely (never resolve or reject) against the currently focused tab
// when a CDP debugger was attached — capturePagePng() now routes around
// that (see utils/screenshot.ts), but the timeout stays as a safety net for
// genuinely slow captures. A metadata-only (Level 0) node is still a valid
// capture, so failing fast here matters more than waiting it out.
const CAPTURE_SUBTASK_TIMEOUT_MS = 5_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timed out')), ms)),
  ]);
}

/**
 * Observe whatever the target tab currently shows (screenshot + compact DOM
 * summary, best-effort) and record it as a new Browser State Tree node.
 */
async function captureNode(ctx: RouteContext, req: Request, opts: CaptureOptions): Promise<StateNode> {
  const requestedTab = resolveRequestedTab(ctx, req, { allowBody: true });
  const wc = await getSessionWC(ctx, req);
  if (!wc) {
    throw new Error('No active tab');
  }

  const tab = requestedTab.tab ?? ctx.tabManager.getActiveTab();
  const wcId = tab?.webContentsId ?? wc.id;

  let screenshotPath: string | null = null;
  let domSummary: string | null = null;

  const nodeFileId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const png = await withTimeout(capturePagePng(wc), CAPTURE_SUBTASK_TIMEOUT_MS);
    screenshotPath = saveStateScreenshot(png, nodeFileId);
  } catch {
    // best-effort — a metadata-only (Level 0) node is still a valid capture
  }
  try {
    const snapshot = await withTimeout(ctx.snapshotManager.getSnapshot({ wcId, compact: true }), CAPTURE_SUBTASK_TIMEOUT_MS);
    domSummary = truncateDomSummary(snapshot.text);
  } catch {
    // best-effort
  }

  const captureInput = {
    taskId: opts.taskId ?? null,
    tabId: tab?.id ?? null,
    webContentsId: wcId,
    label: opts.label || tab?.title || 'snapshot',
    url: tab?.url ?? wc.getURL(),
    screenshotPath,
    domSummary,
  };

  // Routing through join() (rather than capture({parentId, joinedFromId}))
  // so its self/different-roots validation actually runs — mirrors how the
  // /fork route relies on the manager's own existence checks being real,
  // not just the route's pre-check.
  if (opts.joinedFromId) {
    return ctx.stateTreeManager.join(opts.parentId as string, opts.joinedFromId, captureInput);
  }
  return ctx.stateTreeManager.capture({ ...captureInput, parentId: opts.parentId ?? null });
}

export function registerStateTreeRoutes(router: Router, ctx: RouteContext): void {
  router.post('/state-tree/capture', async (req: Request, res: Response) => {
    try {
      const { taskId, label, parentId } = req.body as Record<string, unknown>;

      if (parentId !== undefined && typeof parentId !== 'string') {
        res.status(400).json({ error: 'parentId must be a string when provided' });
        return;
      }
      if (typeof parentId === 'string' && !ctx.stateTreeManager.get(parentId)) {
        res.status(404).json({ error: `State node ${parentId} not found` });
        return;
      }
      if (taskId !== undefined && typeof taskId !== 'string') {
        res.status(400).json({ error: 'taskId must be a string when provided' });
        return;
      }
      if (label !== undefined && typeof label !== 'string') {
        res.status(400).json({ error: 'label must be a string when provided' });
        return;
      }

      const node = await captureNode(ctx, req, {
        parentId: typeof parentId === 'string' ? parentId : null,
        taskId: typeof taskId === 'string' ? taskId : null,
        label: typeof label === 'string' ? label : undefined,
      });
      res.json(node);
    } catch (e) {
      handleRouteError(res, e);
    }
  });

  router.post('/state-tree/:id/fork', async (req: Request, res: Response) => {
    try {
      const parentId = req.params.id as string;
      const parent = ctx.stateTreeManager.get(parentId);
      if (!parent) {
        res.status(404).json({ error: 'State node not found' });
        return;
      }

      const { label } = req.body as Record<string, unknown>;
      if (label !== undefined && typeof label !== 'string') {
        res.status(400).json({ error: 'label must be a string when provided' });
        return;
      }

      const node = await captureNode(ctx, req, {
        parentId,
        taskId: parent.taskId,
        label: typeof label === 'string' ? label : undefined,
      });
      res.json(node);
    } catch (e) {
      handleRouteError(res, e);
    }
  });

  /** PMW JOIN operator — absorb :id's sibling branch `joinedFromId` back into it. */
  router.post('/state-tree/:id/join', async (req: Request, res: Response) => {
    try {
      const parentId = req.params.id as string;
      const parent = ctx.stateTreeManager.get(parentId);
      if (!parent) {
        res.status(404).json({ error: 'State node not found' });
        return;
      }

      const { joinedFromId, label } = req.body as Record<string, unknown>;
      if (typeof joinedFromId !== 'string' || !joinedFromId) {
        res.status(400).json({ error: 'joinedFromId is required' });
        return;
      }
      if (!ctx.stateTreeManager.get(joinedFromId)) {
        res.status(404).json({ error: `State node ${joinedFromId} not found` });
        return;
      }
      if (label !== undefined && typeof label !== 'string') {
        res.status(400).json({ error: 'label must be a string when provided' });
        return;
      }

      const node = await captureNode(ctx, req, {
        parentId,
        joinedFromId,
        taskId: parent.taskId,
        label: typeof label === 'string' ? label : undefined,
      });
      res.json(node);
    } catch (e) {
      handleRouteError(res, e);
    }
  });

  router.get('/state-tree', (req: Request, res: Response) => {
    try {
      const filters: StateTreeListFilters = {};
      if (typeof req.query.taskId === 'string') filters.taskId = req.query.taskId;
      if (typeof req.query.tabId === 'string') filters.tabId = req.query.tabId;
      if (req.query.rootsOnly === 'true') filters.rootsOnly = true;
      res.json(ctx.stateTreeManager.list(filters));
    } catch (e) {
      handleRouteError(res, e);
    }
  });

  router.get('/state-tree/compare', (req: Request, res: Response) => {
    try {
      const { a, b } = req.query;
      if (typeof a !== 'string' || typeof b !== 'string') {
        res.status(400).json({ error: 'query params a and b (state node IDs) are required' });
        return;
      }
      const result = ctx.stateTreeManager.compare(a, b);
      if (!result) {
        res.status(404).json({ error: 'One or both state nodes not found' });
        return;
      }
      res.json(result);
    } catch (e) {
      handleRouteError(res, e);
    }
  });

  router.get('/state-tree/:id', (req: Request, res: Response) => {
    try {
      const node = ctx.stateTreeManager.get(req.params.id as string);
      if (!node) {
        res.status(404).json({ error: 'State node not found' });
        return;
      }
      res.json(node);
    } catch (e) {
      handleRouteError(res, e);
    }
  });

  router.get('/state-tree/:id/screenshot', (req: Request, res: Response) => {
    try {
      const node = ctx.stateTreeManager.get(req.params.id as string);
      if (!node || !node.screenshotPath) {
        res.status(404).json({ error: 'No screenshot for this state node' });
        return;
      }
      if (!fs.existsSync(node.screenshotPath)) {
        res.status(404).json({ error: 'Screenshot file is missing on disk' });
        return;
      }
      res.type('png').send(fs.readFileSync(node.screenshotPath));
    } catch (e) {
      handleRouteError(res, e);
    }
  });

  router.get('/state-tree/:id/children', (req: Request, res: Response) => {
    try {
      res.json(ctx.stateTreeManager.children(req.params.id as string));
    } catch (e) {
      handleRouteError(res, e);
    }
  });

  router.delete('/state-tree/:id', (req: Request, res: Response) => {
    try {
      res.json({ ok: ctx.stateTreeManager.remove(req.params.id as string) });
    } catch (e) {
      handleRouteError(res, e);
    }
  });
}
