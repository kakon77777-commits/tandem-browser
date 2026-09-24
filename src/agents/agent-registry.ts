import fs from 'fs';
import { EventEmitter } from 'events';
import { ensureDir, tandemDir } from '../utils/paths';

// ─── Types ──────────────────────────────────────────────────────────

export type AgentKind = 'human' | 'ai';

export interface AgentRecord {
  id: string;
  kind: AgentKind;
  firstSeenAt: number;
  lastSeenAt: number;
}

function isAgentKind(value: unknown): value is AgentKind {
  return value === 'human' || value === 'ai';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function sanitizeRecord(raw: unknown): AgentRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<AgentRecord>;
  if (typeof r.id !== 'string' || !r.id) return null;
  return {
    id: r.id,
    kind: isAgentKind(r.kind) ? r.kind : 'ai',
    firstSeenAt: isFiniteNumber(r.firstSeenAt) ? r.firstSeenAt : Date.now(),
    lastSeenAt: isFiniteNumber(r.lastSeenAt) ? r.lastSeenAt : Date.now(),
  };
}

// ─── Manager ─────────────────────────────────────────────────────────────────

/**
 * AgentRegistry — lightweight identity record for every distinct actor
 * (human or AI) that has acted in Tandem. PMW's `agents` primitive.
 *
 * Deliberately minimal: no capability/authority set yet. HandoffManager's
 * accept()/reject() already document that PMW's Authority_B ⊆ Authority_A
 * check (does the accepting party's capability set cover what the
 * originating agent could do) isn't implemented because there was no
 * agents/capability registry to check against - this is that registry's
 * identity substrate, not the authority check itself. Adding a capability
 * model before anything enforces it would be speculative; that's future
 * work once a real consumer needs it.
 *
 * `lastSeenAt` is touched on every acquire()/renewal from TabLockManager
 * (PMW's ISOLATE operator), which can happen many times a minute in an
 * active agent session - persisting every touch would mean a disk write
 * per tool call. Same tradeoff AgentTrustStore already makes for its T2/T4
 * windows: only a genuinely new agent id triggers a write; an existing
 * agent's `lastSeenAt` updates in memory and is written on the next new-id
 * event or process exit isn't guaranteed to flush it - an acceptable,
 * explicit gap, not a silent one.
 *
 * Persistence: ~/.tandem/agent-registry.json (Windows: %APPDATA%\Tandem Browser)
 * API routes:  src/api/routes/agent-registry.ts
 * MCP tools:   src/mcp/tools/agent-registry.ts
 */
export class AgentRegistry extends EventEmitter {

  // === 1. Private state ===

  private readonly registryPath: string;
  private readonly agents = new Map<string, AgentRecord>();

  // === 2. Constructor ===

  constructor() {
    super();
    ensureDir(tandemDir());
    this.registryPath = tandemDir('agent-registry.json');
    this.loadFromDisk();
  }

  // === 4. Public methods ===

  /**
   * Register a new agent or refresh lastSeenAt for a known one. Idempotent.
   * `kind` only applies the first time an id is seen - a later touch() with
   * a different kind does not retroactively change it; kind is treated as
   * a fact about the id, not a per-call override. Defaults to 'human' for
   * the well-known 'user' id and 'ai' otherwise, matching TabLockManager's
   * existing special-casing of 'user'.
   */
  touch(id: string, kind?: AgentKind): AgentRecord {
    const now = Date.now();
    const existing = this.agents.get(id);
    if (existing) {
      existing.lastSeenAt = now;
      this.emit('agent-touched', { ...existing });
      return { ...existing };
    }

    const record: AgentRecord = {
      id,
      kind: kind ?? (id === 'user' ? 'human' : 'ai'),
      firstSeenAt: now,
      lastSeenAt: now,
    };
    this.agents.set(id, record);
    this.saveToDisk();
    this.emit('agent-touched', { ...record });
    return { ...record };
  }

  list(): AgentRecord[] {
    return Array.from(this.agents.values())
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
      .map((r) => ({ ...r }));
  }

  get(id: string): AgentRecord | null {
    const record = this.agents.get(id);
    return record ? { ...record } : null;
  }

  // === 6. Cleanup ===

  destroy(): void {
    this.removeAllListeners();
  }

  // === 7. Private I/O ===

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(this.registryPath)) return;
      const raw = JSON.parse(fs.readFileSync(this.registryPath, 'utf-8'));
      if (!Array.isArray(raw)) return;
      for (const item of raw) {
        const record = sanitizeRecord(item);
        if (record) this.agents.set(record.id, record);
      }
    } catch {
      this.agents.clear();
    }
  }

  private saveToDisk(): void {
    try {
      const serialized = JSON.stringify(Array.from(this.agents.values()), null, 2);
      fs.writeFileSync(this.registryPath, serialized);
    } catch {
      // best-effort persistence, same pattern as every other manager here
    }
  }
}
