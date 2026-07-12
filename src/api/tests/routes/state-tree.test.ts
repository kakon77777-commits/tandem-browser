import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  session: {},
  webContents: {
    fromId: vi.fn(),
    getAllWebContents: vi.fn().mockReturnValue([]),
  },
}));

// The route calls saveStateScreenshot() -> fs.writeFileSync() for real unless
// mocked; without this, every test run would write throwaway PNGs into the
// user's actual ~/.tandem/state-tree-screenshots/ directory (see browser.test.ts
// and media.test.ts for the same convention around screenshot-writing routes).
vi.mock('fs', () => ({
  default: {
    writeFileSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
  },
  writeFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
}));

import { registerStateTreeRoutes } from '../../routes/state-tree';
import { createMockContext, createTestApp } from '../helpers';
import type { RouteContext } from '../../context';

describe('State Tree Routes', () => {
  let ctx: RouteContext;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createMockContext();
    app = createTestApp(registerStateTreeRoutes, ctx);
  });

  describe('POST /state-tree/capture', () => {
    it('captures the active tab: screenshot + DOM summary + tab metadata', async () => {
      vi.mocked(ctx.snapshotManager.getSnapshot).mockResolvedValueOnce({ text: 'heading "Example"', count: 3, url: 'https://example.com' });

      const res = await request(app).post('/state-tree/capture').send({ taskId: 'task-1', label: 'before fix' });

      expect(res.status).toBe(200);
      expect(ctx.stateTreeManager.capture).toHaveBeenCalledWith(expect.objectContaining({
        parentId: null,
        taskId: 'task-1',
        tabId: 'tab-1',
        webContentsId: 100,
        label: 'before fix',
        url: 'https://example.com',
        domSummary: 'heading "Example"',
      }));
      expect(ctx.stateTreeManager.capture.mock.calls[0][0].screenshotPath).toEqual(expect.any(String));
    });

    it('defaults the label to the tab title when none is given', async () => {
      const res = await request(app).post('/state-tree/capture').send({});
      expect(res.status).toBe(200);
      expect(ctx.stateTreeManager.capture).toHaveBeenCalledWith(expect.objectContaining({ label: 'Example' }));
    });

    it('rejects a non-existent parentId with 404', async () => {
      vi.mocked(ctx.stateTreeManager.get).mockReturnValueOnce(null);
      const res = await request(app).post('/state-tree/capture').send({ parentId: 'ghost' });
      expect(res.status).toBe(404);
    });

    it('rejects a non-string parentId with 400', async () => {
      const res = await request(app).post('/state-tree/capture').send({ parentId: 42 });
      expect(res.status).toBe(400);
    });

    it('still returns a node when the screenshot or snapshot capture fails (best-effort)', async () => {
      vi.mocked(ctx.win.webContents.capturePage).mockRejectedValueOnce(new Error('capture failed'));
      vi.mocked(ctx.snapshotManager.getSnapshot).mockRejectedValueOnce(new Error('no attached debugger'));

      const res = await request(app).post('/state-tree/capture').send({});

      expect(res.status).toBe(200);
      expect(ctx.stateTreeManager.capture).toHaveBeenCalledWith(expect.objectContaining({
        screenshotPath: null,
        domSummary: null,
      }));
    });
  });

  describe('POST /state-tree/:id/fork', () => {
    it('returns 404 when the parent node does not exist', async () => {
      vi.mocked(ctx.stateTreeManager.get).mockReturnValueOnce(null);
      const res = await request(app).post('/state-tree/ghost/fork').send({});
      expect(res.status).toBe(404);
    });

    it('forks from an existing node, inheriting its taskId', async () => {
      vi.mocked(ctx.stateTreeManager.get).mockReturnValueOnce({
        id: 'state-1', parentId: null, taskId: 'task-1', tabId: null, webContentsId: null,
        label: 'root', url: null, domSummary: null, screenshotPath: null, createdAt: 0,
      });

      const res = await request(app).post('/state-tree/state-1/fork').send({ label: 'Agent A attempt' });

      expect(res.status).toBe(200);
      expect(ctx.stateTreeManager.capture).toHaveBeenCalledWith(expect.objectContaining({
        parentId: 'state-1',
        taskId: 'task-1',
        label: 'Agent A attempt',
      }));
    });
  });

  describe('GET /state-tree', () => {
    it('passes filters through to the manager', async () => {
      const res = await request(app).get('/state-tree').query({ taskId: 'task-1', tabId: 'tab-1', rootsOnly: 'true' });
      expect(res.status).toBe(200);
      expect(ctx.stateTreeManager.list).toHaveBeenCalledWith({ taskId: 'task-1', tabId: 'tab-1', rootsOnly: true });
    });
  });

  describe('GET /state-tree/compare', () => {
    it('requires both a and b query params', async () => {
      const res = await request(app).get('/state-tree/compare').query({ a: 'state-1' });
      expect(res.status).toBe(400);
    });

    it('returns 404 when either node is missing', async () => {
      vi.mocked(ctx.stateTreeManager.compare).mockReturnValueOnce(null);
      const res = await request(app).get('/state-tree/compare').query({ a: 'state-1', b: 'state-2' });
      expect(res.status).toBe(404);
    });

    it('returns both nodes on success', async () => {
      const a = { id: 'state-1', parentId: null, taskId: null, tabId: null, webContentsId: null, label: 'A', url: null, domSummary: null, screenshotPath: null, createdAt: 0 };
      const b = { id: 'state-2', parentId: 'state-1', taskId: null, tabId: null, webContentsId: null, label: 'B', url: null, domSummary: null, screenshotPath: null, createdAt: 1 };
      vi.mocked(ctx.stateTreeManager.compare).mockReturnValueOnce({ a, b });

      const res = await request(app).get('/state-tree/compare').query({ a: 'state-1', b: 'state-2' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ a, b });
    });
  });

  describe('GET /state-tree/:id', () => {
    it('returns 404 for an unknown node', async () => {
      const res = await request(app).get('/state-tree/missing');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /state-tree/:id/children', () => {
    it('lists the children of a node', async () => {
      const res = await request(app).get('/state-tree/state-1/children');
      expect(res.status).toBe(200);
      expect(ctx.stateTreeManager.children).toHaveBeenCalledWith('state-1');
    });
  });

  describe('DELETE /state-tree/:id', () => {
    it('returns ok:false when nothing was removed', async () => {
      const res = await request(app).delete('/state-tree/missing');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: false });
    });
  });
});
