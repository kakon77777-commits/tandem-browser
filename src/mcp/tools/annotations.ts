import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall, logActivity } from '../api-client.js';
import { coerceShape } from '../coerce.js';

export function registerAnnotationTools(server: McpServer): void {
  server.tool(
    'tandem_annotate',
    'Create a Human Annotation binding a pixel region on a tab to a best-effort DOM element ref, an ' +
    'optional task (goal context), and a message. Use this instead of vague text ("this button", "here") ' +
    'when the user points at something specific — it resolves to a stable, clickable @ref where possible.',
    coerceShape({
      tabId: z.string().describe('The Tandem tab ID the region is on'),
      x: z.number().describe('Region x (pixels from the left of the viewport)'),
      y: z.number().describe('Region y (pixels from the top of the viewport)'),
      width: z.number().describe('Region width in pixels'),
      height: z.number().describe('Region height in pixels'),
      message: z.string().optional().describe('Human message describing what is annotated'),
      taskId: z.string().optional().describe('Task ID this annotation serves as goal context'),
    }),
    async ({ tabId, x, y, width, height, message, taskId }) => {
      const annotation = await apiCall('POST', '/annotations', {
        tabId,
        region: { x, y, width, height },
        message,
        taskId,
      });
      await logActivity('annotate', `${tabId}${annotation?.dom?.ref ? ` -> ${annotation.dom.ref}` : ' (no DOM match)'}`);
      return { content: [{ type: 'text', text: JSON.stringify(annotation, null, 2) }] };
    }
  );

  server.tool(
    'tandem_annotations_list',
    'List Human Annotations, optionally filtered by task or tab.',
    coerceShape({
      taskId: z.string().optional().describe('Filter to a specific task'),
      tabId: z.string().optional().describe('Filter to a specific tab'),
      resolved: z.boolean().optional().describe('Filter to resolved (true) or unresolved (false) annotations only'),
    }),
    async ({ taskId, tabId, resolved }) => {
      const params = new URLSearchParams();
      if (taskId) params.set('taskId', taskId);
      if (tabId) params.set('tabId', tabId);
      if (resolved !== undefined) params.set('resolved', String(resolved));
      const qs = params.toString();
      const data = await apiCall('GET', qs ? `/annotations?${qs}` : '/annotations');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_annotation_get',
    'Get a specific Human Annotation by ID.',
    { id: z.string().describe('Annotation ID') },
    async ({ id }) => {
      const data = await apiCall('GET', `/annotations/${encodeURIComponent(id)}`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_annotation_resolve',
    'Mark a Human Annotation as resolved once it has been addressed.',
    { id: z.string().describe('Annotation ID') },
    async ({ id }) => {
      const data = await apiCall('POST', `/annotations/${encodeURIComponent(id)}/resolve`);
      await logActivity('annotation_resolve', id);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );
}
