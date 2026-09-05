import { useEffect, useRef, useState } from "react";
import { roomSocketUrl, type Suggestion, type Player, type GameSummary, type RoomConfig } from "@hubbub/protocol";
import { WebRtcClientTransport, type TierState } from "@hubbub/protocol/webrtc";
import type { GameResult } from "@hubbub/sdk";
import type { Identity } from "./identity";
import { SERVER_URL, STUN_URL } from "./config";

export type RoomState = {
  players: Player[];
  hostId: string | null;
  mode: "lobby" | "configuring" | "in-game";
  currentGameId: string | null;
  cursorIndex: number;
  games: GameSummary[];
  suggestions: Suggestion[];
  config: RoomConfig | null;
};
export type GameSlot = { gameId: string; state: any };

/** Owns the room connection: the transport, the reducer-style handling of every server-pushed
 * message (roomState/gameState/gameFailure/error), and the join/leave actions that drive it. */
export function useRoomState(code: string, identity: Identity | null, initialCode?: string) {
  const [status, setStatus] = useState<"idle" | "joining" | "in" | "error">("idle");
  const [error, setError] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [game, setGame] = useState<GameSlot | null>(null);
  const [configError, setConfigError] = useState("");
  const [tier, setTier] = useState<TierState>({ tier: null, rttMs: null });
  const transportRef = useRef<WebRtcClientTransport>();

  const [failedGameId, setFailedGameId] = useState<string | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const gameIdRef = useRef<string | null>(null);

  async function join() {
    if (!identity) return;
    setStatus("joining");
    const t = new WebRtcClientTransport(roomSocketUrl(SERVER_URL, code), "controller", {
      stunUrl: STUN_URL,
      onTierChange: setTier,
    });
    transportRef.current = t;
    try {
      await t.connect();
    } catch {
      // An unknown/rate-limited code now fails the WS handshake itself (HTTP layer, before any
      // wire message) - same user-facing outcome as the old joinRoom "no_room" error reply.
      setError("Room not found");
      setStatus("error");
      return;
    }
    t.onMessage((msg) => {
      if (msg.t === "joined") {
        localStorage.setItem(`hubbub:token:${code}`, msg.token);
        setPlayerId(msg.playerId);
        setStatus("in");
      } else if (msg.t === "roomState") {
        setRoom(msg as RoomState);
        // Only a different, real launch clears it; the failure's own flip to lobby leaves
        // currentGameId null, which is exactly when the overlay must still be up.
        if (msg.currentGameId) setFailedGameId((f) => (f && f !== msg.currentGameId ? null : f));
      } else if (msg.t === "gameState") {
        // Compared against a ref, not the `game` state: this handler is registered once inside
        // join(), so any state it closes over is frozen at its first render.
        if (gameIdRef.current !== msg.gameId) {
          gameIdRef.current = msg.gameId;
          setGameResult(null);
        }
        setGame({ gameId: msg.gameId, state: msg.state });
      } else if (msg.t === "gameFailure") {
        setFailedGameId(msg.gameId);
      } else if (msg.t === "error") {
        // A failed per-game setup (e.g. Music Guesser's Deezer fetch) happens mid-room, after
        // join - surface it back into the config remote instead of ejecting to the join screen.
        if (msg.code === "setup_failed") {
          setConfigError(msg.message);
        } else {
          setError(msg.message);
          setStatus("error");
        }
      }
    });
    const token = localStorage.getItem(`hubbub:token:${code}`) ?? undefined;
    t.send({ t: "joinRoom", name: identity.name, colorId: identity.colorId, avatarId: identity.avatarId, token });
  }

  // apps/web collects the code on its own join screen and hands it over, so joining
  // again here would make the player type the same code twice.
  const autoJoined = useRef(false);
  useEffect(() => {
    if (!initialCode || autoJoined.current || !identity || status !== "idle") return;
    autoJoined.current = true;
    void join();
  }, [initialCode, identity, status]);

  // Leaving is a deliberate exit, unlike a WiFi-blip reconnect - drop the token so
  // a future join doesn't try to reclaim this slot.
  function leaveRoom() {
    transportRef.current?.close();
    localStorage.removeItem(`hubbub:token:${code}`);
    setStatus("idle");
    setRoom(null);
    setGame(null);
    setPlayerId("");
    setTier({ tier: null, rttMs: null });
  }

  return {
    status,
    error,
    playerId,
    room,
    game,
    gameResult,
    setGameResult,
    failedGameId,
    setFailedGameId,
    configError,
    setConfigError,
    tier,
    transportRef,
    join,
    leaveRoom,
  };
}
