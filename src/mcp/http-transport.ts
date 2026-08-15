/**
 * HTTP MCP transport — Streamable HTTP MCP server for remote agents.
 *
 * Runs in-process inside the Express server. Stateless per the MCP
 * 2026-07-28 specification: no `initialize`/`initialized` handshake, no
 * `Mcp-Session-Id`. Each POST /mcp builds a fresh McpServer + transport,
 * handles exactly one request, and closes both when the response ends —
 * the same pattern the SDK's own reference example uses (see
 * node_modules/@modelcontextprotocol/sdk/.../examples/server/simpleStatelessStreamableHttp.js),
 * adapted to mount on Tandem's existing Express app instead of a fresh one.
 *
 * Auth is handled by the Express auth middleware before requests reach
 * this module — only already-authorized requests arrive here.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerAllTools, registerAllResources } from './register-all.js';
import { createLogger } from '../utils/logger';

const log = createLogger('McpHttpTransport');

function buildServer(): McpServer {
  const server = new McpServer({
    name: 'tandem-browser',
    version: '1.0.0',
  });
  registerAllTools(server);
  registerAllResources(server);
  return server;
}

function methodNotAllowed(res: ServerResponse): void {
  res.writeHead(405, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed.' },
    id: null,
  }));
}

/** Handle an incoming MCP HTTP request. Only POST is meaningful (stateless — no GET/DELETE session lifecycle). */
export async function handleMcpRequest(req: IncomingMessage, res: ServerResponse, body?: unknown): Promise<void> {
  if (req.method !== 'POST') {
    methodNotAllowed(res);
    return;
  }

  const server = buildServer();
  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
  } catch (e) {
    log.warn('MCP request handling error:', e instanceof Error ? e.message : e);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      }));
    }
  }
}
