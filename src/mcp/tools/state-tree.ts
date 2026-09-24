import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall, logActivity, tabHeaders } from '../api-client.js';
import { coerceShape } from '../coerce.js';

export function registerStateTreeTools(server: McpServer): void {
  server.tool(
    'tandem_state_capture',
    'Capture the current tab as a node in the branching Browser State Tree (screenshot + compact DOM ' +
    'summary, best-effort). Unlike linear back/forward history, nodes form a tree via parentId so ' +
    'alternative attempts can branch instead of overwriting each other. Pass parentId to attach this ' +
    'capture under an earlier node instead of starting a new root.',
    coerceShape({
      tabId: z.string().optional().describe('Tab ID to capture (defaults to the active tab)'),
      taskId: z.string().optional().describe('Task ID this snapshot belongs to'),
      label: z.string().optional().describe('Human-readable label, e.g. "before fix" or "Agent A attempt"'),
      parentId: z.string().optional().describe('Existing state node ID to attach this capture under'),
    }),
    async ({ tabId, taskId, label, parentId }) => {
      const node = await apiCall('POST', '/state-tree/capture', { taskId, label, parentId }, tabHeaders(tabId));
      await logActivity('state_capture', `${node?.id ?? ''}${parentId ? ` (child of ${parentId})` : ''}`);
      return { content: [{ type: 'text', text: JSON.stringify(node, null, 2) }] };
    }
  );

  server.tool(
    'tandem_state_fork',
    'Branch off an existing Browser State Tree node: re-observes the current tab and records it as a ' +
    'child of the given node. Does NOT roll the browser back to that node\'s historical state (no full ' +
    'runtime restore) — use this to mark "starting a new attempt from here", not to time-travel.',
    coerceShape({
      id: z.string().describe('The state node ID to fork from'),
      tabId: z.string().optional().describe('Tab ID to capture (defaults to the active tab)'),
      label: z.string().optional().describe('Label for the new branch, e.g. "Agent B alternative layout"'),
    }),
    async ({ id, tabId, label }) => {
      const node = await apiCall('POST', `/state-tree/${encodeURIComponent(id)}/fork`, { label }, tabHeaders(tabId));
      await logActivity('state_fork', `${id} -> ${node?.id ?? ''}`);
      return { content: [{ type: 'text', text: JSON.stringify(node, null, 2) }] };
    }
  );

  server.tool(
    'tandem_state_join',
    'PMW JOIN operator: absorb another branch back into this one. Like tandem_state_fork, this re-observes ' +
    'the current tab right now and records a new node — it does NOT algorithmically merge the two branches\' ' +
    'stored content, so reconcile them on the live page yourself first. The new node is reachable as a ' +
    'child from BOTH the branch it continues (id) and the branch it absorbs (joinedFromId).',
    coerceShape({
      id: z.string().describe('The state node ID to join into (becomes the new node\'s primary parent)'),
      joinedFromId: z.string().describe('The other branch\'s state node ID being absorbed'),
      tabId: z.string().optional().describe('Tab ID to capture (defaults to the active tab)'),
      label: z.string().optional().describe('Label for the joined node, e.g. "reconciled layout"'),
    }),
    async ({ id, joinedFromId, tabId, label }) => {
      const node = await apiCall('POST', `/state-tree/${encodeURIComponent(id)}/join`, { joinedFromId, label }, tabHeaders(tabId));
      await logActivity('state_join', `${id} + ${joinedFromId} -> ${node?.id ?? ''}`);
      return { content: [{ type: 'text', text: JSON.stringify(node, null, 2) }] };
    }
  );

  server.tool(
    'tandem_state_list',
    'List Browser State Tree nodes, optionally filtered by task or tab, or roots only.',
    coerceShape({
      taskId: z.string().optional().describe('Filter to a specific task'),
      tabId: z.string().optional().describe('Filter to a specific tab'),
      rootsOnly: z.boolean().optional().describe('Only return nodes with no parent'),
    }),
    async ({ taskId, tabId, rootsOnly }) => {
      const params = new URLSearchParams();
      if (taskId) params.set('taskId', taskId);
      if (tabId) params.set('tabId', tabId);
      if (rootsOnly) params.set('rootsOnly', 'true');
      const qs = params.toString();
      const data = await apiCall('GET', qs ? `/state-tree?${qs}` : '/state-tree');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_state_get',
    'Get a specific Browser State Tree node by ID.',
    { id: z.string().describe('State node ID') },
    async ({ id }) => {
      const data = await apiCall('GET', `/state-tree/${encodeURIComponent(id)}`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_state_children',
    'List the direct children (branches) of a Browser State Tree node.',
    { id: z.string().describe('State node ID') },
    async ({ id }) => {
      const data = await apiCall('GET', `/state-tree/${encodeURIComponent(id)}/children`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_state_compare',
    'Compare two Browser State Tree nodes side by side (labels, URLs, screenshot paths, DOM summaries) ' +
    'so a human or agent can judge which branch is better — e.g. "the second one is better than the third".',
    {
      a: z.string().describe('First state node ID'),
      b: z.string().describe('Second state node ID'),
    },
    async ({ a, b }) => {
      const params = new URLSearchParams({ a, b });
      const data = await apiCall('GET', `/state-tree/compare?${params.toString()}`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );
}
