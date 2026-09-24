import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall } from '../api-client.js';

export function registerAgentRegistryTools(server: McpServer): void {
  server.tool(
    'tandem_agents_list',
    'List every distinct human/AI actor Tandem has seen (tab locks, approvals, etc.), sorted by most recently active.',
    async () => {
      const data = await apiCall('GET', '/agents');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_agent_get',
    'Get a specific agent identity record by ID.',
    { id: z.string().describe('Agent ID') },
    async ({ id }) => {
      const data = await apiCall('GET', `/agents/${encodeURIComponent(id)}`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );
}
