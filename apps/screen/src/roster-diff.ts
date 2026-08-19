/** True only when the SET of player ids differs from prevIds - a reconnect (same id, its
 * `connected` flag flipping false->true) must never read as a leave+join to game logic. */
export function rosterIdsChanged(prevIds: Set<string> | null, newIds: Set<string>): boolean {
  if (prevIds === null) return false;
  if (prevIds.size !== newIds.size) return true;
  for (const id of newIds) if (!prevIds.has(id)) return true;
  return false;
}
