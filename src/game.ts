import { chartCurrent, validChart, type ChartCatalog, type Chart, type PinnedApproach } from './efbData';
import { withSaveCoordination } from './storageGate';
import { findContract, type Contract } from './missions';
import { initialDispatch, refreshBoard, rememberAssignment, validateDispatch, validateGenerated, hashSeed, type DispatchState } from './generator';
import { blankDraft, numericInput, validateDraft, type FlightDraft, type FlightEntry } from './reports';
import { selectDialogue, type DialogueEvent, type DispatcherLine } from './dialogue';
export interface Aircraft { id: string; model: string; location: string; hours: number; ownership: 'owned'; maintenance: 'Airworthy' }
export interface Pilot { id: string; role: 'Owner / Pilot'; annualSalary: number; }
export interface Game {
  dispatch: DispatchState; activeContract: Contract | null;
  version: 1; company: { name: string; cash: number; headquarters: string; reputation: number };
  aircraft: Aircraft[]; pilots: Pilot[]; completedMissions: number; flightHours: number;
  operationalTime: string; activeMissionId: string | null;
  pinnedApproach: PinnedApproach | null; activeFlightId: string | null; pendingReport: FlightDraft | null; logbook: FlightEntry[];
  recentDialogue: string[]; dispatcher: DispatcherLine | null; revision: number;
}
export const SAVE_KEY = 'airtruckers.save.v1';
export function createGame(name: string, seed = newFlightId()): Game {
  return { dispatch: refreshBoard(initialDispatch(seed), 'PADQ', '2026-06-01T08:00:00.000Z'), activeContract: null, pinnedApproach: null, activeMissionId: null, activeFlightId: null, pendingReport: null, logbook: [], recentDialogue: [], dispatcher: null, revision: 0, version: 1, company: { name: name.trim(), cash: 25000, headquarters: 'PADQ', reputation: 50 }, aircraft: [{ id: 'N208AT', model: 'Cessna 208B Grand Caravan EX', location: 'PADQ', hours: 0, ownership: 'owned', maintenance: 'Airworthy' }], pilots: [{ id: 'owner', role: 'Owner / Pilot', annualSalary: 65000 }], completedMissions: 0, flightHours: 0, operationalTime: '2026-06-01T08:00:00.000Z' };
}
export function advanceTime(game: Game, hours: number): Game {
  if (!Number.isFinite(hours) || hours <= 0 || hours > 168) throw new Error('Advance between 1 and 168 hours.');
  const operationalTime = new Date(Date.parse(game.operationalTime) + hours * 3600000).toISOString();
  return { ...game, operationalTime, dispatch: refreshBoard(game.dispatch, game.aircraft[0].location, operationalTime) };
}
const nonnegative = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const airport = (value: unknown): value is string => typeof value === 'string' && /^[A-Z0-9]{3,4}$/.test(value);
const timestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
function validateEntry(e: FlightEntry) {
  if (!e || typeof e.id !== 'string' || !e.id || !(e.contract ?? findContract(e.missionId)) || typeof e.title !== 'string' || typeof e.aircraftId !== 'string' || !airport(e.origin) || !airport(e.plannedDestination) || !airport(e.arrival) || typeof e.payload !== 'string' || !nonnegative(e.proposedPayout) || !nonnegative(e.revenue) || !timestamp(e.startedAt) || !timestamp(e.endedAt)) throw new Error('Invalid logbook entry.');
  const contract = e.contract ?? findContract(e.missionId)!;
  validateStoredContract(contract);
  if (contract.id !== e.missionId || contract.origin !== e.origin || contract.airport !== e.plannedDestination || contract.payout !== e.proposedPayout || contract.title !== e.title || contract.payload !== e.payload) throw new Error('Logbook contract snapshot mismatch.');
  validateDraft({ flightId: e.id, minutes: String(e.minutes), fuelLb: e.fuelLb === null ? '' : String(e.fuelLb), estimatedMinutes: e.estimatedMinutes === null ? '' : String(e.estimatedMinutes), estimatedFuelLb: e.estimatedFuelLb === null ? '' : String(e.estimatedFuelLb), arrival: e.arrival, delivery: e.delivery, landing: e.landing, notes: e.notes }, true);
  if (typeof e.minutes !== 'number' || (e.fuelLb !== null && typeof e.fuelLb !== 'number') || (e.estimatedMinutes !== null && typeof e.estimatedMinutes !== 'number') || (e.estimatedFuelLb !== null && typeof e.estimatedFuelLb !== 'number') || Date.parse(e.endedAt) - Date.parse(e.startedAt) !== e.minutes * 60000 || e.revenue !== (e.delivery === 'completed' ? e.proposedPayout : 0) || (e.delivery === 'completed' && e.arrival !== e.plannedDestination) || (e.delivery === 'diverted' && e.arrival === e.plannedDestination)) throw new Error('Inconsistent logbook entry.');
}
export function parseSave(raw: string): Game {
  const g = JSON.parse(raw) as Game;
  if (!g || g.version !== 1 || !g.company || typeof g.company.name !== 'string' || !g.company.name.trim() || !Number.isFinite(g.company.cash) || g.company.headquarters !== 'PADQ' || !Number.isFinite(g.company.reputation) || !Number.isInteger(g.completedMissions) || g.completedMissions < 0 || !nonnegative(g.flightHours) || !timestamp(g.operationalTime) || !Array.isArray(g.aircraft) || !g.aircraft.length || !g.aircraft.every(a => a && typeof a.id === 'string' && typeof a.model === 'string' && airport(a.location) && nonnegative(a.hours) && a.ownership === 'owned' && a.maintenance === 'Airworthy') || !Array.isArray(g.pilots) || !g.pilots.length || !g.pilots.every(p => p && typeof p.id === 'string' && p.role === 'Owner / Pilot' && nonnegative(p.annualSalary))) throw new Error('This save is damaged or uses an unsupported version. Your stored data has not been changed.');
  const activeMissionId = g.activeMissionId === undefined ? null : g.activeMissionId;
  const contract = activeMissionId === null ? undefined : typeof activeMissionId === 'string' ? (g.activeContract ?? findContract(activeMissionId)) : undefined;
  if (contract) { validateStoredContract(contract); if (contract.id !== activeMissionId) throw new Error('Active contract mismatch.'); }
  if (activeMissionId !== null && !contract) throw new Error('This save contains an unsupported mission. Your stored data has not been changed.');
  const additions = ['activeFlightId', 'pendingReport', 'logbook', 'recentDialogue', 'dispatcher', 'revision'] as const;
  // Older v0.1/v0.2 data has none of these fields. Deterministic IDs keep concurrent legacy tabs consistent.
  const legacy = additions.every(key => !(key in g));
  const normalized = legacy ? { ...g, activeMissionId, activeFlightId: activeMissionId ? `legacy:${activeMissionId}:${g.operationalTime}` : null, pendingReport: null, logbook: [], recentDialogue: [], dispatcher: null, revision: 0 } : { ...g, activeMissionId };
  if (!legacy && additions.some(key => !(key in g))) throw new Error('Incomplete flight save. Your stored data has not been changed.');
  if (('dispatch' in g) !== ('activeContract' in g)) throw new Error('Incomplete dispatch save.');
  const seed = `legacy-${hashSeed(`${g.company.name}:${g.operationalTime}:${g.aircraft[0].id}`).toString(16)}`;
  let dispatch = g.dispatch;
  if (dispatch === undefined) {
    dispatch = initialDispatch(seed);
    if (Array.isArray(normalized.logbook)) {
      for (const entry of normalized.logbook.slice(-6)) {
        const previous = entry?.contract ?? (entry ? findContract(entry.missionId) : undefined);
        if (previous) dispatch = rememberAssignment(dispatch, previous, entry.arrival);
      }
    }
    dispatch = refreshBoard(dispatch, g.aircraft[0].location, g.operationalTime);
  }
  validateDispatch(dispatch);
  const n: Game = { ...normalized, dispatch, activeContract: g.activeContract === undefined ? (contract ? cloneContract(contract) : null) : g.activeContract, pinnedApproach: normalized.pinnedApproach === undefined ? null : normalized.pinnedApproach };
  if (!Number.isSafeInteger(n.revision) || n.revision < 0 || !Array.isArray(n.logbook) || !Array.isArray(n.recentDialogue) || n.recentDialogue.length > 6 || !n.recentDialogue.every(id => typeof id === 'string') || (n.dispatcher !== null && (!n.dispatcher || typeof n.dispatcher.id !== 'string' || typeof n.dispatcher.text !== 'string')) || (n.activeMissionId === null ? n.activeFlightId !== null || n.pendingReport !== null : typeof n.activeFlightId !== 'string' || !n.activeFlightId || contract?.origin !== n.aircraft[0].location)) throw new Error('Invalid flight state. Your stored data has not been changed.');
  if ((n.activeMissionId === null) !== (n.activeContract === null) || (n.activeContract && n.activeContract.id !== n.activeMissionId)) throw new Error('Invalid active contract snapshot.');
  n.logbook.forEach(validateEntry);
  const assigned = n.logbook.filter(e => e.contract?.generated).map(e => e.missionId);
  if (n.activeContract?.generated) assigned.push(n.activeContract.id);
  const offered = Object.values(n.dispatch.boards).flatMap(board => board.offers.map(c => c.id));
  if (new Set([...assigned, ...offered]).size !== assigned.length + offered.length) throw new Error('Repeated generated assignment.');
  for (const c of [...n.logbook.flatMap(e => e.contract ? [e.contract] : []), ...(n.activeContract ? [n.activeContract] : [])]) if (c.generated && (c.generated.serial >= n.dispatch.nextSerial || c.id !== `gen-${n.dispatch.seed}-${c.generated.serial}`)) throw new Error('Invalid assignment sequence.');
  const ids = new Set(n.logbook.map(e => e.id));
  if (ids.size !== n.logbook.length || (n.activeFlightId && ids.has(n.activeFlightId))) throw new Error('Duplicate flight in save.');
  if (n.pendingReport !== null) {
    validateDraft(n.pendingReport);
    if (n.pendingReport.flightId !== n.activeFlightId) throw new Error('Draft does not match active flight.');
  }
  if (n.pinnedApproach !== null && (!n.pinnedApproach || n.pinnedApproach.flightId !== n.activeFlightId || !validChart(n.pinnedApproach.chart) || n.pinnedApproach.chart.type !== 'IAP' || !contract || ![contract.origin, contract.airport].includes(n.pinnedApproach.chart.airport))) throw new Error('Invalid pinned approach in save.');
  return n;
}
function acknowledge(game: Game, event: DialogueEvent, report?: FlightDraft): Game {
  const line = selectDialogue(event, getActiveContract(game), report, game.recentDialogue);
  return { ...game, dispatcher: line, recentDialogue: [line.id, ...game.recentDialogue.filter(id => id !== line.id)].slice(0, 6) };
}
function newFlightId(): string {
  // getRandomValues also works in older Safari and non-secure LAN contexts where
  // randomUUID/Web Locks may be absent. Never use timestamps or Math.random as IDs.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
export function acceptMission(game: Game, id: string): Game {
  if (game.activeMissionId !== null) throw new Error('Cancel your active mission before selecting another contract.');
  const contract = offeredContracts(game).find(contract => contract.id === id);
  if (!contract) throw new Error('Unknown or expired contract. Choose a current offered assignment.');
  validateStoredContract(contract);
  if (game.logbook.some(entry => entry.missionId === contract.id)) throw new Error('This assignment is already closed.');
  if (!contract.generated || Date.parse(contract.generated.expiresAt) <= Date.parse(game.operationalTime)) throw new Error('This offer has expired.');
  if (contract.origin !== game.aircraft[0].location) throw new Error('Contract does not depart from the aircraft’s current airport.');
  const dispatch = { ...game.dispatch, boards: Object.fromEntries(Object.entries(game.dispatch.boards).map(([airport, board]) => [airport, { ...board, offers: board.offers.filter(offer => offer.id !== id) }])) };
  return acknowledge({ ...game, dispatch, activeContract: cloneContract(contract), activeMissionId: id, activeFlightId: newFlightId(), pendingReport: null }, 'accepted');
}
export function cancelMission(game: Game): Game {
  if (!game.activeMissionId) return game;
  return { ...acknowledge(game, 'cancelled'), activeMissionId: null, activeContract: null, activeFlightId: null, pendingReport: null, pinnedApproach: null };
}
export function reportFor(game: Game): FlightDraft {
  const contract = getActiveContract(game);
  if (!contract || !game.activeFlightId) throw new Error('No active mission.');
  return game.pendingReport ?? blankDraft(game.activeFlightId, contract.airport);
}
export function saveFlightDraft(game: Game, report: FlightDraft): Game {
  validateDraft(report);
  if (!game.activeFlightId || report.flightId !== game.activeFlightId) throw new Error('This flight is no longer active.');
  return acknowledge({ ...game, pendingReport: { ...report } }, 'draft');
}
export function submitFlightReport(game: Game, report: FlightDraft): Game {
  validateDraft(report, true);
  if (game.logbook.some(entry => entry.id === report.flightId)) throw new Error('This flight report has already been submitted.');
  const contract = getActiveContract(game);
  if (!contract || !game.activeFlightId || report.flightId !== game.activeFlightId || contract.origin !== game.aircraft[0].location) throw new Error('This flight is no longer active.');
  validateStoredContract(contract);
  if (contract.generated && game.logbook.some(entry => entry.missionId === contract.id)) throw new Error('This assignment has already been closed.');
  if (report.delivery === 'completed' && report.arrival !== contract.airport) throw new Error('A completed delivery must arrive at the contract destination.');
  if (report.delivery === 'diverted' && report.arrival === contract.airport) throw new Error('For a diversion, enter the actual alternate airport.');
  const minutes = numericInput(report.minutes, 'minutes', true)!;
  const endedAt = new Date(Date.parse(game.operationalTime) + minutes * 60000).toISOString();
  const revenue = report.delivery === 'completed' ? contract.payout : 0;
  const entry: FlightEntry = { contract: cloneContract(contract), id: report.flightId, missionId: contract.id, title: contract.title, aircraftId: game.aircraft[0].id, origin: contract.origin, plannedDestination: contract.airport, arrival: report.arrival, payload: contract.payload, proposedPayout: contract.payout, revenue, minutes, fuelLb: numericInput(report.fuelLb, 'fuel'), estimatedMinutes: numericInput(report.estimatedMinutes, 'minutes'), estimatedFuelLb: numericInput(report.estimatedFuelLb, 'fuel'), delivery: report.delivery, landing: report.landing, notes: report.notes, startedAt: game.operationalTime, endedAt };
  const next = acknowledge(game, 'submitted', report);
  const dispatch = refreshBoard(rememberAssignment(game.dispatch, contract, report.arrival), report.arrival, endedAt, true);
  return { ...next, dispatch, company: { ...game.company, cash: game.company.cash + revenue }, aircraft: game.aircraft.map((a, i) => i === 0 ? { ...a, location: report.arrival, hours: a.hours + minutes / 60 } : a), completedMissions: game.completedMissions + (report.delivery === 'completed' ? 1 : 0), flightHours: game.flightHours + minutes / 60, operationalTime: endedAt, logbook: [...game.logbook, entry], activeMissionId: null, activeContract: null, activeFlightId: null, pendingReport: null, pinnedApproach: null };
}
// One versioned document commits cash, clock, aircraft, draft and logbook together.
export const localSaveRepository = {
  load(): Game | null { const raw = localStorage.getItem(SAVE_KEY); return raw === null ? null : parseSave(raw); },
  save(game: Game) { localStorage.setItem(SAVE_KEY, JSON.stringify(game)); },
  async commit(expected: Game | null, next: Game): Promise<Game> {
    return withSaveCoordination(SAVE_KEY, () => {
      const current = localSaveRepository.load();
      if (JSON.stringify(current) !== JSON.stringify(expected)) throw new Error('The save changed in another tab. Refresh before continuing; no changes were applied.');
      const committed = parseSave(JSON.stringify({ ...next, revision: (current?.revision ?? 0) + 1 }));
      localSaveRepository.save(committed); // A quota failure must not update the UI or pay revenue in memory.
      return committed;
    });
  },
};

export function pinApproach(game: Game, chart: Chart, catalog: ChartCatalog, now = Date.now()): Game {
  const mission = getActiveContract(game);
  if (!mission || !game.activeFlightId || !validChart(chart) || chart.type !== 'IAP' || ![mission.origin, mission.airport].includes(chart.airport) || catalog.airport !== chart.airport || catalog.status !== 'current' || !chartCurrent(chart, now) || !catalog.charts.some(item => JSON.stringify(item) === JSON.stringify(chart))) throw new Error('Select an available, current FAA approach from this mission’s verified catalog.');
  return { ...game, pinnedApproach: { flightId: game.activeFlightId, chart: { ...chart } } };
}

function validateStoredContract(contract: Contract): void {
  if (contract.generated) validateGenerated(contract);
  else if (JSON.stringify(contract) !== JSON.stringify(findContract(contract.id))) throw new Error('Unsupported legacy contract snapshot.');
}
export function getActiveContract(game: Game): Contract | undefined { return game.activeContract ?? undefined; }
export function offeredContracts(game: Game): Contract[] { return game.dispatch.boards[game.aircraft[0].location]?.offers ?? []; }

function cloneContract(contract: Contract): Contract { return JSON.parse(JSON.stringify(contract)) as Contract; }
