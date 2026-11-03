import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { readFileSync } from 'node:fs';
import { acceptMission, advanceTime, cancelMission, createGame, getActiveContract, localSaveRepository, offeredContracts, parseSave, pinApproach, reportFor, saveFlightDraft, submitFlightReport, type Game } from './game';
import { airports, BOARD_SIZE, customers, destinations, distanceNm, initialDispatch, LOADING, refreshBoard, templates, validateGenerated } from './generator';
import { createDispatcherContext } from './dispatcherContext';
import { selectDialogue } from './dialogue';
import { parseFaaIndex } from '../server/providers';
import { acceptLegacyMission } from '../tests/legacy';
const acceptFirst = (game: Game) => acceptMission(game, offeredContracts(game)[0].id);
function complete(game: Game, minutes = '30'): Game { return submitFlightReport(game, { ...reportFor(game), minutes }); }
function older(game: Game) { const { dispatch: _, activeContract: _active, ...old } = game; return old; }
function storage() { const map = new Map<string, string>(); vi.stubGlobal('navigator', {}); vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('localStorage', { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => map.set(key, value) }); }
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('seeded dispatch generation', () => {
  it('is deterministic from seed and operational events, independent of real time and navigation', () => {
    const a = createGame('Same company', 'fixed-seed');
    vi.useFakeTimers(); vi.setSystemTime(new Date('2040-01-01'));
    expect(createGame('Same company', 'fixed-seed')).toEqual(a);
    expect(parseSave(JSON.stringify(a))).toEqual(a); expect(parseSave(JSON.stringify(a))).toEqual(a);
    expect(refreshBoard(a.dispatch, 'PADQ', a.operationalTime)).toBe(a.dispatch);
    const renamed = { ...a, company: { ...a.company, name: 'Renamed' } }; expect(offeredContracts(parseSave(JSON.stringify(renamed)))).toEqual(offeredContracts(a));
  });
  it('refreshes at operational slot boundaries without changing the balance and retires all old IDs', () => {
    const a = createGame('Test', 'slots'); const before = offeredContracts(a);
    expect(offeredContracts(advanceTime(a, 1))).toEqual(before);
    const next = advanceTime(a, 6); expect(next.company).toEqual(a.company); expect(next.aircraft).toEqual(a.aircraft);
    expect(offeredContracts(next).every(c => !before.some(old => old.id === c.id))).toBe(true);
    expect(offeredContracts(parseSave(JSON.stringify(next)))).toEqual(offeredContracts(next));
  });
  it('never reuses an assignment ID across many refreshes or distinct seed namespaces', () => {
    const ids = new Set<string>();
    for (let seed = 0; seed < 15; seed++) {
      let game = createGame('Test', `company-${seed}`);
      for (let slot = 0; slot < 25; slot++) {
        for (const contract of offeredContracts(game)) { expect(ids.has(contract.id)).toBe(false); ids.add(contract.id); }
        game = advanceTime(game, 6);
      }
    }
    expect(ids.size).toBe(15 * 25 * BOARD_SIZE);
  });
  it('varies all seven mission categories, curated titles, customers, manifests, weights and payouts', () => {
    const categories = new Set(), titles = new Set(), clients = new Set(), manifests = new Set(), weights = new Set(), payouts = new Set();
    for (let seed = 0; seed < 80; seed++) for (const contract of offeredContracts(createGame('Test', `variety-${seed}`))) {
      categories.add(contract.generated!.category); titles.add(contract.title); clients.add(contract.generated!.customer); manifests.add(contract.payload); weights.add(contract.payloadLb); payouts.add(contract.payout);
    }
    expect(categories.size).toBe(7); expect(titles.size).toBe(templates.length); expect(clients.size).toBe(customers.length); expect(manifests.size).toBeGreaterThan(100); expect(weights.size).toBeGreaterThan(30); expect(payouts.size).toBeGreaterThan(20);
  });
  it('matches curated airport identifiers and coordinates to recorded official FAA-sourced airport records', () => {
    const source = JSON.parse(readFileSync(new URL('../tests/fixtures/dispatch-airports-faa-2026-11.json', import.meta.url), 'utf8'));
    for (const [id, airport] of Object.entries(airports)) {
      const row = source.airports.find((r: { icaoId: string }) => r.icaoId === id);
      expect(row).toBeDefined(); expect(row.source).toBe('FAA'); expect(row.state).toBe('AK'); expect(row.lat).toBe(airport.lat); expect(row.lon).toBe(airport.lon);
    }
    expect(source.airports.find((r: { icaoId: string }) => r.icaoId === 'PADY').name).toContain('KONGIGANAK');
  });
  it('uses only curated real airport pairs and coordinate-derived approximate distances', () => {
    expect(destinations('PADY')).toEqual([]); expect(destinations('PANC')).toEqual([]);
    for (const origin of Object.keys(airports)) {
      const state = refreshBoard(initialDispatch('route-seed'), origin, '2026-06-01T08:00:00Z'); expect(state.boards[origin].offers).toHaveLength(BOARD_SIZE);
      expect(new Set(state.boards[origin].offers.map(c => c.airport)).size).toBe(Math.min(BOARD_SIZE, destinations(origin).length));
      for (const c of state.boards[origin].offers) { expect(destinations(origin)).toContain(c.airport); expect(destinations(c.airport)).toContain(origin); expect(c.distanceNm).toBe(distanceNm(c.airport, origin)); expect(c.distanceNm).toBeGreaterThan(0); expect(c.distanceNm).toBeLessThan(180); expect(() => validateGenerated(c)).not.toThrow(); }
    }
  });
  it('enforces conservative fuel/crew/payload assumptions and rejects corrupt loads, routes and payouts', () => {
    const offer = offeredContracts(createGame('Test', 'loading'))[0];
    for (const payloadLb of [-1, 0, 1001, NaN]) expect(() => validateGenerated({ ...offer, payloadLb })).toThrow();
    for (const payout of [-1, 0, 100000, Infinity]) expect(() => validateGenerated({ ...offer, payout })).toThrow();
    for (const passengers of [-1, 1.5, 5, 20]) expect(() => validateGenerated({ ...offer, generated: { ...offer.generated!, passengers } })).toThrow();
    expect(() => validateGenerated({ ...offer, airport: 'PADY' })).toThrow(); expect(() => validateGenerated({ ...offer, origin: offer.airport })).toThrow();
    expect(() => validateGenerated({ ...offer, generated: { ...offer.generated!, cargoLb: -50 } })).toThrow();
    for (let i = 0; i < 50; i++) for (const c of offeredContracts(createGame('Test', `load-${i}`))) expect(c.payloadLb + LOADING.fuelLb + LOADING.crewLb + LOADING.marginLb).toBeLessThanOrEqual(LOADING.usefulBudgetLb);
  });
  it('does not reroll offered cards when adding opportunities at an arrival event', () => {
    const game = createGame('Test', 'stable'); const before = offeredContracts(game);
    const refilled = refreshBoard(game.dispatch, 'PADQ', game.operationalTime, true);
    expect(refilled.boards.PADQ.offers).toEqual(before);
  });
});
describe('assignment lifecycle, anti-repetition and finances', () => {
  it('locks the full accepted snapshot and payout across expiry and draft saves', () => {
    const game = createGame('Test', 'locked'); const original = offeredContracts(game)[0]; const active = acceptMission(game, original.id);
    original.payout = 2900; // Mutating the old offered object cannot mutate the accepted copy.
    const contract = getActiveContract(active)!; expect(contract.payout).not.toBe(2900);
    const later = advanceTime(active, 24); expect(getActiveContract(later)).toEqual(contract);
    const draft = saveFlightDraft(later, { ...reportFor(later), minutes: '45' });
    expect(draft.company.cash).toBe(25000); expect(draft.aircraft).toEqual(active.aircraft); expect(draft.operationalTime).toBe(later.operationalTime);
    const finished = complete(draft, '45'); expect(finished.company.cash).toBe(25000 + contract.payout); expect(finished.pilots).toEqual(active.pilots); expect(finished.logbook[0].contract).toEqual(contract); expect(finished.logbook[0].revenue).toBe(contract.payout);
    expect(parseSave(JSON.stringify(finished))).toEqual(finished);
  });
  it('blocks fixed IDs and unoffered/expired assignments; cancellation retires an instance without penalty', () => {
    const game = createGame('Test', 'cancel'); expect(() => acceptMission(game, 'kodiak-01')).toThrow('Unknown or expired');
    const id = offeredContracts(game)[0].id; const active = acceptMission(game, id); expect(() => acceptMission(active, offeredContracts(active)[0].id)).toThrow('Cancel');
    const cancelled = cancelMission(active); expect(cancelled.company).toEqual(game.company); expect(cancelled.aircraft).toEqual(game.aircraft);
    expect(() => acceptMission(cancelled, id)).toThrow(); expect(() => acceptMission(advanceTime(cancelled, 6), id)).toThrow();
  });
  it('prevents recent title/story/customer/payload repetition across a real round trip and reload', () => {
    let game = createGame('Test', 'roundtrip'); const first = offeredContracts(game)[0]; game = complete(acceptMission(game, first.id));
    // Return opportunities can require waiting; no real-world timer is involved.
    for (let slot = 0; slot < 30 && !offeredContracts(game).some(c => c.airport === 'PADQ'); slot++) game = advanceTime(game, 6);
    const back = offeredContracts(game).find(c => c.airport === 'PADQ'); expect(back).toBeDefined();
    game = complete(acceptMission(game, back!.id)); expect(game.aircraft[0].location).toBe('PADQ'); game = parseSave(JSON.stringify(game));
    for (const offer of offeredContracts(game)) for (const recent of game.dispatch.recent) {
      expect(offer.id).not.toBe(recent.id); expect(offer.title).not.toBe(recent.title); expect(offer.generated!.templateId).not.toBe(recent.templateId); expect(offer.generated!.customer).not.toBe(recent.customer); expect(offer.generated!.payloadFamily).not.toBe(recent.payloadFamily);
    }
    expect(game.dispatch.recent.some(r => r.id === first.id)).toBe(true);
  });
  it('avoids related payload families and recent customers across many legs, slots and reloads', () => {
    let game = createGame('Long career', 'long-career');
    for (let leg = 0; leg < 25; leg++) {
      for (let wait = 0; wait < 30 && !offeredContracts(game).length; wait++) game = advanceTime(game, 6);
      const board = offeredContracts(game); expect(board.length).toBeGreaterThan(0);
      expect(new Set(board.map(c => c.generated!.payloadFamily)).size).toBe(board.length);
      for (const offer of board) for (const recent of game.dispatch.recent) { expect(offer.title).not.toBe(recent.title); expect(offer.generated!.templateId).not.toBe(recent.templateId); expect(offer.generated!.customer).not.toBe(recent.customer); expect(offer.generated!.payloadFamily).not.toBe(recent.payloadFamily); }
      game = parseSave(JSON.stringify(complete(acceptMission(game, board[0].id))));
    }
    expect(game.logbook).toHaveLength(25); expect(new Set(game.logbook.map(e => e.missionId)).size).toBe(25);
  });
  it('makes return jobs possible but not guaranteed by an arrival', () => {
    const outcomes = new Set<boolean>();
    for (let i = 0; i < 50; i++) { const active = acceptFirst(createGame('Test', `return-${i}`)); const next = complete(active); outcomes.add(offeredContracts(next).some(c => c.airport === 'PADQ')); }
    expect(outcomes).toEqual(new Set([true, false]));
  });
  it('persists offers, active snapshots and drafts through storage/backups and pays only once under concurrent submission', async () => {
    storage(); const game = acceptFirst(createGame('Test', 'storage')); const draft = saveFlightDraft(game, { ...reportFor(game), minutes: '30', notes: 'Finish later' }); localSaveRepository.save(draft);
    expect(localSaveRepository.load()).toEqual(draft); expect(parseSave(JSON.stringify(draft))).toEqual(draft);
    const next = complete(draft); const results = await Promise.allSettled([localSaveRepository.commit(draft, next), localSaveRepository.commit(draft, next)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const loaded = localSaveRepository.load()!; expect(loaded.company.cash).toBe(25000 + getActiveContract(draft)!.payout); expect(loaded.logbook).toHaveLength(1);
    expect(() => submitFlightReport(loaded, reportFor(draft))).toThrow();
  });
  it('rejects a second payment for the same assignment even with a different flight nonce', () => {
    const active = acceptFirst(createGame('Test', 'duplicate-assignment')); const finished = complete(active);
    const stale = { ...active, activeFlightId: 'different-nonce', logbook: finished.logbook };
    expect(() => complete(stale)).toThrow('already been closed');
    const corrupt = { ...active, activeContract: { ...active.activeContract!, payout: 999999 } };
    expect(() => complete(corrupt)).toThrow('Invalid generated');
  });
  it('still gives no revenue for a diverted or incomplete generated delivery', () => {
    for (const delivery of ['diverted', 'incomplete'] as const) { const game = acceptFirst(createGame('Test', delivery)); const next = submitFlightReport(game, { ...reportFor(game), minutes: '20', delivery, arrival: 'PADQ' }); expect(next.company.cash).toBe(25000); expect(next.completedMissions).toBe(0); expect(next.logbook[0].revenue).toBe(0); }
  });
  it('rejects duplicate/reintroduced generated assignments and partial/corrupt dispatch saves', () => {
    const active = acceptFirst(createGame('Test', 'bad-save')); const finished = complete(active); const snapshot = active.activeContract!;
    const corrupt = JSON.parse(JSON.stringify(finished)); corrupt.dispatch.boards.PADQ = { epoch: 1, offers: [snapshot] };
    expect(() => parseSave(JSON.stringify(corrupt))).toThrow();
    const partial = { ...active } as Partial<Game>; delete partial.dispatch; expect(() => parseSave(JSON.stringify(partial))).toThrow('Incomplete dispatch');
    expect(() => parseSave(JSON.stringify({ ...active, dispatch: { ...active.dispatch, nextSerial: 0 } }))).toThrow();
  });
});
describe('older saves and read-only dispatcher context', () => {
  it('migrates genuine v0.1 and v0.2 shapes deterministically without resetting aggregates or locations', () => {
    const old = older(createGame('Original'));
    const { activeFlightId: _1, pendingReport: _2, logbook: _3, recentDialogue: _4, dispatcher: _5, revision: _6, pinnedApproach: _7, activeMissionId: _8, ...v1 } = old;
    v1.company.cash = 18340; v1.flightHours = 17; v1.completedMissions = 9; v1.aircraft[0].hours = 123;
    const a = parseSave(JSON.stringify(v1)), b = parseSave(JSON.stringify(v1)); expect(a).toEqual(b); expect(a.company).toEqual(v1.company); expect(a.aircraft).toEqual(v1.aircraft); expect(a.flightHours).toBe(17); expect(a.completedMissions).toBe(9);
    const v2 = parseSave(JSON.stringify({ ...v1, activeMissionId: 'kodiak-01' })); expect(getActiveContract(v2)?.payout).toBe(1450); expect(v2.activeMissionId).toBe('kodiak-01'); expect(v2.activeFlightId).toContain('legacy:');
  });
  it('keeps a generated active assignment, draft, and FAA pin stable across a board refresh and JSON export', () => {
    let game = acceptFirst(createGame('Generated EFB', 'pin-refresh'));
    const xml = readFileSync(new URL('../tests/fixtures/faa-padq-2611.xml', import.meta.url), 'utf8'); const now = Date.parse('2026-11-02'); const catalog = parseFaaIndex(xml, 'PADQ', '2611', now);
    game = pinApproach(game, catalog.charts[0], catalog, now); game = saveFlightDraft(game, { ...reportFor(game), minutes: '45' });
    const next = parseSave(JSON.stringify(advanceTime(game, 24)));
    expect(next.activeContract).toEqual(game.activeContract); expect(next.pinnedApproach).toEqual(game.pinnedApproach); expect(next.pendingReport).toEqual(game.pendingReport); expect(next.company).toEqual(game.company); expect(next.aircraft).toEqual(game.aircraft);
  });
  it('preserves a v0.4 accepted legacy mission, draft and pinned FAA approach, paying its original amount', () => {
    let game = acceptLegacyMission(createGame('Original'), 'kodiak-01'); game = saveFlightDraft(game, { ...reportFor(game), minutes: '45', notes: 'Legacy draft' });
    const xml = readFileSync(new URL('../tests/fixtures/faa-padq-2611.xml', import.meta.url), 'utf8'); const now = Date.parse('2026-11-02'); const catalog = parseFaaIndex(xml, 'PADQ', '2611', now); game = pinApproach(game, catalog.charts[0], catalog, now);
    const raw = older(game), restored = parseSave(JSON.stringify(raw));
    expect(restored.pendingReport).toEqual(game.pendingReport); expect(restored.pinnedApproach).toEqual(game.pinnedApproach); expect(restored.activeMissionId).toBe('kodiak-01'); expect(restored.activeFlightId).toBe(game.activeFlightId); expect(restored.operationalTime).toBe(game.operationalTime);
    expect(complete(restored, '45').company.cash).toBe(26450);
  });
  it('preserves old logbook entries without requiring new contract snapshots or rewriting legacy airport codes', () => {
    const game = complete(acceptLegacyMission(createGame('Old log'), 'kodiak-02'));
    const raw = older(game); raw.logbook = raw.logbook.map(({ contract: _, ...entry }) => entry);
    const restored = parseSave(JSON.stringify(raw)); expect(restored.logbook).toEqual(raw.logbook); expect(restored.aircraft[0].location).toBe('PADY'); expect(offeredContracts(restored)).toEqual([]); expect(createDispatcherContext(restored).status).toBe('no-offers'); expect(restored.company.cash).toBe(raw.company.cash);
  });
  it('provides detached, deeply frozen context and broader category-specific nonrepeating dialogue without API calls', () => {
    const game = acceptFirst(createGame('Context', 'context')); const context = createDispatcherContext(game);
    expect(context.assignment?.id).toBe(game.activeMissionId); expect(context.status).toBe('accepted'); expect(Object.isFrozen(context)).toBe(true); expect(Object.isFrozen(context.company)).toBe(true); expect(Object.isFrozen(context.available)).toBe(true);
    expect(() => { (context.company as { cash: number }).cash = 0; }).toThrow(); expect(game.company.cash).toBe(25000);
    const contract = getActiveContract(game)!; let recent: string[] = [];
    for (let i = 0; i < 3; i++) { const line = selectDialogue('accepted', contract, undefined, recent); expect(line.id).toContain(contract.generated!.category); expect(recent).not.toContain(line.id); recent.unshift(line.id); }
    const draft = saveFlightDraft(game, reportFor(game)); expect(createDispatcherContext(draft).status).toBe('draft');
  });
});
