import { getActiveContract, offeredContracts, type Game } from './game';
export interface DispatcherContext {
  readonly schema: 1;
  readonly company: { readonly name: string; readonly cash: number; readonly operationalTime: string };
  readonly aircraft: { readonly id: string; readonly location: string; readonly hours: number };
  readonly status: 'available' | 'no-offers' | 'accepted' | 'draft';
  readonly assignment: Readonly<{ id: string; title: string; category: string; customer: string; origin: string; destination: string; payload: string; payout: number }> | null;
  readonly available: readonly Readonly<{ id: string; title: string; category: string; origin: string; destination: string }>[];
  readonly recent: readonly Readonly<{ title: string; customer: string; storyline: string; payloadFamily: string }>[];
  readonly lastReport: Readonly<{ delivery: string; landing: string; minutes: number; revenue: number }> | null;
}
function freeze<T>(value: T): T { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
// Structured local snapshot for future read-only conversation. No commands, API calls or mutation capability.
export function createDispatcherContext(game: Game): DispatcherContext {
  const contract = getActiveContract(game), last = game.logbook.at(-1);
  return freeze({ schema: 1, company: { name: game.company.name, cash: game.company.cash, operationalTime: game.operationalTime }, aircraft: { id: game.aircraft[0].id, location: game.aircraft[0].location, hours: game.aircraft[0].hours }, status: game.pendingReport ? 'draft' : contract ? 'accepted' : offeredContracts(game).length ? 'available' : 'no-offers', assignment: contract ? { id: contract.id, title: contract.title, category: contract.generated?.category ?? contract.type, customer: contract.generated?.customer ?? 'Legacy customer', origin: contract.origin, destination: contract.airport, payload: contract.payload, payout: contract.payout } : null, available: offeredContracts(game).map(c => ({ id: c.id, title: c.title, category: c.generated?.category ?? c.type, origin: c.origin, destination: c.airport })), recent: game.dispatch.recent.map(r => ({ title: r.title, customer: r.customer, storyline: r.templateId, payloadFamily: r.payloadFamily })), lastReport: last ? { delivery: last.delivery, landing: last.landing, minutes: last.minutes, revenue: last.revenue } : null });
}
