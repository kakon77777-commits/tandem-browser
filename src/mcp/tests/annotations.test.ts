import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api-client.js', () => ({
  apiCall: vi.fn(),
  getMcpSource: vi.fn(() => 'wingman'),
  logActivity: vi.fn(),
}));

vi.mock('../coerce.js', async (importOriginal) => importOriginal());

import { apiCall, logActivity } from '../api-client.js';
import { registerAnnotationTools } from '../tools/annotations.js';
import { createMockServer, expectTextContent, getHandler } from './mcp-test-helper.js';

const mockApiCall = vi.mocked(apiCall);
const mockLogActivity = vi.mocked(logActivity);

describe('MCP annotation tools', () => {
  const { server, tools } = createMockServer();
  registerAnnotationTools(server);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an annotation from a pixel region and reports the resolved DOM ref', async () => {
    const handler = getHandler(tools, 'tandem_annotate');
    mockApiCall.mockResolvedValueOnce({ id: 'ann-1', dom: { ref: '@e5', tagName: 'DIV' } });
    mockLogActivity.mockResolvedValueOnce(undefined);

    const result = await handler({
      tabId: 'tab-1',
      x: 80,
      y: 140,
      width: 220,
      height: 90,
      message: '這裡太擠',
      taskId: 'task-1',
    });

    expectTextContent(result, 'ann-1');
    expect(mockApiCall).toHaveBeenCalledWith('POST', '/annotations', {
      tabId: 'tab-1',
      region: { x: 80, y: 140, width: 220, height: 90 },
      message: '這裡太擠',
      taskId: 'task-1',
    });
    expect(mockLogActivity).toHaveBeenCalledWith('annotate', expect.stringContaining('@e5'));
  });

  it('notes when no DOM element was matched', async () => {
    const handler = getHandler(tools, 'tandem_annotate');
    mockApiCall.mockResolvedValueOnce({ id: 'ann-2', dom: null });

    await handler({ tabId: 'tab-1', x: 0, y: 0, width: 1, height: 1 });

    expect(mockLogActivity).toHaveBeenCalledWith('annotate', expect.stringContaining('no DOM match'));
  });

  it('lists annotations with filters as query params', async () => {
    const handler = getHandler(tools, 'tandem_annotations_list');
    mockApiCall.mockResolvedValueOnce([{ id: 'ann-1' }]);

    const result = await handler({ taskId: 'task-1', resolved: false });

    expectTextContent(result, 'ann-1');
    expect(mockApiCall).toHaveBeenCalledWith('GET', '/annotations?taskId=task-1&resolved=false');
  });

  it('lists all annotations when no filters are given', async () => {
    const handler = getHandler(tools, 'tandem_annotations_list');
    mockApiCall.mockResolvedValueOnce([]);

    await handler({});

    expect(mockApiCall).toHaveBeenCalledWith('GET', '/annotations');
  });

  it('gets a single annotation by id', async () => {
    const handler = getHandler(tools, 'tandem_annotation_get');
    mockApiCall.mockResolvedValueOnce({ id: 'ann-1' });

    const result = await handler({ id: 'ann-1' });

    expectTextContent(result, 'ann-1');
    expect(mockApiCall).toHaveBeenCalledWith('GET', '/annotations/ann-1');
  });

  it('resolves an annotation', async () => {
    const handler = getHandler(tools, 'tandem_annotation_resolve');
    mockApiCall.mockResolvedValueOnce({ id: 'ann-1', resolvedAt: 123 });
    mockLogActivity.mockResolvedValueOnce(undefined);

    const result = await handler({ id: 'ann-1' });

    expectTextContent(result, 'resolvedAt');
    expect(mockApiCall).toHaveBeenCalledWith('POST', '/annotations/ann-1/resolve');
    expect(mockLogActivity).toHaveBeenCalledWith('annotation_resolve', 'ann-1');
  });
});
