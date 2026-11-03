// Build genuine pre-v0.5 accepted-save shapes for compatibility tests. Static IDs
// are not selectable on the new board; they survive only as migrated assignments.
import { parseSave, type Game } from '../src/game';
import { findContract } from '../src/missions';
export function acceptLegacyMission(game: Game, id: string): Game {
  if (game.activeMissionId) throw new Error('Cancel your active mission first.');
  const contract = findContract(id);
  if (!contract) throw new Error('Unknown contract.');
  if (contract.origin !== game.aircraft[0].location) throw new Error('Contract does not depart from the aircraft’s current airport.');
  const { dispatch: _dispatch, activeContract: _active, ...old } = game;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const activeFlightId = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return parseSave(JSON.stringify({ ...old, activeMissionId: id, activeFlightId, pendingReport: null }));
}
