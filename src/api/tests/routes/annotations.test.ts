import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { registerAnnotationRoutes } from '../../routes/annotations';
import { createMockContext, createTestApp } from '../helpers';
import type { RouteContext } from '../../context';

describe('Annotation Routes', () => {
  let ctx: RouteContext;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createMockContext();
    app = createTestApp(registerAnnotationRoutes, ctx);
  });

  describe('POST /annotations', () => {
    it('requires a region', async () => {
      const res = await request(app).post('/annotations').send({ message: 'hi' });
      expect(res.status).toBe(400);
    });

    it('creates a pixel-only annotation when no tabId is given', async () => {
      const res = await request(app)
        .post('/annotations')
        .send({ region: { x: 1, y: 2, width: 3, height: 4 }, message: '這裡太擠', taskId: 'task-1' });

      expect(res.status).toBe(200);
      expect(ctx.annotationManager.create).toHaveBeenCalledWith({
        taskId: 'task-1',
        tabId: null,
        webContentsId: null,
        url: null,
        region: { x: 1, y: 2, width: 3, height: 4 },
        dom: null,
        message: '這裡太擠',
        scope: undefined,
        ownerAgent: null,
      });
    });

    it('returns 404 when tabId does not match any known tab', async () => {
      vi.mocked(ctx.tabManager.listTabs).mockReturnValue([]);

      const res = await request(app)
        .post('/annotations')
        .send({ tabId: 'ghost', region: { x: 0, y: 0, width: 1, height: 1 } });

      expect(res.status).toBe(404);
    });

    it('resolves a DOM ref via CDP when the region is on a known tab', async () => {
      vi.mocked(ctx.tabManager.listTabs).mockReturnValue([
        { id: 'tab-1', webContentsId: 7, url: 'https://example.com', title: 'Example' },
      ] as any);
      vi.mocked(ctx.devToolsManager.sendCommandToTab)
        .mockResolvedValueOnce({}) // DOM.enable
        .mockResolvedValueOnce({ backendNodeId: 42 }) // DOM.getNodeForLocation
        .mockResolvedValueOnce({ node: { nodeName: 'DIV' } }); // DOM.describeNode

      const res = await request(app)
        .post('/annotations')
        .send({ tabId: 'tab-1', region: { x: 80, y: 140, width: 220, height: 90 }, message: 'too tight' });

      expect(res.status).toBe(200);
      expect(ctx.snapshotManager.registerBackendNodeId).toHaveBeenCalledWith(42, 7);
      expect(ctx.annotationManager.create).toHaveBeenCalledWith(expect.objectContaining({
        tabId: 'tab-1',
        webContentsId: 7,
        url: 'https://example.com',
        dom: { ref: '@e1', tagName: 'DIV' },
      }));
    });
  });

  describe('GET /annotations', () => {
    it('passes query filters through to the manager', async () => {
      const res = await request(app).get('/annotations').query({ taskId: 'task-1', tabId: 'tab-1', resolved: 'false' });

      expect(res.status).toBe(200);
      expect(ctx.annotationManager.list).toHaveBeenCalledWith({
        taskId: 'task-1',
        tabId: 'tab-1',
        unresolvedOnly: true,
      });
    });
  });

  describe('GET /annotations/:id', () => {
    it('returns 404 for an unknown annotation', async () => {
      const res = await request(app).get('/annotations/missing');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /annotations/:id/resolve', () => {
    it('returns 404 for an unknown annotation', async () => {
      const res = await request(app).post('/annotations/missing/resolve');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /annotations/:id/promote', () => {
    it('returns 404 for an unknown annotation', async () => {
      const res = await request(app).post('/annotations/missing/promote');
      expect(res.status).toBe(404);
    });

    it('returns 409 when the annotation is already SHARED', async () => {
      vi.mocked(ctx.annotationManager.promote).mockImplementation(() => {
        throw Object.assign(new Error('Cannot promote annotation ann-1 from scope "SHARED" (already shared)'), { name: 'InvalidScopePromotionError' });
      });

      const res = await request(app).post('/annotations/ann-1/promote');
      expect(res.status).toBe(409);
    });

    it('returns the promoted annotation on success', async () => {
      vi.mocked(ctx.annotationManager.promote).mockReturnValue({
        id: 'ann-1', scope: 'SHARED', version: 2,
      } as any);

      const res = await request(app).post('/annotations/ann-1/promote');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 'ann-1', scope: 'SHARED', version: 2 });
    });
  });

  describe('DELETE /annotations/:id', () => {
    it('returns ok:false when nothing was removed', async () => {
      const res = await request(app).delete('/annotations/missing');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: false });
    });
  });
});
