import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall } from '../api-client.js';
import { coerceShape } from '../coerce.js';

export function registerDecisionReceiptTools(server: McpServer): void {
  server.tool(
    'tandem_decision_receipts_list',
    'List decision receipts (PMW invariant I6 — the append-only log of real human/agent decisions), ' +
    'optionally filtered by task, step, handoff, or decision type. Receipts are recorded automatically ' +
    'when a human responds to an agent approval request; there is no manual create.',
    coerceShape({
      taskId: z.string().optional().describe('Filter to a specific task'),
      stepId: z.string().optional().describe('Filter to a specific step'),
      handoffId: z.string().optional().describe('Filter to a specific handoff'),
      decision: z.enum(['ACK', 'NO_ACTION', 'ACTION', 'ERROR']).optional().describe('Filter to a specific decision type'),
    }),
    async ({ taskId, stepId, handoffId, decision }) => {
      const params = new URLSearchParams();
      if (taskId) params.set('taskId', taskId);
      if (stepId) params.set('stepId', stepId);
      if (handoffId) params.set('handoffId', handoffId);
      if (decision) params.set('decision', decision);
      const qs = params.toString();
      const data = await apiCall('GET', qs ? `/decision-receipts?${qs}` : '/decision-receipts');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_decision_receipt_get',
    'Get a specific decision receipt by ID.',
    { id: z.string().describe('Decision receipt ID') },
    async ({ id }) => {
      const data = await apiCall('GET', `/decision-receipts/${encodeURIComponent(id)}`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );
}
