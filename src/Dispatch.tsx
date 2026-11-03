import { Radio, MapPin, ArrowRight, Check } from 'lucide-react';
import { availableContracts, airportNames, findContract } from './missions';
import { acceptMission, cancelMission, type Game } from './game';
const money = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
export function Dispatch({ game, onChange, onNotice, onNavigate }: { game: Game; onChange: (next: Game) => Promise<boolean>; onNotice: (message: string) => void; onNavigate: (page: string) => void }) {
  const contracts = availableContracts(game.aircraft[0].location);
  const active = game.activeMissionId ? findContract(game.activeMissionId) : undefined;
  return <div className="dispatch">
    <section className="card dispatch-intro"><Radio size={26}/><div><span className="eyebrow">ISLAND DISPATCH · LOCAL STORIES</span><h2>A connection to the island.</h2><p>Fictional contracts for your Caravan. Departures match your aircraft’s current airport; distances are approximate one-way nautical miles. Payload includes passengers and baggage where listed.</p></div></section>
    <div className="notice">Open Flight Operations for your accepted contract to save a draft or submit a post-flight report. Payouts are credited only for reported completed deliveries. This board is game content, not navigation guidance or live operational data.</div>
    <section className="card active-contract" aria-labelledby="active-heading"><div><span className="eyebrow">ACTIVE MISSION · {active ? '1 OF 1' : '0 OF 1'}</span><h2 id="active-heading">{active ? active.title : 'No active mission'}</h2><p>{active ? `${active.origin} → ${active.airport} · ${active.destination} · ${active.payloadLb.toLocaleString()} lb payload` : 'Review the stories below and select one contract to reserve it.'}</p></div>{active && <div className="form-actions"><button className="secondary" onClick={() => onNavigate('Flight Planning / EFB')}>Plan flight / EFB</button><button className="primary" onClick={() => onNavigate('Flight Operations')}>Open Flight Operations</button><button className="secondary" onClick={async () => { if (game.pendingReport && !window.confirm('Cancel this mission and discard its saved flight draft? No penalty will be charged.')) return; if (await onChange(cancelMission(game))) onNotice('Mission cancelled without penalty.'); }}>Cancel active mission</button></div>}</section>
    <div className="dispatch-heading"><h2>Available contracts</h2><span>One active mission at a time</span></div>
    {contracts.length === 0 && <section className="card placeholder"><h2>No contracts at {game.aircraft[0].location}</h2><p>No fictional routes are defined for this airport. Aircraft repositioning is not implemented; no route will be invented.</p></section>}<div className="contract-grid">{contracts.map(contract => {
      const selected = game.activeMissionId === contract.id;
      return <article className={`card contract${selected ? ' selected' : ''}`} key={contract.id} aria-labelledby={`${contract.id}-title`}>
        <div className="contract-top"><span className="eyebrow">{contract.type}</span><span className="contract-reward">{money(contract.payout)}<small>PROPOSED PAYOUT</small></span></div>
        <h3 id={`${contract.id}-title`}>{contract.title}</h3>
        <div className="contract-route"><MapPin size={16}/><span>{airportNames[contract.origin] ?? contract.origin} · {contract.origin} <ArrowRight size={14}/> {contract.destination} · {contract.airport}</span></div>
        <p className="dispatcher-story">{contract.story}</p>
        <dl className="contract-facts"><div><dt>Estimated distance</dt><dd>{contract.distanceNm} NM · one way</dd></div><div><dt>Total payload</dt><dd>{contract.payloadLb.toLocaleString()} lb</dd></div><div className="payload-description"><dt>Manifest</dt><dd>{contract.payload}</dd></div></dl>
        <details><summary>Operational considerations</summary><p>{contract.considerations}</p><p>Verify simulator airport availability, aircraft performance, fuel, weather and current charts yourself. These estimates are not a flight plan.</p></details>
        <button className="primary" disabled={game.activeMissionId !== null} onClick={async () => { if (await onChange(acceptMission(game, contract.id))) onNotice(`Selected: ${contract.title}. Open Flight Operations when ready.`); }}>{selected ? <><Check size={16}/> Active mission</> : active ? 'Cancel active mission to select' : 'Select contract'}</button>
      </article>;
    })}</div>
  </div>;
}
