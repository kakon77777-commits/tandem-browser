import type { Request, Response, Router } from 'express';
import type { RouteContext } from '../context';
import { handleRouteError } from '../../utils/errors';
import type { DecisionReceiptListFilters } from '../../agents/decision-receipts';

export function registerDecisionReceiptRoutes(router: Router, ctx: RouteContext): void {
  router.get('/decision-receipts', (req: Request, res: Response) => {
    try {
      const filters: DecisionReceiptListFilters = {};
      if (typeof req.query.taskId === 'string') filters.taskId = req.query.taskId;
      if (typeof req.query.stepId === 'string') filters.stepId = req.query.stepId;
      if (typeof req.query.handoffId === 'string') filters.handoffId = req.query.handoffId;
      if (typeof req.query.decision === 'string') filters.decision = req.query.decision as DecisionReceiptListFilters['decision'];
      res.json(ctx.decisionReceiptManager.list(filters));
    } catch (e) {
      handleRouteError(res, e);
    }
  });

  router.get('/decision-receipts/:id', (req: Request, res: Response) => {
    try {
      const receipt = ctx.decisionReceiptManager.get(req.params.id as string);
      if (!receipt) {
        res.status(404).json({ error: 'Decision receipt not found' });
        return;
      }
      res.json(receipt);
    } catch (e) {
      handleRouteError(res, e);
    }
  });
}
