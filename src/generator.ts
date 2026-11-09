import type { Contract, MissionCategory } from './missions';
export const LOADING = Object.freeze({ usefulBudgetLb: 2800, crewLb: 220, fuelLb: 1400, marginLb: 180, payloadLimitLb: 1000, passengerLb: 220, bagPerPassengerLb: 25, maxPassengers: 4 });
export const HOME_BASE = 'PADQ';
export const SLOT_HOURS = 6, RECENT_WINDOW = 6, BOARD_SIZE = 4;
export const airports = {
  PADQ: { name: 'Kodiak', lat: 57.7498, lon: -152.4939 },
  PALB: { name: 'Larsen Bay', lat: 57.5351, lon: -153.9767 },
  PAKH: { name: 'Akhiok', lat: 56.9387, lon: -154.1826 },
  PAHO: { name: 'Homer', lat: 59.6455, lon: -151.4766 },
  PAEN: { name: 'Kenai', lat: 60.5733, lon: -151.2448 },
} as const;
// Simulated routes connect the five curated airports in either direction.
export function destinations(origin: string): string[] {
  return Object.prototype.hasOwnProperty.call(airports, origin) ? Object.keys(airports).filter(airport => airport !== origin) : [];
}
export function distanceNm(origin: string, destination: string): number {
  const a = airports[origin as keyof typeof airports], b = airports[destination as keyof typeof airports];
  if (!a || !b || origin === destination) throw new Error('Unsupported route.');
  const rad = (n: number) => n * Math.PI / 180;
  const value = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return Math.round(3440.065 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)));
}
interface Template { id: string; category: MissionCategory; title: string; family: string; manifest: string; story: string; requirement: string; premium: number }
const define = (category: MissionCategory, rows: [string, string, string, string, string, string, number][]): Template[] => rows.map(([id, title, family, manifest, story, requirement, premium]) => ({ id, category, title, family, manifest, story, requirement, premium }));
export const templates: readonly Template[] = [
  ...define('General cargo', [
    ['workshop', 'Back to the workbench', 'mechanical supplies', 'Secured cases of workshop tools', 'A repair crew has scheduled the next job around this delivery. They would rather wait than have an unsecured case arrive early.', 'Restrain dense cases and verify load distribution.', 1],
    ['textiles', 'Packed for the long season', 'textiles', 'Boxes of workwear and protective clothing', 'The stores coordinator has sorted sizes by crew. Keeping the labelled boxes together will save a cold morning of sorting.', 'Keep cartons dry and secure them clear of exits.', 1],
    ['packaging', 'Room for the next shipment', 'paper supplies', 'Flat-packed cartons and reusable packing materials', 'The shipping office has freight to send but no sound boxes left. Unglamorous work still keeps the island moving.', 'Account for bulky volume as well as weight.', 1],
  ]),
  ...define('Commercial resupply', [
    ['pantry', 'Stocking the pantry', 'dry groceries', 'Sealed dry-grocery cartons', 'A small shop is preparing its regular restock. Nothing is an emergency; getting the inventory right matters more than beating the weather.', 'Verify carton counts; protect food from contamination.', 1.05],
    ['linens', 'A fresh set for the lodge', 'textiles', 'Bagged linens and guest supplies', 'The lodge has a changeover approaching and its shelves are getting thin. The manager has packed the order by room.', 'Keep soft bags restrained and away from cabin controls.', 1.05],
    ['hardware', 'Keeping the counter stocked', 'mechanical supplies', 'Crated hardware and fastener stock', 'The hardware counter has a list of back orders for local workshops. A small crate can finish a surprising number of jobs.', 'Distribute dense hardware instead of loading one concentrated stack.', 1.05],
  ]),
  ...define('Medical logistics', [
    ['dressings', 'Supplies for the treatment room', 'clinic supplies', 'Sealed nonhazardous dressings and examination supplies', 'The clinic coordinator is replenishing routine treatment-room stock. This is scheduled logistics, not an emergency medical flight.', 'Keep sterile packaging intact; no patient transport or hazardous material.', 1.15],
    ['diagnostics', 'Ready for the next appointment', 'fragile instruments', 'Protected cases of nonhazardous diagnostic accessories', 'A visiting clinician needs the accessories packed with the equipment. The appointment schedule is flexible if conditions are not.', 'Secure fragile cases; no unverified temperature-control promise.', 1.15],
    ['mobility', 'A little more independence', 'clinic supplies', 'Packed walking aids and accessibility supplies', 'The community care team has assembled a practical order for residents. Handle it as carefully as you would your own equipment.', 'Check dimensions and restraint points before accepting the load.', 1.15],
  ]),
  ...define('Government / infrastructure', [
    ['water', 'Parts for the water crew', 'infrastructure components', 'Packaged water-system filters and seals', 'A maintenance team is conducting a planned service visit. The water crew has already checked the parts list twice.', 'Confirm clean, nonhazardous contents and secure the cases.', 1.1],
    ['survey', 'Marking the next project', 'fragile instruments', 'Survey instruments and marked reference stakes', 'A public works team is preparing a site survey. They can rearrange the work day around a safe arrival.', 'Protect instrument cases and separate loose stakes from cabin access.', 1.1],
    ['lighting', 'Light for the working day', 'infrastructure components', 'Nonhazardous lighting fittings and cable stock', 'The maintenance planner has bundled replacement fittings for a scheduled job. These are ordinary building supplies, not airfield equipment.', 'Check declared contents; no loose batteries or hazardous goods.', 1.1],
  ]),
  ...define('Priority freight', [
    ['documents', 'The signed originals', 'business records', 'Sealed business records and archive cases', 'A coordinator needs the signed originals for the next review. The request is priority, not permission to rush a flight.', 'Keep document cases dry; no real-time deadline or penalty.', 1.25],
    ['bearings', 'One part, one stalled job', 'mechanical supplies', 'Crated replacement bearings and service hardware', 'A workshop has paused a machine until its replacement parts arrive. The crew will use the wait for other work.', 'Verify weight and restraints; commercial urgency never overrides planning.', 1.25],
    ['printing', 'Before the next print run', 'paper supplies', 'Sealed print stock and nonhazardous press supplies', 'The print shop has accepted a community order and needs its materials. They have left room in the schedule for Alaska.', 'Protect materials from moisture and inspect the manifest.', 1.25],
  ]),
  ...define('Community delivery', [
    ['school', 'The next classroom project', 'education materials', 'Books and boxed classroom project materials', 'A teacher has planned a practical project with the new supplies. The class will start when the boxes arrive, not before the weather clears.', 'Keep labelled sets together and prevent carton movement.', 1],
    ['sports', 'Equipment for the weekend', 'sports equipment', 'Bagged sports equipment and protective pads', 'A recreation volunteer has gathered equipment for local teams. They asked for a sensible flight, not a heroic one.', 'Secure awkward shapes and keep cabin exits clear.', 1],
    ['library', 'Stories for the reading room', 'education materials', 'Crates of circulating library books', 'The reading-room volunteers have traded their winter collection. Every crate has a return label ready for a later trip.', 'Dense book crates need careful distribution; no automatic return assignment.', 1],
  ]),
  ...define('Passenger charter', [
    ['visitors', 'A visit across the water', 'passenger groups', 'Passengers and personal baggage', 'A family group has arranged a private visit. They can call ahead if the flight needs to wait.', 'Brief every passenger and verify actual seat, baggage and balance limits.', 1.2],
    ['technicians', 'The travelling service crew', 'passenger groups', 'Technicians with personal baggage', 'A service team is travelling to meet colleagues; their tools are being handled separately. They have kept the appointment flexible.', 'Personal baggage only; no undeclared tools or dangerous goods.', 1.2],
    ['council', 'Seats for the community meeting', 'passenger groups', 'Community representatives and personal baggage', 'A small group is travelling for a scheduled discussion. Starting later is better than making the wrong flying decision.', 'Complete a cabin briefing and weigh actual passengers and bags.', 1.2],
  ]),
];
export const customers = ['Alder Coast Cooperative', 'North Reach Services', 'Harborlight Supply', 'Island Work Network', 'Spruce Point Logistics', 'Tidal Ridge Partners', 'Bayline Coordination', 'Kodiak Community Exchange', 'North Passage Dispatch', 'Coastal Projects Office', 'Salmonberry Services', 'Quiet Water Supply', 'Peninsula Outreach', 'Cedar Bay Trading', 'Island Care Coordination', 'Harbor Desk Logistics', 'Ridgeway Operations', 'Western Shore Cooperative', 'Sea Lantern Services', 'Cross Bay Coordination', 'Alaska Local Exchange', 'Compass Point Partners', 'Open Water Supply', 'Morning Tide Projects'] as const;
export interface RecentAssignment { id: string; title: string; templateId: string; customer: string; payloadFamily: string }
export interface Board { epoch: number; offers: Contract[] }
export interface DispatchState { schema: 1; seed: string; nextSerial: number; boards: Record<string, Board>; recent: RecentAssignment[]; lastLeg: { origin: string; arrival: string } | null; }
export function hashSeed(seed: string): number { let value = 2166136261; for (const c of seed) { value ^= c.charCodeAt(0); value = Math.imul(value, 16777619); } return value >>> 0; }
function random(seed: string) { let value = hashSeed(seed); return () => { value += 0x6D2B79F5; let t = value; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const epochFor = (time: string) => Math.floor(Date.parse(time) / (SLOT_HOURS * 3600000));
export function initialDispatch(seed: string): DispatchState { if (!/^[A-Za-z0-9_-]{1,100}$/.test(seed)) throw new Error('Invalid dispatch seed.'); return { schema: 1, seed, nextSerial: 1, boards: {}, recent: [], lastLeg: null }; }
export function fingerprint(contract: Contract): RecentAssignment { return { id: contract.id, title: contract.title, templateId: contract.generated?.templateId ?? `legacy:${contract.id}`, customer: contract.generated?.customer ?? 'Legacy customer', payloadFamily: contract.generated?.payloadFamily ?? contract.payload }; }
function conflicts(contract: Contract, recent: RecentAssignment[]): boolean { const f = fingerprint(contract); return recent.some(r => r.title === f.title || r.templateId === f.templateId || r.customer === f.customer || r.payloadFamily === f.payloadFamily); }
export function rememberAssignment(state: DispatchState, contract: Contract, arrival: string): DispatchState {
  const recent = contract.type === 'Repositioning' ? state.recent : [fingerprint(contract), ...state.recent].slice(0, RECENT_WINDOW);
  // Filter all saved boards, not just the departure: anti-repeat survives a round trip.
  const boards = Object.fromEntries(Object.entries(state.boards).map(([airport, board]) => [airport, { ...board, offers: board.offers.filter(offer => !conflicts(offer, recent) && offer.id !== contract.id) }]));
  return { ...state, recent, boards, lastLeg: { origin: contract.origin, arrival } };
}
export function refreshBoard(state: DispatchState, origin: string, time: string, force = false): DispatchState {
  const epoch = epochFor(time);
  const previous = state.boards[origin];
  const routes = destinations(origin);
  const away = origin !== HOME_BASE;
  const alternatives = routes.filter(route => route !== HOME_BASE);
  const minimum = routes.length ? (away ? 2 : 3) : 0;
  const commercialLimit = BOARD_SIZE - Number(away);
  const saved = previous?.epoch === epoch ? previous.offers : [];
  const returning = saved.find(offer => offer.type === 'Repositioning');
  const paid = saved.filter(offer => offer.type !== 'Repositioning' && !conflicts(offer, state.recent));
  const served = new Set(paid.map(offer => offer.airport));
  const coverage = alternatives.filter(route => served.has(route)).length;
  if (!force && previous?.epoch === epoch && coverage >= minimum && (!away || returning)) return state;

  // Keep existing offers unless they occupy space needed for missing destinations.
  const distinct = new Set<string>();
  const preferred = paid.filter(offer => {
    if (offer.airport === HOME_BASE || distinct.has(offer.airport) || distinct.size === commercialLimit) return false;
    distinct.add(offer.airport);
    return true;
  });
  const spareSlots = commercialLimit - Math.max(minimum, preferred.length);
  const extras = paid.filter(offer => !preferred.includes(offer)).slice(0, spareSlots);
  const offers = paid.filter(offer => preferred.includes(offer) || extras.includes(offer));
  let serial = state.nextSerial;
  const rng = random(`${state.seed}:${origin}:${epoch}:${serial}`);
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(rng() * items.length)];
  const recent = [...state.recent, ...offers.map(fingerprint)];
  const expiresAt = new Date((epoch + 1) * SLOT_HOURS * 3600000).toISOString();
  for (let i = offers.length; i < commercialLimit && routes.length; i++) {
    const eligible = templates.filter(t => !recent.some(r => r.templateId === t.id || r.title === t.title || r.payloadFamily === t.family));
    const clients = customers.filter(customer => !recent.some(r => r.customer === customer));
    if (!eligible.length || !clients.length) break;
    const unservedAlternatives = alternatives.filter(route => !distinct.has(route));
    const unusedRoutes = routes.filter(route => !offers.some(offer => offer.airport === route));
    const choices = distinct.size < minimum ? unservedAlternatives : unusedRoutes;
    const template = pick(eligible), customer = pick(clients), destination = pick(choices.length ? choices : routes);
    if (destination !== HOME_BASE) distinct.add(destination);
    const passengers = template.category === 'Passenger charter' ? 1 + Math.floor(rng() * LOADING.maxPassengers) : 0;
    const cargoLb = passengers ? 0 : (12 + Math.floor(rng() * 84)) * 10;
    const passengerLb = passengers * LOADING.passengerLb, baggageLb = passengers * LOADING.bagPerPassengerLb;
    const payloadLb = cargoLb + passengerLb + baggageLb, distance = distanceNm(origin, destination);
    const payout = Math.min(3000, Math.round((350 + distance * 7 + payloadLb * 0.45) * template.premium / 25) * 25);
    const contract: Contract = { id: `gen-${state.seed}-${serial}`, origin, airport: destination, destination: airports[destination as keyof typeof airports].name, title: template.title, type: passengers ? 'Passenger charter' : 'Cargo', distanceNm: distance, payout, payloadLb, payload: passengers ? `${passengers} passengers (${passengerLb} lb) and personal baggage (${baggageLb} lb)` : `${template.manifest} (${cargoLb} lb)`, story: `Mara: “${customer} called. ${template.story}”`, considerations: `${template.requirement} Use actual simulator loading, fuel, weather, runway and performance data; this is a fictional request, not an operating clearance.`, generated: { schema: 1, serial, category: template.category, templateId: template.id, customer, payloadFamily: template.family, passengers, passengerLb, baggageLb, cargoLb, fuelAssumptionLb: LOADING.fuelLb, offeredAt: time, expiresAt } };
    validateGenerated(contract); offers.push(contract); recent.push(fingerprint(contract)); serial++;
  }
  if (away) {
    offers.push(returning ?? returnToHome(state.seed, serial++, origin, time, expiresAt));
  }
  // A diversion can introduce any airport code. Keep only the current
  // off-network board so one-off repositioning offers cannot fill the save.
  const boards = Object.fromEntries(Object.entries(state.boards).filter(([airport]) => destinations(airport).length));
  return { ...state, nextSerial: serial, boards: { ...boards, [origin]: { epoch, offers } } };
}
const distanceToHome = (origin: string) => destinations(origin).includes(HOME_BASE) ? distanceNm(origin, HOME_BASE) : null;
function returnToHome(seed: string, serial: number, origin: string, offeredAt: string, expiresAt: string): Contract {
  return {
    id: `gen-${seed}-${serial}`, origin, airport: HOME_BASE, destination: airports[HOME_BASE].name,
    title: 'Return to Home', type: 'Repositioning',
    distanceNm: distanceToHome(origin),
    payout: 0, payloadLb: 0, payload: 'Empty aircraft · no cargo or passengers',
    story: 'Mara: “You can take the Caravan back to Kodiak empty. There’s no contract payout for this leg.”',
    considerations: 'Plan the flight in the simulator and verify fuel, weather and runway conditions.',
    generated: {
      schema: 1, serial, category: 'Repositioning', templateId: 'return-home', customer: 'Company flight',
      payloadFamily: 'empty aircraft', passengers: 0, passengerLb: 0, baggageLb: 0, cargoLb: 0,
      fuelAssumptionLb: LOADING.fuelLb, offeredAt, expiresAt,
    },
  };
}
export function validateGenerated(contract: Contract): void {
  const g = contract?.generated;
  const invalid = 'Invalid generated assignment.';
  if (!g || g.schema !== 1 || !Number.isSafeInteger(g.serial) || g.serial < 1 ||
      typeof contract.id !== 'string' || !/^gen-[A-Za-z0-9_-]+-\d+$/.test(contract.id) ||
      ![g.templateId, g.payloadFamily, g.customer, contract.title, contract.payload, contract.story, contract.considerations].every(value => typeof value === 'string' && value) ||
      contract.title.length > 160 || !Number.isFinite(Date.parse(g.offeredAt)) ||
      !Number.isFinite(Date.parse(g.expiresAt)) || Date.parse(g.expiresAt) <= Date.parse(g.offeredAt)) throw new Error(invalid);
  if (contract.type === 'Repositioning') {
    if (typeof contract.origin !== 'string' || !/^[A-Z0-9]{3,4}$/.test(contract.origin) || contract.origin === HOME_BASE ||
        contract.airport !== HOME_BASE || contract.destination !== airports[HOME_BASE].name ||
        contract.distanceNm !== distanceToHome(contract.origin) || contract.payout !== 0 || contract.payloadLb !== 0 ||
        g.category !== 'Repositioning' || g.passengers !== 0 || g.passengerLb !== 0 || g.baggageLb !== 0 ||
        g.cargoLb !== 0 || g.fuelAssumptionLb !== LOADING.fuelLb) throw new Error(invalid);
    return;
  }
  if (!destinations(contract.origin).includes(contract.airport) || contract.destination !== airports[contract.airport as keyof typeof airports]?.name || contract.distanceNm !== distanceNm(contract.origin, contract.airport) || !templates.some(t => t.category === g.category) || !Number.isInteger(g.passengers) || g.passengers < 0 || g.passengers > LOADING.maxPassengers || !Number.isFinite(g.cargoLb) || g.cargoLb < 0 || g.cargoLb > 950 || g.passengerLb !== g.passengers * LOADING.passengerLb || g.baggageLb !== g.passengers * LOADING.bagPerPassengerLb || contract.payloadLb !== g.cargoLb + g.passengerLb + g.baggageLb || contract.payloadLb <= 0 || contract.payloadLb > LOADING.payloadLimitLb || g.fuelAssumptionLb !== LOADING.fuelLb || g.fuelAssumptionLb + LOADING.crewLb + LOADING.marginLb + contract.payloadLb > LOADING.usefulBudgetLb || (g.category === 'Passenger charter' ? contract.type !== 'Passenger charter' || !g.passengers || g.cargoLb !== 0 : contract.type !== 'Cargo' || g.passengers !== 0) || !Number.isInteger(contract.payout) || contract.payout < 350 || contract.payout > 3000) throw new Error(invalid);
}
export function validateDispatch(state: DispatchState): void {
  if (!state || state.schema !== 1 || typeof state.seed !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(state.seed) || !Number.isSafeInteger(state.nextSerial) || state.nextSerial < 1 || !state.boards || typeof state.boards !== 'object' || Array.isArray(state.boards) || Object.keys(state.boards).length > 20 || !Array.isArray(state.recent) || state.recent.length > RECENT_WINDOW || !state.recent.every(r => r && ['id', 'title', 'templateId', 'customer', 'payloadFamily'].every(k => typeof r[k as keyof RecentAssignment] === 'string')) || (state.lastLeg !== null && (!state.lastLeg || typeof state.lastLeg.origin !== 'string' || typeof state.lastLeg.arrival !== 'string'))) throw new Error('Invalid dispatch save.');
  const ids = new Set<string>();
  for (const [origin, board] of Object.entries(state.boards)) {
    if (!board || !Number.isSafeInteger(board.epoch) || !Array.isArray(board.offers) || board.offers.length > BOARD_SIZE) throw new Error('Invalid dispatch board.');
    for (const contract of board.offers) { validateGenerated(contract); if (contract.origin !== origin || contract.generated!.serial >= state.nextSerial || contract.id !== `gen-${state.seed}-${contract.generated!.serial}` || ids.has(contract.id) || conflicts(contract, state.recent)) throw new Error('Invalid dispatch assignment identity.'); ids.add(contract.id); }
  }
}
