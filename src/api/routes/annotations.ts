import type { Request, Response, Router } from 'express';
import type { RouteContext } from '../context';
import { handleRouteError } from '../../utils/errors';
import { resolveDomAtRegion } from '../../annotations/dom-resolver';
import type { AnnotationListFilters, AnnotationRegion } from '../../annotations/manager';
import { isScope as isAnnotationScope } from '../../utils/scope';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseRegion(raw: unknown): AnnotationRegion | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<AnnotationRegion>;
  if (!isFiniteNumber(r.x) || !isFiniteNumber(r.y) || !isFiniteNumber(r.width) || !isFiniteNumber(r.height)) {
    return null;
  }
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}

export function registerAnnotationRoutes(router: Router, ctx: RouteContext): void {
  router.get('/annotations', (req: Request, res: Response) => {
    try {
      const filters: AnnotationListFilters = {};
      if (typeof req.query.taskId === 'string') filters.taskId = req.query.taskId;
      if (typeof req.query.tabId === 'string') filters.tabId = req.query.tabId;
      if (req.query.resolved === 'true') filters.resolvedOnly = true;
      if (req.query.resolved === 'false') filters.unresolvedOnly = true;
      res.json(ctx.annotationManager.list(filters));
    } catch (e) {
      handleRouteError(res, e);
    }
  });

  router.get('/annotations/:id', (req: Request, res: Response) => {
    try {
      const annotation = ctx.annotationManager.get(req.params.id as string);
      if (!annotation) {
        res.status(404).json({ error: 'Annotation not found' });
        return;
      }
      res.json(annotation);
    } catch (e) {
      handleRouteError(res, e);
    }
  });

  router.post('/annotations', async (req: Request, res: Response) => {
    try {
      const { taskId, tabId, region: rawRegion, message, scope, ownerAgent } = req.body as Record<string, unknown>;

      const region = parseRegion(rawRegion);
      if (!region) {
        res.status(400).json({ error: 'region ({x, y, width, height} numbers) is required' });
        return;
      }
      if (taskId !== undefined && typeof taskId !== 'string') {
        res.status(400).json({ error: 'taskId must be a string when provided' });
        return;
      }
      if (message !== undefined && typeof message !== 'string') {
        res.status(400).json({ error: 'message must be a string when provided' });
        return;
      }
      if (scope !== undefined && !isAnnotationScope(scope)) {
        res.status(400).json({ error: 'scope must be "PRIVATE" or "SHARED" when provided' });
        return;
      }
      if (ownerAgent !== undefined && typeof ownerAgent !== 'string') {
        res.status(400).json({ error: 'ownerAgent must be a string when provided' });
        return;
      }

      let tab = null;
      if (tabId !== undefined) {
        if (typeof tabId !== 'string') {
          res.status(400).json({ error: 'tabId must be a string when provided' });
          return;
        }
        tab = ctx.tabManager.listTabs().find((candidate) => candidate.id === tabId) ?? null;
        if (!tab) {
          res.status(404).json({ error: `Tab ${tabId} not found` });
          return;
        }
      }

      const dom = tab
        ? await resolveDomAtRegion(ctx.devToolsManager, ctx.snapshotManager, tab.webContentsId, region)
        : null;

      const annotation = ctx.annotationManager.create({
        taskId: typeof taskId === 'string' ? taskId : null,
        tabId: tab?.id ?? null,
        webContentsId: tab?.webContentsId ?? null,
        url: tab?.url ?? null,
        region,
        dom,
        message: typeof message === 'string' ? message : '',
        scope: isAnnotationScope(scope) ? scope : undefined,
        ownerAgent: typeof ownerAgent === 'string' ? ownerAgent : null,
      });

      res.json(annotation);
    } catch (e) {
      handleRouteError(res, e);
    }
  });

  router.post('/annotations/:id/resolve', (req: Request, res: Response) => {
    try {
      const annotation = ctx.annotationManager.resolve(req.params.id as string);
      if (!annotation) {
        res.status(404).json({ error: 'Annotation not found' });
        return;
      }
      res.json(annotation);
    } catch (e) {
      handleRouteError(res, e);
    }
  });

  /** PMW SHARE operator — promote a PRIVATE annotation to SHARED. */
  router.post('/annotations/:id/promote', (req: Request, res: Response) => {
    try {
      const annotation = ctx.annotationManager.promote(req.params.id as string);
      res.json(annotation);
    } catch (e) {
      if (e instanceof Error && e.message.includes('not found')) {
        res.status(404).json({ error: 'Annotation not found' });
        return;
      }
      handleRouteError(res, e);
    }
  });

  router.delete('/annotations/:id', (req: Request, res: Response) => {
    try {
      const removed = ctx.annotationManager.remove(req.params.id as string);
      res.json({ ok: removed });
    } catch (e) {
      handleRouteError(res, e);
    }
  });
}
