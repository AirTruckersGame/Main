import { afterEach, describe, expect, it, vi } from 'vitest';
import { acceptMission, cancelMission, createGame, localSaveRepository, parseSave, reportFor, saveFlightDraft, submitFlightReport, SAVE_KEY } from './game';
import { availableContracts, contracts } from './missions';
import { selectDialogue } from './dialogue';
import type { FlightDraft } from './reports';
afterEach(() => vi.unstubAllGlobals());
const accepted = () => acceptMission(createGame('Kodiak Air'), 'kodiak-01');
const reported = (flightId: string): FlightDraft => ({ flightId, minutes: '45', fuelLb: '180.5', estimatedMinutes: '30', estimatedFuelLb: '150', arrival: 'PALB', delivery: 'completed', landing: 'normal', notes: 'Coastal headwind.' });
function storage() {
  const store = new Map<string, string>();
  const setItem = vi.fn((key: string, value: string) => { store.set(key, value); });
  vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key) ?? null, setItem });
  let queue: Promise<unknown> = Promise.resolve();
  vi.stubGlobal('navigator', { locks: { request: (_: string, action: () => unknown) => {
    const pending = queue.then(action); queue = pending.catch(() => undefined); return pending;
  } } });
  return { store, setItem };
}
describe('flight report lifecycle', () => {
  it('saves a partial draft through browser storage and JSON without financial or flight effects', async () => {
    storage(); const game = accepted(); localSaveRepository.save(game);
    const draft = { ...reportFor(game), notes: 'Finish after dinner.' };
    const next = await localSaveRepository.commit(game, saveFlightDraft(game, draft));
    expect(localSaveRepository.load()).toEqual(next);
    expect(parseSave(JSON.stringify(next)).pendingReport).toEqual(draft);
    for (const key of ['company', 'aircraft', 'flightHours', 'completedMissions', 'operationalTime', 'activeMissionId'] as const) expect(next[key]).toEqual(game[key]);
  });
  it('pays company revenue once, logs actuals separately, moves aircraft and advances only reported time', () => {
    const game = accepted(); const report = reported(game.activeFlightId!);
    const next = submitFlightReport(game, report);
    expect(next.company.cash).toBe(26450);
    expect(next.pilots).toEqual(game.pilots);
    expect(next.company.reputation).toBe(game.company.reputation);
    expect(next.aircraft[0]).toEqual({ ...game.aircraft[0], hours: 0.75, location: 'PALB' });
    expect(next.flightHours).toBe(0.75); expect(next.completedMissions).toBe(1);
    expect(next.operationalTime).toBe('2026-06-01T08:45:00.000Z');
    expect(next.activeMissionId).toBeNull(); expect(next.pendingReport).toBeNull(); expect(next.activeFlightId).toBeNull();
    expect(next.logbook).toHaveLength(1);
    expect(next.logbook[0]).toMatchObject({ minutes: 45, fuelLb: 180.5, estimatedMinutes: 30, estimatedFuelLb: 150, revenue: 1450, origin: 'PADQ', arrival: 'PALB', notes: report.notes });
    expect(parseSave(JSON.stringify(next))).toEqual(next);
    expect(() => submitFlightReport(next, report)).toThrow('already been submitted');
  });
  it('records diversion to an alternate without payment or a successful delivery', () => {
    const game = accepted();
    const next = submitFlightReport(game, { ...reported(game.activeFlightId!), delivery: 'diverted', arrival: 'PADQ', landing: 'hard' });
    expect(next.company).toEqual(game.company); expect(next.completedMissions).toBe(0);
    expect(next.flightHours).toBe(0.75); expect(next.aircraft[0].location).toBe('PADQ');
    expect(next.operationalTime).toBe('2026-06-01T08:45:00.000Z');
    expect(next.logbook[0]).toMatchObject({ revenue: 0, delivery: 'diverted', landing: 'hard' });
    expect(next.dispatcher?.text).toMatch(/hard landing/i);
    expect(next.aircraft[0].maintenance).toBe(game.aircraft[0].maintenance);
    expect(next.activeMissionId).toBeNull();
    expect(parseSave(JSON.stringify(next))).toEqual(next);
  });
  it('logs incomplete delivery at destination without revenue and records a completed hard landing honestly', () => {
    const game = accepted();
    const incomplete = submitFlightReport(game, { ...reported(game.activeFlightId!), delivery: 'incomplete' });
    expect(incomplete.company.cash).toBe(25000); expect(incomplete.completedMissions).toBe(0);
    expect(incomplete.aircraft[0].location).toBe('PALB'); expect(incomplete.logbook[0].delivery).toBe('incomplete');
    const hard = submitFlightReport(game, { ...reported(game.activeFlightId!), landing: 'hard' });
    expect(hard.company.cash).toBe(26450); expect(hard.completedMissions).toBe(1);
    expect(hard.logbook[0].landing).toBe('hard'); expect(hard.aircraft[0].maintenance).toBe('Airworthy');
  });
  it('allows unknown fuel without inventing consumption', () => {
    const game = accepted();
    const next = submitFlightReport(game, { ...reported(game.activeFlightId!), fuelLb: '', estimatedFuelLb: '', estimatedMinutes: '' });
    expect(next.logbook[0]).toMatchObject({ fuelLb: null, estimatedFuelLb: null, estimatedMinutes: null });
  });
  it('rejects invalid time, fuel, outcomes, notes and mismatched flight IDs without changing progress', () => {
    const game = accepted(); const report = reported(game.activeFlightId!);
    for (const minutes of ['', '0', '-1', '1.5', 'NaN', 'Infinity', '1441', '1e2', ' 45 ']) expect(() => submitFlightReport(game, { ...report, minutes })).toThrow();
    for (const fuelLb of ['-1', 'NaN', 'Infinity', '10001', '1e2', '1.234']) expect(() => submitFlightReport(game, { ...report, fuelLb })).toThrow();
    for (const change of [{ arrival: 'PADQ' }, { delivery: 'diverted' }, { flightId: 'stale' }, { notes: 'x'.repeat(2001) }, { estimatedMinutes: '-4' }, { estimatedFuelLb: 'bad' }, { arrival: 'NOTANAIRPORT' }]) expect(() => submitFlightReport(game, { ...report, ...change } as FlightDraft)).toThrow();
    expect(game.company.cash).toBe(25000); expect(game.logbook).toEqual([]);
    expect(() => saveFlightDraft(game, { ...report, fuelLb: '-4' })).toThrow();
  });
  it('supports defined return routes and rejects impossible origins, with no contracts elsewhere', () => {
    const game = accepted(); const next = submitFlightReport(game, reported(game.activeFlightId!));
    expect(availableContracts('PADQ')).toHaveLength(5);
    expect(availableContracts('PALB').map(c => c.id)).toEqual(['larsen-return']);
    expect(() => acceptMission(next, 'kodiak-02')).toThrow('current airport');
    const returned = acceptMission(next, 'larsen-return'); expect(returned.activeMissionId).toBe('larsen-return');
    expect(availableContracts('PANC')).toEqual([]);
    const diverted = submitFlightReport(game, { ...reported(game.activeFlightId!), delivery: 'diverted', arrival: 'PANC' });
    expect(diverted.aircraft[0].location).toBe('PANC');
    expect(availableContracts(diverted.aircraft[0].location)).toEqual([]);
    expect(parseSave(JSON.stringify(diverted))).toEqual(diverted);
  });
  it('adds to existing totals and pays a repeated contract only for a new flight instance', () => {
    const game = accepted(); game.aircraft[0].hours = 120; game.flightHours = 8.5;
    const firstReport = reported(game.activeFlightId!);
    const first = submitFlightReport(game, firstReport);
    expect(first.aircraft[0].hours).toBe(120.75); expect(first.flightHours).toBe(9.25);
    const returnFlight = acceptMission(first, 'larsen-return');
    const home = submitFlightReport(returnFlight, { ...reported(returnFlight.activeFlightId!), arrival: 'PADQ' });
    const again = acceptMission(home, 'kodiak-01');
    expect(() => submitFlightReport(again, firstReport)).toThrow('already been submitted');
    const second = submitFlightReport(again, reported(again.activeFlightId!));
    expect(second.company.cash).toBe(25000 + 1450 + 1000 + 1450);
    expect(second.logbook).toHaveLength(3); expect(second.completedMissions).toBe(3);
    expect(new Set(second.logbook.map(e => e.id)).size).toBe(3);
  });
  it('uses a different flight instance for each contract acceptance and discards cancelled drafts', () => {
    const game = accepted(); const report = reported(game.activeFlightId!);
    const cancelled = cancelMission(saveFlightDraft(game, report));
    expect(cancelled.pendingReport).toBeNull();
    const again = acceptMission(cancelled, 'kodiak-01');
    expect(again.activeFlightId).not.toBe(game.activeFlightId);
    expect(() => submitFlightReport(again, report)).toThrow('no longer active');
  });
});
describe('migration and atomic local commits', () => {
  function oldSave(activeMissionId?: string) {
    const game = createGame('Legacy');
    const { activeFlightId: _1, pendingReport: _2, logbook: _3, dispatcher: _4, recentDialogue: _5, revision: _6, activeMissionId: _7, ...legacy } = game;
    return { ...legacy, company: { ...legacy.company, cash: 19750 }, completedMissions: 3, flightHours: 8.25, ...(activeMissionId ? { activeMissionId } : {}) };
  }
  it('migrates v0.1 aggregates without inventing historical reports', () => {
    const old = oldSave(); const migrated = parseSave(JSON.stringify(old));
    expect(migrated).toMatchObject({ ...old, activeMissionId: null, activeFlightId: null, pendingReport: null, logbook: [], revision: 0 });
    expect(parseSave(JSON.stringify(migrated))).toEqual(migrated);
  });
  it('migrates accepted v0.2 missions deterministically and can finish without losing old totals', () => {
    const old = JSON.stringify(oldSave('kodiak-01'));
    const game = parseSave(old); expect(game.activeFlightId).toBe(parseSave(old).activeFlightId);
    const next = submitFlightReport(game, reported(game.activeFlightId!));
    expect(next.company.cash).toBe(21200); expect(next.completedMissions).toBe(4); expect(next.flightHours).toBe(9);
    expect(next.logbook).toHaveLength(1);
  });
  it('serializes simultaneous submissions and rejects stale tabs instead of paying twice', async () => {
    storage(); const game = accepted(); localSaveRepository.save(game);
    const next = submitFlightReport(game, reported(game.activeFlightId!));
    const results = await Promise.allSettled([localSaveRepository.commit(game, next), localSaveRepository.commit(game, next)]);
    expect(results.map(r => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(localSaveRepository.load()?.company.cash).toBe(26450);
    expect(localSaveRepository.load()?.logbook).toHaveLength(1);
    await expect(localSaveRepository.commit(game, { ...game, company: { ...game.company, name: 'Stale rename' } })).rejects.toThrow('another tab');
    const loaded = localSaveRepository.load()!;
    expect(() => submitFlightReport(loaded, reported(game.activeFlightId!))).toThrow('already been submitted');
  });
  it('keeps the previous save intact when storage fails; retry does not duplicate revenue', async () => {
    const { setItem } = storage(); const game = accepted(); localSaveRepository.save(game);
    const next = submitFlightReport(game, reported(game.activeFlightId!));
    setItem.mockImplementationOnce(() => { throw new Error('Quota exceeded'); });
    await expect(localSaveRepository.commit(game, next)).rejects.toThrow('Quota exceeded');
    expect(localSaveRepository.load()).toEqual(game);
    await localSaveRepository.commit(game, next);
    expect(localSaveRepository.load()?.company.cash).toBe(26450);
  });
  it('does not overwrite corrupt saves or allow duplicate receipts, invalid pending drafts or partial migrations', async () => {
    const { store } = storage(); const game = accepted(); const next = submitFlightReport(game, reported(game.activeFlightId!));
    expect(() => parseSave(JSON.stringify({ ...next, logbook: [...next.logbook, next.logbook[0]] }))).toThrow('Duplicate');
    expect(() => parseSave(JSON.stringify({ ...game, pendingReport: { ...reported('wrong') } }))).toThrow('Draft');
    expect(() => parseSave(JSON.stringify({ ...game, pendingReport: { ...reported(game.activeFlightId!), minutes: '-5' } }))).toThrow();
    const partial = { ...game } as Partial<typeof game>; delete partial.logbook;
    expect(() => parseSave(JSON.stringify(partial))).toThrow('Incomplete');
    store.set(SAVE_KEY, 'damaged');
    await expect(localSaveRepository.commit(game, next)).rejects.toThrow(); expect(store.get(SAVE_KEY)).toBe('damaged');
  });
  it('refuses unsafe saving without Web Locks and leaves storage unchanged', async () => {
    const { store } = storage(); vi.stubGlobal('navigator', {});
    await expect(localSaveRepository.commit(null, createGame('Test'))).rejects.toThrow('HTTPS');
    expect(store.has(SAVE_KEY)).toBe(false);
  });
});
describe('dispatcher dialogue', () => {
  it('reacts to mission type and report status, avoiding recent variants and using least-recently-used fallback', () => {
    const cargo = contracts[0], passenger = contracts.find(c => c.type === 'Passenger charter')!;
    expect(selectDialogue('accepted', cargo, undefined, []).id).toContain('Cargo');
    expect(selectDialogue('accepted', passenger, undefined, []).id).toContain('Passenger');
    let recent: string[] = [];
    for (let i = 0; i < 3; i++) { const line = selectDialogue('draft', cargo, undefined, recent); expect(recent).not.toContain(line.id); recent = [line.id, ...recent]; }
    expect(selectDialogue('draft', cargo, undefined, recent).id).toBe(recent[2]);
    expect(selectDialogue('cancelled', cargo, undefined, []).text).toMatch(/No charge|No penalty|Cancelled/);
  });
  it('prioritizes diversion, incomplete delivery and hard landing over estimate comparisons', () => {
    const report = reported('test');
    expect(selectDialogue('submitted', contracts[0], report, []).id).toContain('longer');
    expect(selectDialogue('submitted', contracts[0], { ...report, estimatedMinutes: '', estimatedFuelLb: '100' }, []).id).toContain('fuel');
    expect(selectDialogue('submitted', contracts[0], { ...report, landing: 'hard' }, []).id).toContain('hard');
    expect(selectDialogue('submitted', contracts[0], { ...report, delivery: 'diverted' }, []).id).toContain('diverted');
    expect(selectDialogue('submitted', contracts[0], { ...report, delivery: 'incomplete', landing: 'hard' }, []).id).toContain('incompleteHard');
    expect(selectDialogue('submitted', contracts[0], { ...report, estimatedMinutes: '', estimatedFuelLb: '' }, []).id).toContain('completedCargo');
  });
  it('persists dialogue history without advancing the clock', () => {
    const game = accepted(); const draft = saveFlightDraft(game, reportFor(game)); const restored = parseSave(JSON.stringify(draft));
    expect(restored.recentDialogue).toEqual(draft.recentDialogue); expect(restored.dispatcher).toEqual(draft.dispatcher);
    expect(saveFlightDraft(restored, reportFor(restored)).dispatcher?.id).not.toBe(restored.dispatcher?.id);
    expect(restored.operationalTime).toBe(game.operationalTime);
  });
});
