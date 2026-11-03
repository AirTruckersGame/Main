import type { Contract } from './missions';
export type Delivery = 'completed' | 'diverted' | 'incomplete';
export type Landing = 'normal' | 'hard';
export interface FlightDraft {
  flightId: string;
  minutes: string;
  fuelLb: string;
  estimatedMinutes: string;
  estimatedFuelLb: string;
  arrival: string;
  delivery: Delivery;
  landing: Landing;
  notes: string;
}
export interface FlightEntry {
  contract?: Contract;
  id: string; missionId: string; title: string; aircraftId: string;
  origin: string; plannedDestination: string; arrival: string;
  payload: string; proposedPayout: number; revenue: number;
  minutes: number; fuelLb: number | null;
  estimatedMinutes: number | null; estimatedFuelLb: number | null;
  delivery: Delivery; landing: Landing; notes: string;
  startedAt: string; endedAt: string;
}
// Sanity bounds for manual reports, not verified aircraft performance limits.
export function numericInput(value: string, kind: 'minutes' | 'fuel', required = false): number | null {
  if (typeof value !== 'string') throw new Error('Invalid numeric input.');
  if (!value.trim()) {
    if (required) throw new Error('Actual flight time is required.');
    return null;
  }
  const pattern = kind === 'minutes' ? /^\d+$/ : /^\d+(\.\d{1,2})?$/;
  const n = Number(value);
  if (!pattern.test(value) || !Number.isFinite(n) || (kind === 'minutes' ? n < 1 || n > 1440 : n < 0 || n > 10000)) {
    throw new Error(kind === 'minutes' ? 'Time must be a whole number from 1 to 1,440 minutes.' : 'Fuel must be between 0 and 10,000 lb, with at most two decimal places.');
  }
  return n;
}
export function validateDraft(draft: FlightDraft, final = false) {
  if (!draft || typeof draft.flightId !== 'string' || !draft.flightId || !['completed', 'diverted', 'incomplete'].includes(draft.delivery) || !['normal', 'hard'].includes(draft.landing) || typeof draft.notes !== 'string' || draft.notes.length > 2000 || typeof draft.arrival !== 'string' || !/^[A-Z0-9]{3,4}$/.test(draft.arrival)) throw new Error('Invalid report: check arrival airport, outcome and notes (maximum 2,000 characters).');
  numericInput(draft.minutes, 'minutes', final);
  numericInput(draft.fuelLb, 'fuel');
  numericInput(draft.estimatedMinutes, 'minutes');
  numericInput(draft.estimatedFuelLb, 'fuel');
}
export function blankDraft(flightId: string, arrival: string): FlightDraft {
  return { flightId, minutes: '', fuelLb: '', estimatedMinutes: '', estimatedFuelLb: '', arrival, delivery: 'completed', landing: 'normal', notes: '' };
}
