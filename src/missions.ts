export interface GeneratedDetails {
  schema: 1; serial: number; category: MissionCategory; templateId: string;
  customer: string; payloadFamily: string; passengers: number; baggageLb: number;
  cargoLb: number; passengerLb: number; fuelAssumptionLb: number;
  offeredAt: string; expiresAt: string;
}
export type MissionCategory = 'General cargo' | 'Commercial resupply' | 'Medical logistics' | 'Government / infrastructure' | 'Priority freight' | 'Community delivery' | 'Passenger charter' | 'Repositioning';
export interface Contract {
  id: string;
  origin: string;
  title: string;
  type: 'Cargo' | 'Passenger charter' | 'Repositioning';
  destination: string;
  airport: string;
  distanceNm: number | null;
  payout: number;
  payload: string;
  payloadLb: number;
  story: string;
  considerations: string;
  generated?: GeneratedDetails;
}
// Fictional scenarios; distances are approximate direct legs from Kodiak (PADQ).
export const contracts: readonly Contract[] = [
  { origin: 'PADQ', id: 'kodiak-01', title: 'The cannery’s missing part', type: 'Cargo', destination: 'Larsen Bay', airport: 'PALB', distanceNm: 50, payout: 1450, payload: 'Crated pump assembly and tools', payloadLb: 780, story: 'Dispatcher Mara: “The fictional North Shore cannery has a stalled wash line. Their mechanic has the crew ready, but the replacement pump is still here in Kodiak. Can you get it out to Larsen Bay?”', considerations: 'Secure the dense crate and verify weight and balance. Coastal terrain and changing visibility demand careful route planning; assess the destination runway and winds before departure.' },
  { origin: 'PADQ', id: 'kodiak-02', title: 'A classroom worth of possibilities', type: 'Cargo', destination: 'Old Harbor', airport: 'PADY', distanceNm: 44, payout: 1250, payload: 'School books, laptops and teaching supplies', payloadLb: 540, story: 'Dispatcher Mara: “A fictional community learning project has collected new supplies for Old Harbor. Teacher Lena wants the children to open everything together. These boxes carry more excitement than their weight suggests.”', considerations: 'Protect electronics from moisture and restrain each box. Evaluate mountain obscuration along the route and confirm destination conditions independently.' },
  { origin: 'PADQ', id: 'kodiak-03', title: 'Keeping the lights on', type: 'Cargo', destination: 'Akhiok', airport: 'PAKH', distanceNm: 74, payout: 2100, payload: 'Generator service kits and packaged filters', payloadLb: 960, story: 'Dispatcher Mara: “Our fictional island maintenance crew is working through a generator overhaul in Akhiok. They have enough supplies to pause safely, so no heroics—bring the service kits when conditions allow.”', considerations: 'The longer coastal leg needs a fuel and alternate plan. Confirm the packaged shipment contains no undeclared hazardous materials; check runway suitability for the planned load.' },
  { origin: 'PADQ', id: 'kodiak-04', title: 'The village gathering', type: 'Passenger charter', destination: 'Ouzinkie', airport: '4K5', distanceNm: 12, payout: 850, payload: '4 passengers (800 lb) and baggage (120 lb)', payloadLb: 920, story: 'Dispatcher Mara: “Four fictional guests are heading to a family gathering in Ouzinkie. They know a short flight still deserves a proper briefing. Give them a calm introduction to island flying.”', considerations: 'Allocate passenger and baggage weight by seat and compartment. Complete a passenger briefing and check restraints; short distance does not remove the need for fuel reserves and an alternate plan.' },
  { origin: 'PADQ', id: 'kodiak-05', title: 'Field notes from the island', type: 'Passenger charter', destination: 'Port Lions', airport: 'PORI', distanceNm: 24, payout: 1150, payload: '3 researchers (600 lb), bags and instruments (240 lb)', payloadLb: 840, story: 'Dispatcher Mara: “A fictional habitat research team has finished organizing its instruments in Kodiak. Their field coordinator will meet them at Port Lions. Fragile equipment, patient passengers, and plenty of notebooks.”', considerations: 'Restrain fragile instruments separately from cabin baggage. Review coastal winds, terrain and destination runway conditions. Keep access to exits clear.' },
  { id: 'larsen-return', origin: 'PALB', title: 'Cannery records to Kodiak', type: 'Cargo', destination: 'Kodiak', airport: 'PADQ', distanceNm: 50, payout: 1000, payload: 'Packed records and sample cases', payloadLb: 220, story: 'Mara: “The cannery has records and sealed samples for Kodiak. Paperwork travels better when it stays dry.”', considerations: 'Secure cases; check coastal weather and fuel reserves.' },
  { id: 'harbor-return', origin: 'PADY', title: 'Teachers heading home', type: 'Passenger charter', destination: 'Kodiak', airport: 'PADQ', distanceNm: 44, payout: 1050, payload: '2 teachers and baggage', payloadLb: 460, story: 'Mara: “Two visiting teachers need a lift to Kodiak. They have earned a quiet ride.”', considerations: 'Brief passengers, distribute baggage, and check terrain clearance.' },
  { id: 'akhiok-return', origin: 'PAKH', title: 'Workshop returns', type: 'Cargo', destination: 'Kodiak', airport: 'PADQ', distanceNm: 74, payout: 1600, payload: 'Clean reusable tool cases', payloadLb: 350, story: 'Mara: “The crew has tool cases ready for the Kodiak workshop. No rush worth cutting a corner.”', considerations: 'Confirm contents and secure heavy cases; plan coastal alternates.' },
  { id: 'ouzinkie-return', origin: '4K5', title: 'Back after the gathering', type: 'Passenger charter', destination: 'Kodiak', airport: 'PADQ', distanceNm: 12, payout: 700, payload: '3 passengers and baggage', payloadLb: 710, story: 'Mara: “Three guests are ready for Kodiak. Short hop, full briefing.”', considerations: 'Confirm passenger weights and restraints; retain normal reserves.' },
  { id: 'lions-return', origin: 'PORI', title: 'Research samples for Kodiak', type: 'Cargo', destination: 'Kodiak', airport: 'PADQ', distanceNm: 24, payout: 800, payload: 'Nonhazardous sealed sample cases', payloadLb: 180, story: 'Mara: “The field team has packed its samples. Bring the labels back with the boxes, preferably attached.”', considerations: 'Verify nonhazardous contents and secure cases away from exits.' },
];
export const airportNames: Record<string, string> = { PADQ: 'Kodiak', PALB: 'Larsen Bay', PADY: 'Kongiganak', PAKH: 'Akhiok', '4K5': 'Ouzinkie', PORI: 'Port Lions', PAHO: 'Homer', PAEN: 'Kenai' };
export function availableContracts(airport: string) { return contracts.filter(c => c.origin === airport); }
export function findContract(id: string) { return contracts.find(contract => contract.id === id); }
