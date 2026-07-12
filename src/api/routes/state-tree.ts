import type { Request, Response, Router } from 'express';
import type { RouteContext } from '../context';
import { getSessionWC, resolveRequestedTab } from '../context';
import { handleRouteError } from '../../utils/errors';
import { saveStateScreenshot, truncateDomSummary } from '../../state-tree/capture';
import type { StateNode, StateTreeListFilters } from '../../state-tree/manager';

interface CaptureOptions {
  parentId?: string | null;
  taskId?: string | null;
  label?: string;
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
    const image = await wc.capturePage();
    screenshotPath = saveStateScreenshot(image.toPNG(), nodeFileId);
  } catch {
    // best-effort — a metadata-only (Level 0) node is still a valid capture
  }
  try {
    const snapshot = await ctx.snapshotManager.getSnapshot({ wcId, compact: true });
    domSummary = truncateDomSummary(snapshot.text);
  } catch {
    // best-effort
  }

  return ctx.stateTreeManager.capture({
    parentId: opts.parentId ?? null,
    taskId: opts.taskId ?? null,
    tabId: tab?.id ?? null,
    webContentsId: wcId,
    label: opts.label || tab?.title || 'snapshot',
    url: tab?.url ?? wc.getURL(),
    screenshotPath,
    domSummary,
  });
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
