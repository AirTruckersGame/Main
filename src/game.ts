import { findContract } from './missions';
export interface Aircraft { id: string; model: string; location: string; hours: number; ownership: 'owned'; maintenance: 'Airworthy' }
export interface Pilot { id: string; role: 'Owner / Pilot'; annualSalary: number; }
export interface Game { version: 1; company: { name: string; cash: number; headquarters: string; reputation: number }; aircraft: Aircraft[]; pilots: Pilot[]; completedMissions: number; flightHours: number; operationalTime: string; activeMissionId: string | null; }
export const SAVE_KEY = 'airtruckers.save.v1';
export function createGame(name: string): Game {
  return { activeMissionId: null, version: 1, company: { name: name.trim(), cash: 25000, headquarters: 'PADQ', reputation: 50 }, aircraft: [{ id: 'N208AT', model: 'Cessna 208B Grand Caravan EX', location: 'PADQ', hours: 0, ownership: 'owned', maintenance: 'Airworthy' }], pilots: [{ id: 'owner', role: 'Owner / Pilot', annualSalary: 65000 }], completedMissions: 0, flightHours: 0, operationalTime: '2026-06-01T08:00:00.000Z' };
}
export function advanceTime(game: Game, hours: number): Game {
  if (!Number.isFinite(hours) || hours <= 0 || hours > 168) throw new Error('Advance between 1 and 168 hours.');
  return { ...game, operationalTime: new Date(Date.parse(game.operationalTime) + hours * 3600000).toISOString() };
}
export function parseSave(raw: string): Game {
  const g = JSON.parse(raw) as Game;
  if (!g || g.version !== 1 || !g.company || typeof g.company.name !== 'string' || !g.company.name.trim() || !Number.isFinite(g.company.cash) || g.company.headquarters !== 'PADQ' || !Number.isFinite(g.company.reputation) || !Number.isFinite(g.completedMissions) || !Number.isFinite(g.flightHours) || typeof g.operationalTime !== 'string' || !Number.isFinite(Date.parse(g.operationalTime)) || !Array.isArray(g.aircraft) || !g.aircraft.length || !g.aircraft.every(a => a && typeof a.id === 'string' && typeof a.model === 'string' && typeof a.location === 'string' && Number.isFinite(a.hours) && a.ownership === 'owned' && a.maintenance === 'Airworthy') || !Array.isArray(g.pilots) || !g.pilots.length || !g.pilots.every(p => p && typeof p.id === 'string' && p.role === 'Owner / Pilot' && Number.isFinite(p.annualSalary))) throw new Error('This save is damaged or uses an unsupported version. Your stored data has not been changed.');
  // Keep the original storage key and schema version; normalize pre-dispatch saves.
  if (g.activeMissionId === undefined) return { ...g, activeMissionId: null };
  if (g.activeMissionId !== null && (typeof g.activeMissionId !== 'string' || !findContract(g.activeMissionId))) throw new Error('This save contains an unsupported mission. Your stored data has not been changed.');
  return g;
}
// Storage boundary: replace this adapter with a cloud repository in a future version.
export const localSaveRepository = { load(): Game | null { const raw = localStorage.getItem(SAVE_KEY); return raw === null ? null : parseSave(raw); }, save(game: Game) { localStorage.setItem(SAVE_KEY, JSON.stringify(game)); } };

export function acceptMission(game: Game, id: string): Game {
  if (game.activeMissionId !== null) throw new Error('Cancel your active mission before selecting another contract.');
  if (!findContract(id)) throw new Error('Unknown contract.');
  return { ...game, activeMissionId: id };
}
export function cancelMission(game: Game): Game {
  return { ...game, activeMissionId: null };
}
