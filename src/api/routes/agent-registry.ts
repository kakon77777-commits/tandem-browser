import type { Request, Response, Router } from 'express';
import type { RouteContext } from '../context';
import { handleRouteError } from '../../utils/errors';

export function registerAgentRegistryRoutes(router: Router, ctx: RouteContext): void {
  router.get('/agents', (_req: Request, res: Response) => {
    try {
      res.json(ctx.agentRegistry.list());
    } catch (e) {
      handleRouteError(res, e);
    }
  });

  router.get('/agents/:id', (req: Request, res: Response) => {
    try {
      const agent = ctx.agentRegistry.get(req.params.id as string);
      if (!agent) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }
      res.json(agent);
    } catch (e) {
      handleRouteError(res, e);
    }
  });
}
