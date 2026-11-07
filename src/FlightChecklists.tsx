import { useEffect, useRef, useState } from 'react';
import { Check, Info, RotateCcw } from 'lucide-react';
import { checklistPhases } from './checklistData';
import { applicableItems, configurations, procedureInfo, resetChecklists, toggleItem, type ChecklistState, type Configuration } from './checklists';
import type { Game } from './game';
export function FlightChecklists({ game, onChange }: { game: Game; onChange: (next: Game) => Promise<boolean> }) {
  const state = game.checklists;
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reset, setReset] = useState<'phase' | 'all' | null>(null);
  const phase = checklistPhases.find(p => p.id === state.phase)!;
  const items = applicableItems(state.configuration, state.phase);
  const checked = state.checked[state.configuration];
  const done = items.filter(i => checked.includes(i.id)).length;
  async function save(next: ChecklistState) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try {
      if (await onChange({ ...game, checklists: next })) setMessage('Checklist progress saved on this device.');
      else setError('Checklist change was not saved. Retry after resolving the storage error above.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save checklist progress.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="checklists">
    <section className="card settings"><span className="eyebrow">BLACK SQUARE · CARAVAN PROFESSIONAL</span><h2>Normal flight checklists</h2><p className="muted">Simulator companion · User Guide (2026), pp. 120–122. Choose the configuration you fly in MSFS. This selection does not change your company aircraft or loading model.</p>
      <fieldset disabled={busy}><legend className="sr-only">Checklist configuration</legend><label htmlFor="checklist-configuration">Aircraft configuration</label><select id="checklist-configuration" value={state.configuration} onChange={e => { setReset(null); void save({ ...state, configuration: e.target.value as Configuration }); }}>{configurations.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></fieldset>
      <p className="muted">The three land configurations share the manual’s normal procedures. Amphibian adds the starred gear and water-rudder items. Battery and external-power starts are alternatives. Check only the procedure you use.</p><p className="muted">Manual checks only: no simulator telemetry or automatic verification. Checklist progress does not pay missions, change flight reports, move aircraft or advance time. Reset for each new flight; progress is retained per configuration until you reset it.</p>
    </section>
    {error && <p className="alert" role="alert">{error}</p>}<p className="checklist-save" role="status" aria-live="polite">{busy ? 'Saving checklist…' : message}</p>
    <div className="checklist-layout"><nav className="card checklist-phases" aria-label="Checklist procedures">{checklistPhases.map(p => {
      const list = applicableItems(state.configuration, p.id); const count = list.filter(i => checked.includes(i.id)).length;
      return <button key={p.id} disabled={busy} aria-current={p.id === state.phase ? 'step' : undefined} onClick={() => { setReset(null); void save({ ...state, phase: p.id }); }}><span>{p.title}</span><small>{count}/{list.length}</small></button>;
    })}</nav><section className="card settings checklist-procedure" aria-labelledby="checklist-title">
      <span className="eyebrow">{configurations.find(c => c.id === state.configuration)!.label}</span><h2 id="checklist-title">{phase.title}</h2><p role="status">{done} of {items.length} checked{done === items.length ? ' · Procedure checked' : ''}</p><progress value={done} max={items.length} aria-label={`${phase.title} progress`}/>
      <ul className="checklist-items">{items.map(item => {
        const info = procedureInfo(item);
        return <li key={item.id}><label className={checked.includes(item.id) ? 'checklist-row is-checked' : 'checklist-row'}><input type="checkbox" disabled={busy} checked={checked.includes(item.id)} onChange={() => void save(toggleItem(state, item.id))}/><span><strong>{item.label}</strong><span className="checklist-response">{item.response}</span>{item.amphibianOnly && <small>Amphibian only</small>}</span>{checked.includes(item.id) && <Check size={18} aria-hidden="true"/>}</label>{info && <ProcedureHelp {...info} label={item.label}/>}</li>;
      })}</ul>
      <p className="muted">Source: Black Square Caravan Professional User Guide (2026), p. {phase.id === 'before-landing' ? '121–122' : phase.page}. POH references are retained; no performance values are substituted.</p>
      <div className="form-actions"><button className="secondary" disabled={busy} onClick={() => setReset('phase')}><RotateCcw size={16}/> Reset this procedure</button><button className="secondary" disabled={busy} onClick={() => setReset('all')}>Reset configuration for new flight</button></div>
      {reset && <div className="checklist-reset" role="group" aria-label="Confirm checklist reset"><p>Clear {reset === 'all' ? 'all checked items for this configuration' : 'the checked items in this procedure'}? Other configurations and company progress are preserved.</p><button className="primary" disabled={busy} onClick={async () => { await save(resetChecklists(state, reset === 'all')); setReset(null); }}>Confirm reset</button><button className="secondary" disabled={busy} onClick={() => setReset(null)}>Keep progress</button></div>}
    </section></div>
  </div>;
}
function ProcedureHelp({ title, text, source, label }: { title: string; text: string; source: string; label: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open || !dialog.current) return;
    if (typeof dialog.current.showModal === 'function') dialog.current.showModal();
    else dialog.current.setAttribute('open', '');
    dialog.current.querySelector('button')?.focus();
  }, [open]);
  function close() { dialog.current?.close?.(); setOpen(false); trigger.current?.focus(); }
  return <><button ref={trigger} className="checklist-help secondary" aria-label={`Information: ${label}`} onClick={() => setOpen(true)}><Info size={16} aria-hidden="true"/> Procedure information</button>{open && <dialog ref={dialog} className="procedure-dialog" aria-label={title} onCancel={e => { e.preventDefault(); close(); }} onKeyDown={e => { if (e.key === 'Tab') { e.preventDefault(); dialog.current?.querySelector('button')?.focus(); } if (e.key === 'Escape') { e.preventDefault(); close(); } }}><h2>{title}</h2><p>{text}</p><p className="muted">{source}</p><button className="primary" onClick={close}>Close information</button></dialog>}</>;
}
