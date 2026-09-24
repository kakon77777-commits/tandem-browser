import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api-client.js', () => ({
  apiCall: vi.fn(),
  getMcpSource: vi.fn(() => 'wingman'),
  logActivity: vi.fn(),
}));

vi.mock('../coerce.js', async (importOriginal) => importOriginal());

import { apiCall } from '../api-client.js';
import { registerAgentRegistryTools } from '../tools/agent-registry.js';
import { createMockServer, expectTextContent, getHandler } from './mcp-test-helper.js';

const mockApiCall = vi.mocked(apiCall);

describe('MCP agent registry tools', () => {
  const { server, tools } = createMockServer();
  registerAgentRegistryTools(server);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists agents', async () => {
    const handler = getHandler(tools, 'tandem_agents_list');
    mockApiCall.mockResolvedValueOnce([{ id: 'claude', kind: 'ai' }]);

    const result = await handler({});

    expectTextContent(result, 'claude');
    expect(mockApiCall).toHaveBeenCalledWith('GET', '/agents');
  });

  it('gets a single agent by id', async () => {
    const handler = getHandler(tools, 'tandem_agent_get');
    mockApiCall.mockResolvedValueOnce({ id: 'claude', kind: 'ai' });

    const result = await handler({ id: 'claude' });

    expectTextContent(result, 'claude');
    expect(mockApiCall).toHaveBeenCalledWith('GET', '/agents/claude');
  });
});
