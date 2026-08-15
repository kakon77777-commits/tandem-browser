import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { registerAgentRegistryRoutes } from '../../routes/agent-registry';
import { createMockContext, createTestApp } from '../helpers';
import type { RouteContext } from '../../context';

describe('Agent Registry Routes', () => {
  let ctx: RouteContext;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createMockContext();
    app = createTestApp(registerAgentRegistryRoutes, ctx);
  });

  describe('GET /agents', () => {
    it('returns the registry list', async () => {
      vi.mocked(ctx.agentRegistry.list).mockReturnValue([
        { id: 'claude', kind: 'ai', firstSeenAt: 1, lastSeenAt: 2 },
      ] as any);

      const res = await request(app).get('/agents');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: 'claude', kind: 'ai', firstSeenAt: 1, lastSeenAt: 2 }]);
    });
  });

  describe('GET /agents/:id', () => {
    it('returns 404 for an unknown agent', async () => {
      const res = await request(app).get('/agents/missing');
      expect(res.status).toBe(404);
    });

    it('returns the agent on success', async () => {
      vi.mocked(ctx.agentRegistry.get).mockReturnValue({
        id: 'claude', kind: 'ai', firstSeenAt: 1, lastSeenAt: 2,
      } as any);

      const res = await request(app).get('/agents/claude');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 'claude', kind: 'ai', firstSeenAt: 1, lastSeenAt: 2 });
    });
  });
});
