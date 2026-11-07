// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FlightChecklists } from './FlightChecklists';
import { checklistPhases } from './checklistData';
import { applicableItems, configurations, initialChecklists, procedureInfo, resetChecklists, toggleItem, validateChecklists } from './checklists';
import { acceptMission, createGame, localSaveRepository, offeredContracts, parseSave, reportFor, saveFlightDraft, submitFlightReport, type Game } from './game';
import { useState } from 'react';
const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
afterEach(() => {
  for (const [name, descriptor] of [['showModal', originalShowModal], ['close', originalClose]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });
function Harness({ initial = createGame('Checklist Air') }: { initial?: Game }) {
  const [game, setGame] = useState(initial);
  return <FlightChecklists game={game} onChange={async next => { localSaveRepository.save(next); setGame(next); return true; }}/>;
}
describe('manual transcription and configuration applicability', () => {
  it('has all 15 normal procedures with the source row counts, including the page break', () => {
    expect(checklistPhases.map(p => [p.title, p.items.length])).toEqual([
      ['Before Starting Engine', 26], ['Engine Start (Battery)', 31], ['Engine Start (External Power)', 34], ['Taxi', 9], ['Before Takeoff (Runup)', 56], ['Takeoff', 11], ['Max Performance Climb', 4], ['Enroute Climb', 6], ['Cruise', 8], ['Descent', 5], ['Before Landing', 11], ['Landing', 4], ['Balked Landing', 5], ['After Landing', 10], ['Shutdown & Securing', 13],
    ]);
    const all = checklistPhases.flatMap(p => p.items);
    expect(new Set(all.map(i => i.id)).size).toBe(all.length);
    expect(all.every(i => i.label && i.response && [120, 121, 122].includes(i.page))).toBe(true);
    expect(all.some(i => i.label.includes('Black Square'))).toBe(false);
    expect(checklistPhases.find(p => p.id === 'before-landing')!.items.at(-1)).toMatchObject({ label: 'Autopilot', response: 'Disconnect', page: 122 });
  });
  it('shows starred source items only on the Amphibian, preserving all common steps', () => {
    expect(configurations.map(c => c.label)).toEqual(['Without Cargo Pod', 'Cargo Pod Installed', 'Cargomaster', 'Amphibian']);
    for (const phase of checklistPhases) {
      const land = applicableItems('standard', phase.id);
      expect(applicableItems('pod', phase.id)).toEqual(land);
      expect(applicableItems('cargomaster', phase.id)).toEqual(land);
      expect(applicableItems('amphibian', phase.id)).toEqual(phase.items);
      expect(land.every(i => !i.amphibianOnly)).toBe(true);
    }
  });
  it('retains the precise governor sequence, wrap lines, and optional explanatory source', () => {
    const items = checklistPhases.find(p => p.id === 'before-takeoff-runup')!.items;
    const index = items.findIndex(i => i.label === 'Overspeed Governor');
    expect(items.slice(index - 1, index + 3).map(i => [i.label, i.response])).toEqual([
      ['Power Lever', '1800 RPM'], ['Overspeed Governor', 'Press & Hold'], ['Propeller RPM', 'Check (1750 +/-60 RPM)'], ['Power Lever', 'Idle'],
    ]);
    expect(items.find(i => i.label === 'Flaps')?.response).toBe('10 (Norm) 20 (Short Field)');
    expect(procedureInfo(items[index])?.text).toContain('1750 ±60 RPM');
    expect(procedureInfo(items[index])?.source).toBe('User Guide pp. 61, 121');
  });
});
describe('safe independent checklist persistence', () => {
  it('saves/restores through browser storage and JSON, preserving pending reports and all other game fields', () => {
    let game = createGame('Persistent Air'); game = acceptMission(game, offeredContracts(game)[0].id);
    game = saveFlightDraft(game, { ...reportFor(game), notes: 'Report remains open', minutes: '42' });
    const next = { ...game, checklists: toggleItem(game.checklists, 'before-starting-engine-1') };
    localSaveRepository.save(next);
    expect(localSaveRepository.load()).toEqual(next);
    expect(parseSave(JSON.stringify(next))).toEqual(next);
    const { checklists: _a, ...before } = game; const { checklists: _b, ...after } = next;
    expect(after).toEqual(before);
    expect(next.company.cash).toBe(25000); expect(next.aircraft[0].location).toBe('PADQ');
  });
  it('migrates absent checklist fields on older saves without changing existing data', () => {
    const game = createGame('Old Air'); game.company.cash = 43210; game.flightHours = 8; game.aircraft[0].hours = 8;
    const { checklists: _, ...old } = game;
    const migrated = parseSave(JSON.stringify(old));
    expect(migrated).toEqual({ ...old, checklists: initialChecklists() });
    expect(parseSave(JSON.stringify(migrated))).toEqual(migrated);
  });
  it('preserves completed financial records, a new draft and pinned approach while migrating v0.5C', () => {
    let game = createGame('History Air'); game = acceptMission(game, offeredContracts(game)[0].id);
    game = submitFlightReport(game, { ...reportFor(game), minutes: '37' });
    game = acceptMission(game, offeredContracts(game)[0].id);
    game = saveFlightDraft(game, { ...reportFor(game), notes: 'Keep this draft' });
    // Synthetic metadata fixture for persistence only, not a published chart assertion.
    game.pinnedApproach = { flightId: game.activeFlightId!, chart: { airport: game.activeContract!.origin, title: 'SYNTHETIC TEST APPROACH', type: 'IAP', cycle: '2611', url: 'https://aeronav.faa.gov/d-tpp/2611/test.pdf', metadataUrl: 'https://aeronav.faa.gov/d-tpp/2611/xml_data/d-tpp_Metafile.xml', effectiveFrom: '2026-10-29T00:00:00Z', effectiveTo: '2026-11-26T00:00:00Z' } };
    const { checklists: _, ...old } = game;
    const migrated = parseSave(JSON.stringify(old));
    expect(migrated).toEqual({ ...old, checklists: initialChecklists() });
    expect(migrated.logbook).toHaveLength(1); expect(migrated.pendingReport?.notes).toBe('Keep this draft');
    expect(migrated.pinnedApproach).toEqual(game.pinnedApproach);
    const next = { ...migrated, checklists: toggleItem(migrated.checklists, 'before-starting-engine-1') };
    expect(parseSave(JSON.stringify(next))).toEqual(next);
  });
  it.each(['v0.1', 'v0.2', 'v0.3', 'v0.4'])('adds checklist defaults to a %s save without resetting company records', version => {
    const game = createGame('Legacy Air');
    const legacy = JSON.parse(JSON.stringify(game)); delete legacy.checklists; delete legacy.dispatch; delete legacy.activeContract;
    if (version === 'v0.1' || version === 'v0.2') for (const key of ['activeFlightId', 'pendingReport', 'logbook', 'recentDialogue', 'dispatcher', 'revision']) delete legacy[key];
    if (version !== 'v0.4') delete legacy.pinnedApproach;
    if (version === 'v0.1') delete legacy.activeMissionId;
    legacy.company.cash = 22400; legacy.completedMissions = 4; legacy.flightHours = 12; legacy.aircraft[0].hours = 12;
    const migrated = parseSave(JSON.stringify(legacy));
    expect(migrated.company).toEqual(legacy.company); expect(migrated.aircraft).toEqual(legacy.aircraft);
    expect(migrated.completedMissions).toBe(4); expect(migrated.flightHours).toBe(12);
    expect(migrated.checklists).toEqual(initialChecklists());
  });
  it('rejects invalid checklist data and impossible or duplicate item IDs', () => {
    for (const checklists of [null, {}, { ...initialChecklists(), configuration: 'unknown' }, { ...initialChecklists(), phase: 'invalid' }, { ...initialChecklists(), checked: {} }, { ...initialChecklists(), checked: { ...initialChecklists().checked, standard: ['before-starting-engine-8'] } }, { ...initialChecklists(), checked: { ...initialChecklists().checked, standard: ['before-starting-engine-1', 'before-starting-engine-1'] } }]) {
      expect(() => parseSave(JSON.stringify({ ...createGame('Test'), checklists }))).toThrow('checklist');
    }
    expect(() => toggleItem(initialChecklists(), 'fake')).toThrow();
    expect(validateChecklists(initialChecklists())).toEqual(initialChecklists());
  });
  it('resets only the requested procedure/configuration and does not share ticks across configurations', () => {
    let state = toggleItem(initialChecklists(), 'before-starting-engine-1');
    state = { ...state, phase: 'taxi' }; state = toggleItem(state, 'taxi-1');
    const reset = resetChecklists(state, false);
    expect(reset.checked.standard).toEqual(['before-starting-engine-1']);
    const amphibian = toggleItem({ ...state, configuration: 'amphibian', phase: 'before-starting-engine' }, 'before-starting-engine-8');
    expect(resetChecklists(amphibian, true).checked.standard).toEqual(state.checked.standard);
    expect(resetChecklists(amphibian, true).checked.amphibian).toEqual([]);
    expect(amphibian.checked.standard).not.toContain('before-starting-engine-8');
  });
  it('leaves existing final payment and duplicate protection unchanged after checklist use', () => {
    let game = createGame('Revenue Air'); game = acceptMission(game, offeredContracts(game)[0].id);
    game = { ...game, checklists: toggleItem(game.checklists, 'before-starting-engine-1') };
    const report = { ...reportFor(game), minutes: '60' }; const payout = game.activeContract!.payout;
    const result = submitFlightReport(game, report);
    expect(result.company.cash).toBe(25000 + payout); expect(result.checklists).toEqual(game.checklists);
    expect(() => submitFlightReport(result, report)).toThrow('already');
  });
});
describe('touch and keyboard checklist UI', () => {
  it('toggles and unchecks items, survives remount and switches configuration independently', async () => {
    const view = render(<Harness/>);
    fireEvent.click(screen.getByRole('checkbox', { name: /Preflight Inspection/ }));
    await waitFor(() => expect(localSaveRepository.load()?.checklists.checked.standard).toContain('before-starting-engine-1'));
    view.unmount(); render(<Harness initial={localSaveRepository.load()!}/>);
    expect((screen.getByRole('checkbox', { name: /Preflight Inspection/ }) as HTMLInputElement).checked).toBe(true);
    fireEvent.change(screen.getByLabelText('Aircraft configuration'), { target: { value: 'amphibian' } });
    await screen.findByRole('checkbox', { name: /Landing Gear/ });
    expect((screen.getByRole('checkbox', { name: /Preflight Inspection/ }) as HTMLInputElement).checked).toBe(false);
    fireEvent.change(screen.getByLabelText('Aircraft configuration'), { target: { value: 'standard' } });
    await waitFor(() => expect((screen.getByRole('checkbox', { name: /Preflight Inspection/ }) as HTMLInputElement).checked).toBe(true));
    fireEvent.click(screen.getByRole('checkbox', { name: /Preflight Inspection/ }));
    await waitFor(() => expect(localSaveRepository.load()?.checklists.checked.standard).toEqual([]));
  });
  it('opens optional governor information and returns keyboard focus on close', async () => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute('open', ''); } });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute('open'); } });
    render(<Harness/>);
    fireEvent.click(screen.getByRole('button', { name: /Before Takeoff/ }));
    const info = await screen.findByRole('button', { name: 'Information: Overspeed Governor' });
    fireEvent.click(info);
    expect(screen.getByRole('dialog', { name: 'Overspeed governor test' }).textContent).toContain('1750 ±60 RPM');
    fireEvent.click(screen.getByRole('button', { name: 'Close information' }));
    expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(info);
  });
  it('keeps procedure information usable when native modal dialogs are unsupported', async () => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: undefined });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: undefined });
    render(<Harness/>);
    fireEvent.click(screen.getByRole('button', { name: /Before Takeoff/ }));
    const trigger = await screen.findByRole('button', { name: 'Information: Overspeed Governor' });
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Overspeed governor test' });
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close information' }));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(trigger);
  });
  it('requires confirmation to reset and can keep progress', async () => {
    render(<Harness/>); fireEvent.click(screen.getByRole('checkbox', { name: /Preflight Inspection/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reset this procedure' }).hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Reset this procedure' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep progress' }));
    expect(localSaveRepository.load()?.checklists.checked.standard).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Reset this procedure' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm reset' }));
    await waitFor(() => expect(localSaveRepository.load()?.checklists.checked.standard).toHaveLength(0));
  });
  it('does not show success or apply progress when storage fails', async () => {
    const game = createGame('Fail Air'); const onChange = vi.fn(async () => false);
    render(<FlightChecklists game={game} onChange={onChange}/>);
    fireEvent.click(screen.getByRole('checkbox', { name: /Preflight Inspection/ }));
    await screen.findByRole('alert');
    expect((screen.getByRole('checkbox', { name: /Preflight Inspection/ }) as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByText('Checklist progress saved on this device.')).toBeNull();
  });
});
