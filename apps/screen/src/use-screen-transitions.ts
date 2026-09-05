import { useRef, useState } from "react";
import type { GameSummary, InputLegendEntry, Player, RoomConfig, Suggestion } from "@hubbub/protocol";
import type { GameResult } from "@hubbub/sdk";
import { transitionView } from "@hubbub/ui";

export interface RoomState {
  players: Player[];
  hostId: string | null;
  mode: "lobby" | "configuring" | "in-game";
  currentGameId: string | null;
  cursorIndex: number;
  games: GameSummary[];
  suggestions: Suggestion[];
  config: RoomConfig | null;
  inputLegend: InputLegendEntry[];
}

/** Owns the three pieces of state that decide which top-level branch App.tsx renders (room,
 * result, failedGameId) and routes every branch-changing update through transitionView - a
 * roster tick or in-game state push must stay a hard, instant setState, so each setter here
 * compares against the previously committed value before deciding to animate. */
export function useScreenTransitions() {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  // Set the instant this screen's own driver reports a failure, and cleared only by a later,
  // different launch - the return-to-lobby beat must NOT clear it, since that is the moment the
  // overlay still needs to be up.
  const [failedGameId, setFailedGameId] = useState<string | null>(null);

  // Refs, not the state above: the room-message handler is a closure captured once inside App's
  // connect effect, so reading state there would see the value frozen at that first render.
  const prevRoomRef = useRef<RoomState | null>(null);
  const hasResultRef = useRef(false);
  const failedGameIdRef = useRef<string | null>(null);

  function applyRoom(next: RoomState) {
    const prev = prevRoomRef.current;
    // A phase switch is a mode change or the Hero<->Lobby player-count crossing; anything else
    // (roster tick, cursor move) must not flash a transition on every roomState message.
    const modeChanged = prev !== null && prev.mode !== next.mode;
    const heroLobbyFlip = prev !== null && (prev.players.length === 0) !== (next.players.length === 0);
    prevRoomRef.current = next;
    if (modeChanged || heroLobbyFlip) transitionView(() => setRoom(next));
    else setRoom(next);
  }

  function applyResult(next: GameResult | null) {
    const changed = hasResultRef.current !== (next !== null);
    hasResultRef.current = next !== null;
    if (changed) transitionView(() => setResult(next));
    else setResult(next);
  }

  function applyFailedGameId(next: string | null) {
    if (failedGameIdRef.current === next) return;
    failedGameIdRef.current = next;
    transitionView(() => setFailedGameId(next));
  }

  return {
    room,
    applyRoom,
    result,
    applyResult,
    failedGameId,
    applyFailedGameId,
    getFailedGameId: () => failedGameIdRef.current,
  };
}
