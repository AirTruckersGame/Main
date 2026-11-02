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
