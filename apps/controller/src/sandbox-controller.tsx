import { useEffect, useRef } from "react";
import type { Player } from "@hubbub/protocol";
import type { WebRtcClientTransport } from "@hubbub/protocol/webrtc";
import { SandboxFrame } from "@hubbub/sandbox/react";
import type { SandboxBridge } from "@hubbub/sandbox";
import type { GameResult } from "@hubbub/sdk";
import { SANDBOX_URL } from "./config";

export function SandboxController({
  gameId,
  state,
  playerId,
  players,
  transport,
  onResult,
  onFailure,
}: {
  gameId: string;
  state: any;
  playerId: string;
  players: Player[];
  transport: WebRtcClientTransport;
  onResult: (result: GameResult | null) => void;
  onFailure: () => void;
}) {
  const bridgeRef = useRef<SandboxBridge | null>(null);

  // The frame holds the view, so a new state has to be handed across rather than re-rendered.
  useEffect(() => {
    bridgeRef.current?.send({ t: "state", state, playerId });
  }, [state, playerId]);

  return (
    <SandboxFrame
      base={SANDBOX_URL}
      gameId={gameId}
      version="dev"
      role="controller"
      players={players.map((p) => ({ id: p.id, name: p.name }))}
      onConnect={(bridge: SandboxBridge) => {
        bridgeRef.current = bridge;
        bridge.send({ t: "state", state, playerId });
      }}
      onMessage={(msg) => {
        // The phone is a dumb controller: the only things it sends upward are an
        // action, which the relay revalidates against the game's own schema, and the
        // result its own copy of the logic derived from the state it was given.
        if (msg.t === "action") transport.send({ t: "action", payload: msg.action });
        else if (msg.t === "result") onResult(msg.result);
      }}
      onError={onFailure}
    />
  );
}
