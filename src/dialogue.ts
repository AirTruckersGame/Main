import type { Contract } from './missions';
import type { FlightDraft } from './reports';
export type DialogueEvent = 'accepted' | 'draft' | 'submitted' | 'cancelled';
export interface DispatcherLine { id: string; text: string }
const variants: Record<string, string[]> = {
  acceptedCargo: ['Cargo booked. Check the load before you turn the key.', 'Manifest is yours. Keep those boxes where you put them.', 'Cargo reserved. The island can wait for a proper preflight.'],
  acceptedPassenger: ['Charter booked. Give them a clear briefing.', 'Passengers assigned. A calm cabin starts on the ground.', 'Charter reserved. Let the passengers enjoy the view, not the surprises.'],
  draft: ['Report held. We will settle the books when you are ready.', 'Draft saved. Nothing moves on the ledger yet.', 'Park the paperwork here. We will pick it up later.'],
  cancelled: ['Contract released. No charge.', 'Back on the board. No penalty.', 'Cancelled. Better a clear decision than a rushed departure.'],
  divertedHard: ['Diversion and hard landing noted. No delivery payment; assess the aircraft before another flight.', 'Unpaid diversion recorded, including the hard landing. Inspect before continuing.', 'Hard landing at the alternate logged. Delivery remains unfulfilled; check the aircraft.'],
  diverted: ['Diversion logged, no delivery payment. Sensible decisions beat tidy schedules.', 'Alternate arrival recorded. We have not paid an undelivered load.', 'Diversion noted. The delivery is unfinished; the flight still counts as flying.'],
  incompleteHard: ['Incomplete delivery and hard landing logged. No revenue; check the aircraft.', 'Report filed without payment. Hard landing noted for your inspection.', 'Delivery unfinished, hard landing recorded. Assess the aircraft before continuing.'],
  incomplete: ['Flight logged. Delivery unfinished, so no contract revenue.', 'Report filed without payment. We will leave that delivery marked incomplete.', 'Incomplete delivery noted. Hours count; contract payment does not.'],
  hard: ['Delivery recorded. Hard landing noted; assess the aircraft before flying again.', 'Revenue posted. That hard landing is on record, not hidden in the totals.', 'Report filed, including the hard landing. Check the aircraft before the next leg.'],
  longer: ['Delivery logged. Longer than your estimate; use the actual time for the next plan.', 'Revenue posted. The clock ran past your plan. Worth a look before the next leg.', 'Report received. More minutes than planned; the weather does not read schedules.'],
  fuel: ['Delivery logged. Fuel exceeded your estimate; review the plan before the next leg.', 'Revenue posted. Your reported fuel is above plan. Check the assumptions.', 'Report filed. Fuel ran higher than your estimate; keep that in the next briefing.'],
  completedCargo: ['Cargo delivered. Revenue is in the company account.', 'Load delivered, books updated. Nicely done.', 'Cargo receipt logged. The company gets the revenue; salary stays separate.'],
  completedPassenger: ['Charter complete. Company revenue posted.', 'Passengers delivered, report filed. A quiet finish is a good finish.', 'Charter revenue logged. Thanks for bringing everyone through.'],
};

const categoryNotes: Record<string, [string, string, string]> = {
  'General cargo': ['Check the load, then the route. The boxes can wait.', 'Ordinary freight still deserves proper restraints.', 'Manifest ready. Keep the cargo where you put it.'],
  'Commercial resupply': ['Restock booked. The shelf labels are not a departure clearance.', 'The shop can wait for a sensible flight.', 'Supply run noted. Count the cartons before you close up.'],
  'Medical logistics': ['Routine clinic logistics, not an emergency clearance.', 'Keep the medical packaging intact. Safe arrival comes first.', 'Clinic supplies booked. No heroics on the paperwork.'],
  'Government / infrastructure': ['Public works load noted. Check the declared contents.', 'The maintenance crew will plan around a safe arrival.', 'Infrastructure job booked. Survey stakes make poor loose baggage.'],
  'Priority freight': ['Priority is a billing label, not a weather forecast.', 'Urgent freight booked. The safety margins stay ordinary.', 'They would like it soon. We would like it there intact.'],
  'Community delivery': ['Community load booked. Small boxes, useful work.', 'The volunteers can adjust their schedule to yours.', 'Local delivery noted. Keep the labelled sets together.'],
  'Passenger charter': ['Charter booked. Brief the cabin before the view distracts everyone.', 'Seats reserved. Check actual weights, not optimistic guesses.', 'Passenger job noted. A calm flight starts with a calm briefing.'],
};
for (const [category, notes] of Object.entries(categoryNotes)) {
  variants[`accepted:${category}`] = notes;
  variants[`completed:${category}`] = [
    `${category} delivery recorded. Company revenue posted.`,
    `${category} assignment closed. We will find a different story for the next leg.`,
    `${category} report received. Company books updated; salary remains separate.`,
  ];
}

export function selectDialogue(event: DialogueEvent, contract: Contract | undefined, report: FlightDraft | undefined, recent: string[]): DispatcherLine {
  let context: string = event;
  if (event === 'accepted') context = contract?.generated ? `accepted:${contract.generated.category}` : contract?.type === 'Passenger charter' ? 'acceptedPassenger' : 'acceptedCargo';
  if (event === 'submitted' && report) {
    if (report.delivery !== 'completed') context = report.delivery + (report.landing === 'hard' ? 'Hard' : '');
    else if (report.landing === 'hard') context = 'hard';
    else if (Number(report.estimatedMinutes) > 0 && Number(report.minutes) > Number(report.estimatedMinutes) * 1.25) context = 'longer';
    else if (report.estimatedFuelLb !== '' && Number(report.estimatedFuelLb) > 0 && report.fuelLb !== '' && Number(report.fuelLb) > Number(report.estimatedFuelLb) * 1.25) context = 'fuel';
    else context = contract?.generated ? `completed:${contract.generated.category}` : contract?.type === 'Passenger charter' ? 'completedPassenger' : 'completedCargo';
  }
  const pool = variants[context] ?? variants.draft;
  // Choose an unused variant, then the least recently used when the pool is exhausted.
  const ids = pool.map((_, i) => `${context}:${i}`);
  const id = ids.find(id => !recent.includes(id)) ?? [...recent].reverse().find(id => ids.includes(id)) ?? ids[0];
  return { id, text: pool[ids.indexOf(id)] };
}
