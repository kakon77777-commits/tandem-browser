import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api-client.js', () => ({
  apiCall: vi.fn(),
  getMcpSource: vi.fn(() => 'wingman'),
  logActivity: vi.fn(),
  tabHeaders: vi.fn((tabId?: string) => (tabId ? { 'X-Tab-Id': tabId } : undefined)),
}));

vi.mock('../coerce.js', async (importOriginal) => importOriginal());

import { apiCall, logActivity } from '../api-client.js';
import { registerStateTreeTools } from '../tools/state-tree.js';
import { createMockServer, expectTextContent, getHandler } from './mcp-test-helper.js';

const mockApiCall = vi.mocked(apiCall);
const mockLogActivity = vi.mocked(logActivity);

describe('MCP state-tree tools', () => {
  const { server, tools } = createMockServer();
  registerStateTreeTools(server);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('captures a root snapshot', async () => {
    const handler = getHandler(tools, 'tandem_state_capture');
    mockApiCall.mockResolvedValueOnce({ id: 'state-1', parentId: null });
    mockLogActivity.mockResolvedValueOnce(undefined);

    const result = await handler({ taskId: 'task-1', label: 'before fix' });

    expectTextContent(result, 'state-1');
    expect(mockApiCall).toHaveBeenCalledWith(
      'POST',
      '/state-tree/capture',
      { taskId: 'task-1', label: 'before fix', parentId: undefined },
      undefined,
    );
    expect(mockLogActivity).toHaveBeenCalledWith('state_capture', 'state-1');
  });

  it('captures with a tabId, passing X-Tab-Id headers', async () => {
    const handler = getHandler(tools, 'tandem_state_capture');
    mockApiCall.mockResolvedValueOnce({ id: 'state-2' });

    await handler({ tabId: 'tab-9' });

    expect(mockApiCall).toHaveBeenCalledWith('POST', '/state-tree/capture', expect.anything(), { 'X-Tab-Id': 'tab-9' });
  });

  it('forks from an existing node', async () => {
    const handler = getHandler(tools, 'tandem_state_fork');
    mockApiCall.mockResolvedValueOnce({ id: 'state-2', parentId: 'state-1' });
    mockLogActivity.mockResolvedValueOnce(undefined);

    const result = await handler({ id: 'state-1', label: 'Agent A attempt' });

    expectTextContent(result, 'state-2');
    expect(mockApiCall).toHaveBeenCalledWith('POST', '/state-tree/state-1/fork', { label: 'Agent A attempt' }, undefined);
    expect(mockLogActivity).toHaveBeenCalledWith('state_fork', 'state-1 -> state-2');
  });

  it('lists nodes with filters as query params', async () => {
    const handler = getHandler(tools, 'tandem_state_list');
    mockApiCall.mockResolvedValueOnce([{ id: 'state-1' }]);

    await handler({ taskId: 'task-1', rootsOnly: true });

    expect(mockApiCall).toHaveBeenCalledWith('GET', '/state-tree?taskId=task-1&rootsOnly=true');
  });

  it('lists all nodes when no filters are given', async () => {
    const handler = getHandler(tools, 'tandem_state_list');
    mockApiCall.mockResolvedValueOnce([]);

    await handler({});

    expect(mockApiCall).toHaveBeenCalledWith('GET', '/state-tree');
  });

  it('gets a node by id', async () => {
    const handler = getHandler(tools, 'tandem_state_get');
    mockApiCall.mockResolvedValueOnce({ id: 'state-1' });

    const result = await handler({ id: 'state-1' });

    expectTextContent(result, 'state-1');
    expect(mockApiCall).toHaveBeenCalledWith('GET', '/state-tree/state-1');
  });

  it('lists children of a node', async () => {
    const handler = getHandler(tools, 'tandem_state_children');
    mockApiCall.mockResolvedValueOnce([{ id: 'state-2', parentId: 'state-1' }]);

    const result = await handler({ id: 'state-1' });

    expectTextContent(result, 'state-2');
    expect(mockApiCall).toHaveBeenCalledWith('GET', '/state-tree/state-1/children');
  });

  it('compares two nodes', async () => {
    const handler = getHandler(tools, 'tandem_state_compare');
    mockApiCall.mockResolvedValueOnce({ a: { id: 'state-1' }, b: { id: 'state-2' } });

    const result = await handler({ a: 'state-1', b: 'state-2' });

    expectTextContent(result, 'state-1');
    expect(mockApiCall).toHaveBeenCalledWith('GET', '/state-tree/compare?a=state-1&b=state-2');
  });
});
