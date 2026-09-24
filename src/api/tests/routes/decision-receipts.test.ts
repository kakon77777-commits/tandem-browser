import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { registerDecisionReceiptRoutes } from '../../routes/decision-receipts';
import { createMockContext, createTestApp } from '../helpers';
import type { RouteContext } from '../../context';

describe('Decision Receipt Routes', () => {
  let ctx: RouteContext;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createMockContext();
    app = createTestApp(registerDecisionReceiptRoutes, ctx);
  });

  describe('GET /decision-receipts', () => {
    it('passes query filters through to the manager', async () => {
      const res = await request(app)
        .get('/decision-receipts')
        .query({ taskId: 'task-1', stepId: 'step-1', handoffId: 'handoff-1', decision: 'ACTION' });

      expect(res.status).toBe(200);
      expect(ctx.decisionReceiptManager.list).toHaveBeenCalledWith({
        taskId: 'task-1',
        stepId: 'step-1',
        handoffId: 'handoff-1',
        decision: 'ACTION',
      });
    });

    it('passes no filters when the query is empty', async () => {
      const res = await request(app).get('/decision-receipts');
      expect(res.status).toBe(200);
      expect(ctx.decisionReceiptManager.list).toHaveBeenCalledWith({});
    });
  });

  describe('GET /decision-receipts/:id', () => {
    it('returns 404 for an unknown receipt', async () => {
      const res = await request(app).get('/decision-receipts/missing');
      expect(res.status).toBe(404);
    });

    it('returns the receipt on success', async () => {
      vi.mocked(ctx.decisionReceiptManager.get).mockReturnValue({
        id: 'receipt-1', taskId: 'task-1', stepId: 'step-1', handoffId: 'handoff-1',
        actor: 'user', decision: 'ACTION', riskLevel: 'low', evidenceRefs: [], note: '', createdAt: 1,
      } as any);

      const res = await request(app).get('/decision-receipts/receipt-1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: 'receipt-1', taskId: 'task-1', stepId: 'step-1', handoffId: 'handoff-1',
        actor: 'user', decision: 'ACTION', riskLevel: 'low', evidenceRefs: [], note: '', createdAt: 1,
      });
    });
  });
});
