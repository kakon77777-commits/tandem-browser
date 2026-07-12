import type { DevToolsManager } from '../devtools/manager';
import type { SnapshotManager } from '../snapshot/manager';
import type { AnnotationDomTarget, AnnotationRegion } from './manager';

interface CDPGetNodeForLocationResponse {
  backendNodeId?: number;
}

interface CDPDescribeNodeResponse {
  node?: { nodeName?: string };
}

/**
 * Best-effort DOM resolution for an annotation's pixel region.
 *
 * Resolves the topmost element at the region's center via CDP
 * `DOM.getNodeForLocation`, then registers it with SnapshotManager so it
 * gets a stable `@ref` usable by the same click/fill tools snapshots use.
 * Returns null on any failure — a pixel-only annotation is still valid
 * (see §12 of the SRW whitepaper: the DOM candidate is optional).
 */
export async function resolveDomAtRegion(
  devtools: DevToolsManager,
  snapshotManager: SnapshotManager,
  wcId: number,
  region: AnnotationRegion,
): Promise<AnnotationDomTarget | null> {
  try {
    const centerX = Math.round(region.x + region.width / 2);
    const centerY = Math.round(region.y + region.height / 2);

    await devtools.sendCommandToTab(wcId, 'DOM.enable', {});
    const located = await devtools.sendCommandToTab(wcId, 'DOM.getNodeForLocation', {
      x: centerX,
      y: centerY,
      includeUserAgentShadowDOM: false,
    }) as CDPGetNodeForLocationResponse;

    const backendNodeId = located?.backendNodeId;
    if (!backendNodeId) return null;

    let tagName: string | null = null;
    try {
      const described = await devtools.sendCommandToTab(wcId, 'DOM.describeNode', { backendNodeId }) as CDPDescribeNodeResponse;
      tagName = described?.node?.nodeName ?? null;
    } catch {
      // tag name is a nice-to-have; the ref alone is still useful
    }

    const ref = snapshotManager.registerBackendNodeId(backendNodeId, wcId);
    return { ref, tagName };
  } catch {
    return null;
  }
}
