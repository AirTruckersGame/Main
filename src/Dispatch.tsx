import { Radio, MapPin, ArrowRight, Check } from 'lucide-react';
import { contracts, findContract } from './missions';
import { acceptMission, cancelMission, type Game } from './game';
const money = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
export function Dispatch({ game, onChange, onNotice }: { game: Game; onChange: (next: Game) => void; onNotice: (message: string) => void }) {
  const active = game.activeMissionId ? findContract(game.activeMissionId) : undefined;
  return <div className="dispatch">
    <section className="card dispatch-intro"><Radio size={26}/><div><span className="eyebrow">KODIAK DISPATCH · FIVE LOCAL STORIES</span><h2>A connection to the island.</h2><p>Fictional contracts for your Caravan. All departures are from Kodiak (PADQ); distances are approximate one-way nautical miles. Payload includes passengers and baggage where listed.</p></div></section>
    <div className="notice">Version 0.2 supports selection and cancellation only. Payouts are proposed rewards, not credited funds. There is no flight completion, aircraft movement or mission-driven time advancement. This board is game content, not navigation guidance or live operational data.</div>
    <section className="card active-contract" aria-labelledby="active-heading"><div><span className="eyebrow">ACTIVE MISSION · {active ? '1 OF 1' : '0 OF 1'}</span><h2 id="active-heading">{active ? active.title : 'No active mission'}</h2><p>{active ? `PADQ → ${active.airport} · ${active.destination} · ${active.payloadLb.toLocaleString()} lb payload` : 'Review the stories below and select one contract to reserve it.'}</p></div>{active && <button className="secondary" onClick={() => { onChange(cancelMission(game)); onNotice('Mission cancelled without penalty. You can select any contract again.'); }}>Cancel active mission</button>}</section>
    <div className="dispatch-heading"><h2>Available contracts</h2><span>One active mission at a time</span></div>
    <div className="contract-grid">{contracts.map(contract => {
      const selected = game.activeMissionId === contract.id;
      return <article className={`card contract${selected ? ' selected' : ''}`} key={contract.id} aria-labelledby={`${contract.id}-title`}>
        <div className="contract-top"><span className="eyebrow">{contract.type}</span><span className="contract-reward">{money(contract.payout)}<small>PROPOSED PAYOUT</small></span></div>
        <h3 id={`${contract.id}-title`}>{contract.title}</h3>
        <div className="contract-route"><MapPin size={16}/><span>Kodiak · PADQ <ArrowRight size={14}/> {contract.destination} · {contract.airport}</span></div>
        <p className="dispatcher-story">{contract.story}</p>
        <dl className="contract-facts"><div><dt>Estimated distance</dt><dd>{contract.distanceNm} NM · one way</dd></div><div><dt>Total payload</dt><dd>{contract.payloadLb.toLocaleString()} lb</dd></div><div className="payload-description"><dt>Manifest</dt><dd>{contract.payload}</dd></div></dl>
        <details><summary>Operational considerations</summary><p>{contract.considerations}</p><p>Verify simulator airport availability, aircraft performance, fuel, weather and current charts yourself. These estimates are not a flight plan.</p></details>
        <button className="primary" disabled={game.activeMissionId !== null} onClick={() => { onChange(acceptMission(game, contract.id)); onNotice(`Selected: ${contract.title}. Your mission selection is included in local saves and backups.`); }}>{selected ? <><Check size={16}/> Active mission</> : active ? 'Cancel active mission to select' : 'Select contract'}</button>
      </article>;
    })}</div>
  </div>;
}
