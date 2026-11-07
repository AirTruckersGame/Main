import { checklistPhases, type ChecklistItem } from './checklistData';
export const configurations = [
  { id: 'standard', label: 'Without Cargo Pod' },
  { id: 'pod', label: 'Cargo Pod Installed' },
  { id: 'cargomaster', label: 'Cargomaster' },
  { id: 'amphibian', label: 'Amphibian' },
] as const;
export type Configuration = typeof configurations[number]['id'];
export interface ChecklistState { version: 1; configuration: Configuration; phase: string; checked: Record<Configuration, string[]> }
export const initialChecklists = (): ChecklistState => ({ version: 1, configuration: 'standard', phase: checklistPhases[0].id, checked: { standard: [], pod: [], cargomaster: [], amphibian: [] } });
export const applicableItems = (configuration: Configuration, phase: string) => checklistPhases.find(p => p.id === phase)!.items.filter(i => !i.amphibianOnly || configuration === 'amphibian');
export function validateChecklists(value: unknown): ChecklistState {
  const s = value as ChecklistState;
  if (!s || s.version !== 1 || !configurations.some(c => c.id === s.configuration) || !checklistPhases.some(p => p.id === s.phase) || !s.checked || typeof s.checked !== 'object') throw new Error('Invalid checklist save. Your stored data has not been changed.');
  for (const c of configurations) {
    const ids = s.checked[c.id];
    const allowed = new Set(checklistPhases.flatMap(p => applicableItems(c.id, p.id).map(i => i.id)));
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length || !ids.every(id => typeof id === 'string' && allowed.has(id))) throw new Error('Invalid checklist progress. Your stored data has not been changed.');
  }
  return s;
}
export function toggleItem(state: ChecklistState, id: string): ChecklistState {
  if (!applicableItems(state.configuration, state.phase).some(i => i.id === id)) throw new Error('Item does not belong to this checklist.');
  const checked = state.checked[state.configuration];
  return { ...state, checked: { ...state.checked, [state.configuration]: checked.includes(id) ? checked.filter(i => i !== id) : [...checked, id] } };
}
export function resetChecklists(state: ChecklistState, wholeConfiguration: boolean): ChecklistState {
  const ids = new Set(applicableItems(state.configuration, state.phase).map(i => i.id));
  return { ...state, checked: { ...state.checked, [state.configuration]: wholeConfiguration ? [] : state.checked[state.configuration].filter(id => !ids.has(id)) } };
}
export function procedureInfo(item: ChecklistItem): { title: string; text: string; source: string } | undefined {
  if (item.label === 'Overspeed Governor') return { title: 'Overspeed governor test', text: 'During runup: set power for 1800 RPM; press and hold the red OVERSPEED GOVERNOR PUSH TO TEST button above the electrical control panel; check propeller RPM at 1750 ±60 RPM; return the power lever to idle. Holding the button lowers the governor setting for the test. The manual says that failure to maintain the expected governor RPM means flight should be discontinued as soon as practical. These are manual actions in the simulator; this app does not test or sense the governor.', source: 'User Guide pp. 61, 121' };
  if (item.amphibianOnly) return { title: 'Amphibian configuration', text: 'The manual marks this item for the Amphibian only. Follow the water/land instruction for the surface you are actually operating on. Checking this box does not move landing gear or water rudders in the simulator.', source: `User Guide p. ${item.page}` };
  if (item.label === 'Ng RPM Stable') return { title: 'Engine start sequence', text: 'The checklist calls for stable Ng greater than 12% before selecting Low Idle. Subsequent checks call for fuel flow 90–140 lb/hr, ITT 1090 max. for 2 seconds, and Ng greater than 52%. Keep monitoring the simulator instruments; checklist ticks do not verify engine condition.', source: 'User Guide p. 120' };
  if (item.label === 'Standby Alternator' && item.response === 'On') return { title: 'Standby alternator check', text: 'The runup sequence calls for standby alternator On, check zero amps, generator load 30–60 amps, generator switch Trip, check positive standby alternator load, then generator switch Reset. Each repeated control entry is a separate step.', source: 'User Guide p. 121' };
  if (item.label === 'Autopilot Heading Mode') return { title: 'Autopilot runup check', text: 'Set the heading bug 30 degrees left, engage heading mode and observe yoke movement. Set the bug 30 degrees right and observe movement, test autopilot disconnect, then set the autopilot for climb. This app does not engage or verify the simulator autopilot.', source: 'User Guide p. 121' };
  if (item.response.includes('See POH')) return { title: 'Consult aircraft performance information', text: 'The source checklist refers to the POH for this power setting. No numeric setting has been invented here. Use the documentation and conditions for your selected simulator aircraft.', source: `User Guide p. ${item.page}` };
}
