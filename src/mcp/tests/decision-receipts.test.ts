import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api-client.js', () => ({
  apiCall: vi.fn(),
  getMcpSource: vi.fn(() => 'wingman'),
  logActivity: vi.fn(),
}));

vi.mock('../coerce.js', async (importOriginal) => importOriginal());

import { apiCall } from '../api-client.js';
import { registerDecisionReceiptTools } from '../tools/decision-receipts.js';
import { createMockServer, expectTextContent, getHandler } from './mcp-test-helper.js';

const mockApiCall = vi.mocked(apiCall);

describe('MCP decision receipt tools', () => {
  const { server, tools } = createMockServer();
  registerDecisionReceiptTools(server);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists decision receipts with filters as query params', async () => {
    const handler = getHandler(tools, 'tandem_decision_receipts_list');
    mockApiCall.mockResolvedValueOnce([{ id: 'receipt-1' }]);

    const result = await handler({ taskId: 'task-1', stepId: 'step-1', handoffId: 'handoff-1', decision: 'ACTION' });

    expectTextContent(result, 'receipt-1');
    expect(mockApiCall).toHaveBeenCalledWith('GET', '/decision-receipts?taskId=task-1&stepId=step-1&handoffId=handoff-1&decision=ACTION');
  });

  it('lists all decision receipts when no filters are given', async () => {
    const handler = getHandler(tools, 'tandem_decision_receipts_list');
    mockApiCall.mockResolvedValueOnce([]);

    await handler({});

    expect(mockApiCall).toHaveBeenCalledWith('GET', '/decision-receipts');
  });

  it('gets a single decision receipt by id', async () => {
    const handler = getHandler(tools, 'tandem_decision_receipt_get');
    mockApiCall.mockResolvedValueOnce({ id: 'receipt-1', decision: 'ACTION' });

    const result = await handler({ id: 'receipt-1' });

    expectTextContent(result, 'receipt-1');
    expect(mockApiCall).toHaveBeenCalledWith('GET', '/decision-receipts/receipt-1');
  });
});
