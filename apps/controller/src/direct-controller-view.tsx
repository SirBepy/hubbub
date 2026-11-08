import { createActionSender, PlatformProvider } from "@hubbub/sdk/react";
import type { Player } from "@hubbub/protocol";
import type { WebRtcClientTransport } from "@hubbub/protocol/webrtc";
import { loadGameController } from "./game";
import { useEffect, useMemo } from "react";
import { useLoadingGate } from "@hubbub/ui";
import type { GameResult } from "@hubbub/sdk";

// S2's sentinel, matching apps/screen. Must not survive into a production build.
export const DEV_LOADER_CONTROLLER_SENTINEL = "hubbub-dev-loader-controller-c0ffee";

/** The workspace-package render path for a phone. Dev loop only; eliminated from production. */
export default function DirectControllerView({
  gameId,
  state,
  playerId,
  players,
  transport,
  isHost,
  onResult,
}: {
  gameId: string;
  state: unknown;
  playerId: string;
  players: Player[];
  transport: WebRtcClientTransport;
  isHost: boolean;
  onResult: (result: GameResult | null) => void;
}) {
  const { value: loaded } = useLoadingGate(gameId, loadGameController);
  // Memoised on the inputs: logic.result builds a fresh object every call, and onResult sets state
  // in the parent, so an unmemoised result re-rendered this view into an endless update loop.
  const result = useMemo(() => loaded?.logic.result?.(state) ?? null, [loaded, state]);
  useEffect(() => { onResult(result); }, [result, onResult]);
  if (!loaded) return null;
  const Controller = loaded.Controller;
  return (
    <PlatformProvider isHost={isHost} onAction={(action) => transport.send({ t: action })}>
      <Controller state={state} playerId={playerId} players={players} send={createActionSender<any>(transport)} />
    </PlatformProvider>
  );
}
