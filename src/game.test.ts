import { contracts } from './missions';
import { acceptMission, cancelMission } from './game';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { advanceTime, createGame, localSaveRepository, parseSave, SAVE_KEY } from './game';
afterEach(() => vi.unstubAllGlobals());
describe('career foundation', () => {
  it('starts with the owned Caravan, Kodiak, one salaried pilot and $25,000', () => {
    const game = createGame('  Kodiak Air  ');
    expect(game.company).toEqual({ name: 'Kodiak Air', cash: 25000, headquarters: 'PADQ', reputation: 50 });
    expect(game.aircraft).toHaveLength(1);
    expect(game.aircraft[0]).toMatchObject({ model: 'Cessna 208B Grand Caravan EX', location: 'PADQ', ownership: 'owned', maintenance: 'Airworthy', hours: 0 });
    expect(game.pilots).toEqual([{ id: 'owner', role: 'Owner / Pilot', annualSalary: 65000 }]);
  });
  it('does not advance with real time and advances deliberately across calendar boundaries', () => {
    const game = createGame('Kodiak Air');
    vi.useFakeTimers(); vi.setSystemTime(new Date('2040-01-01'));
    expect(createGame('Other').operationalTime).toBe(game.operationalTime);
    const next = advanceTime(game, 168);
    expect(next.operationalTime).toBe('2026-06-08T08:00:00.000Z');
    expect(next.company.cash).toBe(25000);
    expect(game.operationalTime).toBe('2026-06-01T08:00:00.000Z');
    vi.useRealTimers();
    for (const hours of [0, -1, NaN, Infinity, 169]) expect(() => advanceTime(game, hours)).toThrow();
  });
  it('persists and restores renamed companies without resetting progress', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) });
    expect(localSaveRepository.load()).toBeNull();
    const progressed = advanceTime(createGame('Old name'), 24);
    progressed.completedMissions = 3; progressed.flightHours = 4.5;
    const renamed = { ...progressed, company: { ...progressed.company, name: 'New name' } };
    localSaveRepository.save(renamed);
    expect(localSaveRepository.load()).toEqual(renamed);
    expect(parseSave(store.get(SAVE_KEY)!)).toEqual(renamed);
  });
  it('rejects malformed and incompatible saves without overwriting them', () => {
    for (const raw of ['broken', '{}', 'null', JSON.stringify({ ...createGame('Test'), version: 2 }), JSON.stringify({ ...createGame('Test'), aircraft: [{}] })]) expect(() => parseSave(raw)).toThrow();
    vi.stubGlobal('localStorage', { setItem: () => { throw new Error('Quota exceeded'); } });
    expect(() => localSaveRepository.save(createGame('Test'))).toThrow('Quota exceeded');
  });
});

describe('dispatch state and compatibility', () => {
  it('loads a Version 0.1 save with no mission and preserves all existing progress', () => {
    const { activeMissionId: _, ...legacy } = advanceTime(createGame('Legacy Air'), 24);
    legacy.company.cash = 23456; legacy.completedMissions = 7; legacy.flightHours = 12.5;
    expect(parseSave(JSON.stringify(legacy))).toEqual({ ...legacy, activeMissionId: null });
  });
  it('accepts only a known contract and blocks a second active mission', () => {
    const game = createGame('Island Air');
    expect(() => acceptMission(game, 'unknown')).toThrow('Unknown contract');
    const accepted = acceptMission(game, contracts[0].id);
    expect(accepted.activeMissionId).toBe(contracts[0].id);
    expect(game.activeMissionId).toBeNull();
    expect(() => acceptMission(accepted, contracts[1].id)).toThrow('Cancel');
    expect(() => acceptMission(accepted, contracts[0].id)).toThrow('Cancel');
  });
  it('cancels without changing cash, reputation, time, flight totals or aircraft', () => {
    const game = createGame('Island Air');
    const accepted = acceptMission(game, contracts[2].id);
    expect(accepted).toEqual({ ...game, activeMissionId: contracts[2].id });
    const cancelled = cancelMission(accepted);
    expect(cancelled).toEqual(game);
    expect(cancelMission(cancelled)).toEqual(game);
    expect(acceptMission(cancelled, contracts[2].id).activeMissionId).toBe(contracts[2].id);
  });
  it('restores active and cancelled mission state through storage and JSON backups', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) });
    for (const contract of contracts) {
      const accepted = acceptMission(createGame('Island Air'), contract.id);
      localSaveRepository.save(accepted);
      expect(localSaveRepository.load()).toEqual(accepted);
      expect(parseSave(JSON.stringify(accepted))).toEqual(accepted);
      const cancelled = cancelMission(accepted);
      localSaveRepository.save(cancelled);
      expect(localSaveRepository.load()).toEqual(cancelled);
    }
  });
  it('rejects invalid mission state rather than silently discarding it', () => {
    for (const id of ['missing-mission', 3, {}, false]) expect(() => parseSave(JSON.stringify({ ...createGame('Test'), activeMissionId: id }))).toThrow('unsupported mission');
  });
  it('defines five unique, complete Kodiak-area contract briefs', () => {
    expect(contracts).toHaveLength(5);
    expect(new Set(contracts.map(c => c.id)).size).toBe(5);
    for (const contract of contracts) {
      expect(contract.payloadLb).toBeGreaterThan(0); expect(contract.payout).toBeGreaterThan(0);
      expect(contract.distanceNm).toBeGreaterThan(0); expect(contract.distanceNm).toBeLessThan(100);
      for (const field of ['title', 'type', 'destination', 'airport', 'payload', 'story', 'considerations'] as const) expect(contract[field].length).toBeGreaterThan(0);
    }
  });
});
