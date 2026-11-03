// The navigation layout (src/ui/tabLayout.js, CLAUDE.md Interface >
// Navigation): at most 6 main tabs and 5 sub-tabs each, every system's
// places fit the layout, and every slot not planned for later is filled.
import { describe, it, expect, beforeAll } from 'vitest';
import { MAIN_TABS, MAX_MAIN_TABS, MAX_SUB_TABS, registerPlace, registeredPaths, pathForAlias } from '../src/ui/tabLayout.js';

describe('layout limits', () => {
  it('has at most 6 main tabs, each with at most 5 sub-tabs', () => {
    expect(MAIN_TABS.map((m) => m.id)).toEqual(['world', 'realm', 'people', 'chronicle', 'codex', 'system']);
    expect(MAIN_TABS.length).toBeLessThanOrEqual(MAX_MAIN_TABS);
    for (const m of MAIN_TABS) expect(m.subs.length).toBeLessThanOrEqual(MAX_SUB_TABS);
  });

  it('refuses a 7th main tab and a 6th sub-tab', () => {
    expect(() => registerPlace('military/units', () => null)).toThrow(/no main tab/);
    expect(() => registerPlace('realm/sixth', () => null)).toThrow(/already has 5 sub-tabs/);
  });

  it('keeps the old tab names working', () => {
    expect(pathForAlias('characters')).toEqual({ main: 'people', sub: 'roster' });
    expect(pathForAlias('biome')).toEqual({ main: 'world', sub: 'biomeMap' });
    expect(pathForAlias('log')).toEqual({ main: 'chronicle', sub: 'dayLog' });
  });
});

describe('every system has a place', () => {
  beforeAll(async () => {
    // A few files listen for keys or tab focus when they load; Node has no
    // window or document.
    const listener = { addEventListener() {}, removeEventListener() {} };
    globalThis.window ??= listener;
    globalThis.document ??= { ...listener, visibilityState: 'visible' };
    await import('../src/systems/registry.js');
  });

  it('fills every slot that is not planned for a later stage', () => {
    const filled = new Set(registeredPaths());
    const empty = [];
    for (const m of MAIN_TABS) {
      for (const s of m.subs) {
        if (s.planned) continue;
        const paths = s.subsubs.length ? s.subsubs.filter((x) => !x.planned).map((x) => `${m.id}/${s.id}/${x.id}`) : [`${m.id}/${s.id}`];
        for (const p of paths) if (!filled.has(p)) empty.push(p);
      }
    }
    expect(empty).toEqual([]);
  });
});
