import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'node:http';
import { once } from 'node:events';

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  app: { getVersion: () => '0.73.0' },
  session: {},
  webContents: {
    fromId: vi.fn(),
    getAllWebContents: vi.fn().mockReturnValue([]),
  },
}));

import { handleMcpRequest } from '../http-transport';

/**
 * Spin up a tiny HTTP server that wires each request through handleMcpRequest,
 * so the SDK's StreamableHTTPServerTransport gets real Node.js req/res objects.
 */
function createTestServer() {
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const rawBody = Buffer.concat(chunks).toString('utf-8');
    const body = rawBody ? JSON.parse(rawBody) : undefined;
    await handleMcpRequest(req, res, body);
  });
  return server;
}

async function startServer(server: http.Server): Promise<number> {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const addr = server.address() as { port: number };
  return addr.port;
}

async function mcpFetch(port: number, opts: {
  method?: string;
  body?: unknown;
}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: unknown; raw: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  };

  const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: opts.method ?? 'POST',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const raw = await res.text();
  let body: unknown;
  try { body = JSON.parse(raw); } catch {
    // SSE response — parse the event data
    const match = raw.match(/^data: (.+)$/m);
    body = match ? JSON.parse(match[1]) : raw;
  }
  return {
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    body,
    raw,
  };
}

function toolsListBody(id = 1) {
  return { jsonrpc: '2.0', id, method: 'tools/list', params: {} };
}

describe('handleMcpRequest (stateless, 2026-07-28 spec)', () => {
  let server: http.Server;
  let port: number;

  beforeEach(async () => {
    server = createTestServer();
    port = await startServer(server);
  });

  afterEach(async () => {
    server.close();
  });

  it('rejects GET with 405', async () => {
    const res = await mcpFetch(port, { method: 'GET' });
    expect(res.status).toBe(405);
  });

  it('rejects DELETE with 405', async () => {
    const res = await mcpFetch(port, { method: 'DELETE' });
    expect(res.status).toBe(405);
  });

  it('serves tools/list directly, with no prior initialize handshake', async () => {
    const res = await mcpFetch(port, { body: toolsListBody() });
    expect(res.status).toBe(200);
    const data = res.body as any;
    expect(data.result?.tools?.length).toBeGreaterThan(200);
  });

  it('never sets Mcp-Session-Id — stateless has no session', async () => {
    const res = await mcpFetch(port, { body: toolsListBody() });
    expect(res.headers['mcp-session-id']).toBeUndefined();
  });

  it('a legacy client that still sends initialize + notifications/initialized keeps working', async () => {
    const initRes = await mcpFetch(port, {
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'legacy-test-client', version: '1.0.0' },
        },
      },
    });
    expect(initRes.status).toBe(200);

    // Stateless server has no session to attach this to — a fresh request,
    // same as any other. The legacy client's notification is harmless noise.
    await mcpFetch(port, {
      body: { jsonrpc: '2.0', method: 'notifications/initialized' },
    });

    const toolsRes = await mcpFetch(port, { body: toolsListBody(2) });
    expect(toolsRes.status).toBe(200);
    const data = toolsRes.body as any;
    expect(data.result?.tools?.length).toBeGreaterThan(200);
  });

  it('handles two concurrent requests independently with no shared state leaking between them', async () => {
    const [a, b] = await Promise.all([
      mcpFetch(port, { body: toolsListBody(1) }),
      mcpFetch(port, { body: toolsListBody(2) }),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect((a.body as any).result?.tools?.length).toBeGreaterThan(200);
    expect((b.body as any).result?.tools?.length).toBeGreaterThan(200);
  });
});
