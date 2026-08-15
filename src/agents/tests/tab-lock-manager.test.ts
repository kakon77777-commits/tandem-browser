import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TabLockManager } from '../tab-lock-manager';

describe('TabLockManager', () => {
  let lm: TabLockManager;
  let agentRegistry: { touch: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    agentRegistry = { touch: vi.fn() };
    lm = new TabLockManager(agentRegistry as any);
  });

  describe('agent registry integration (PMW ISOLATE operator)', () => {
    it('touches the agent registry on every acquire() call', () => {
      lm.acquire('tab-1', 'claude');
      expect(agentRegistry.touch).toHaveBeenCalledWith('claude');

      lm.acquire('tab-1', 'other-agent');
      expect(agentRegistry.touch).toHaveBeenCalledWith('other-agent');
    });

    it('touches the registry even when the lock attempt fails', () => {
      lm.acquire('tab-1', 'claude');
      agentRegistry.touch.mockClear();

      lm.acquire('tab-1', 'other-agent');
      expect(agentRegistry.touch).toHaveBeenCalledWith('other-agent');
    });
  });

  describe('acquire()', () => {
    it('user always acquires, even when locked by agent', () => {
      lm.acquire('tab-1', 'claude');
      const result = lm.acquire('tab-1', 'user');
      expect(result.acquired).toBe(true);
      expect(lm.getOwner('tab-1')).toBe('user');
    });

    it('emits lock-overridden when user overrides agent lock', () => {
      const handler = vi.fn();
      lm.on('lock-overridden', handler);

      lm.acquire('tab-1', 'claude');
      lm.acquire('tab-1', 'user');

      expect(handler).toHaveBeenCalledWith({
        tabId: 'tab-1',
        previousOwner: 'claude',
        newOwner: 'user',
      });
    });

    it('does not emit lock-overridden when user acquires unlocked tab', () => {
      const handler = vi.fn();
      lm.on('lock-overridden', handler);

      lm.acquire('tab-1', 'user');
      expect(handler).not.toHaveBeenCalled();
    });

    it('agent cannot acquire tab locked by another agent', () => {
      lm.acquire('tab-1', 'claude');
      const result = lm.acquire('tab-1', 'other-agent');
      expect(result.acquired).toBe(false);
      expect(result.owner).toBe('claude');
    });

    it('agent can renew own lock', () => {
      lm.acquire('tab-1', 'claude');
      const result = lm.acquire('tab-1', 'claude');
      expect(result.acquired).toBe(true);
    });
  });

  describe('release()', () => {
    it('user can release any lock', () => {
      lm.acquire('tab-1', 'claude');
      expect(lm.release('tab-1', 'user')).toBe(true);
      expect(lm.isLocked('tab-1')).toBe(false);
    });

    it('agent cannot release another agent lock', () => {
      lm.acquire('tab-1', 'claude');
      expect(lm.release('tab-1', 'other-agent')).toBe(false);
      expect(lm.isLocked('tab-1')).toBe(true);
    });

    it('returns true for unlocked tab', () => {
      expect(lm.release('tab-1', 'claude')).toBe(true);
    });
  });
});
