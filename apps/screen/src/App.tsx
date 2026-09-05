import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { createRoomHttp, roomSocketUrl, type Player } from "@hubbub/protocol";
import { WebRtcClientTransport } from "@hubbub/protocol/webrtc";
import { visibleSettingsFields } from "@hubbub/sdk";
import { SandboxFrame } from "@hubbub/sandbox/react";
import { assertDistinctOrigin } from "@hubbub/sandbox";
import {
  TVStage,
  GameTopBar,
  EndOfRoundScreen,
  GameFailedScreen,
  GameLoadingScreen,
  SandboxUnavailableScreen,
  colorHex,
  type GameTopBarPlayer,
} from "@hubbub/ui";
import { getSettingsSchema } from "./game";
import { useScreenAuthority } from "./use-screen-authority";
import { useScreenTransitions } from "./use-screen-transitions";
import { rosterIdsChanged } from "./roster-diff";
import { Lobby } from "./lobby";
import { Hero } from "./hero";
import { ConfigPanel } from "./config-panel";
import { SERVER_URL, CONTROLLER_URL, STUN_URL, SANDBOX_URL } from "./config";
import { formatHostLabel } from "./format-host-label";
import { loadScreenSession, saveScreenSession, clearScreenSession } from "./screen-session";

const HOST_LABEL = formatHostLabel(CONTROLLER_URL);

declare const __HUBBUB_DEV_LOADER__: boolean;
const DEV_LOADER = __HUBBUB_DEV_LOADER__;

// Checked once at module load rather than per mount: a collapsed origin is a deployment fact, so
// there is no point discovering it again for every game the room tries. See S5.
const SANDBOX_ORIGIN_ERROR = (() => {
  if (DEV_LOADER) return null;
  try {
    assertDistinctOrigin(SANDBOX_URL, window.location.origin);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Sandbox origin is misconfigured.";
  }
})();

// Null in production, so rollup drops the import and the whole workspace-game loader with it (S1).
const LazyDirectGameView = DEV_LOADER ? lazy(() => import("./direct-game-view")) : null;

interface GameState {
  gameId: string;
  state: any;
}

/** Fluid by default. With an aspectRatio, letterboxes to the largest centred box of
 * that ratio via inset:0 + auto margins + aspect-ratio - no JS measuring needed. */
function GameSlot({ aspectRatio, children }: { aspectRatio?: number; children: ReactNode }) {
  if (!aspectRatio) {
    return <div style={{ flex: 1, minHeight: 0, position: "relative" }}>{children}</div>;
  }
  return (
    <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          margin: "auto",
          aspectRatio: String(aspectRatio),
          maxWidth: "100%",
          maxHeight: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>{children}</div>
      </div>
    </div>
  );
}

/** `preplayCorner` is the shell's escape hatch (the web app's "Join instead"), shown only where
 * the role decision still matters: the hero and the lobby. Once a game is up the corner belongs to
 * the game and TVStage's sound pill. */
export function App({ preplayCorner }: { preplayCorner?: ReactNode } = {}) {
  const [code, setCode] = useState<string>("");
  const [qr, setQr] = useState<string>("");
  const [connectError, setConnectError] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const transportRef = useRef<WebRtcClientTransport>();
  const launchedGameIdRef = useRef<string | null>(null);

  const { room, applyRoom, result, applyResult, failedGameId, applyFailedGameId, getFailedGameId } = useScreenTransitions();

  const { authority, sandboxRef, reportFailure } = useScreenAuthority(transportRef, { onResult: applyResult, getFallbackGameId: () => launchedGameIdRef.current, setFailedGameId: applyFailedGameId });

  useEffect(() => {
    let cancelled = false;
    let transport: WebRtcClientTransport | undefined;
    let off = () => {};
    let prevPlayerIds: Set<string> | null = null;
    let latestPlayers: Player[] = [];

    // Registers the steady-state handlers a screen needs for the room's entire lifetime,
    // whether this connection was a fresh createRoomHttp or a resumed reattach.
    function wire(t: WebRtcClientTransport) {
      return t.onMessage((msg) => {
        if (msg.t === "roomCreated") {
          setCode(msg.code);
          if (msg.screenToken) saveScreenSession(sessionStorage, { code: msg.code, token: msg.screenToken });
          QRCode.toDataURL(`${CONTROLLER_URL}/?room=${msg.code}`).then(setQr);
        } else if (msg.t === "roomState") {
          if (msg.mode !== "configuring") setSetupError(null);
          const ids = new Set(msg.players.map((p) => p.id));
          latestPlayers = msg.players;
          if (msg.mode === "in-game" && rosterIdsChanged(prevPlayerIds, ids)) {
            authority.playersChanged(latestPlayers);
          }
          prevPlayerIds = ids;
          // Only a different, real launch clears the overlay. The failure's own flip to lobby
          // leaves currentGameId null, and that is exactly when it must still be showing.
          const currentFailed = getFailedGameId();
          if (msg.currentGameId && currentFailed && currentFailed !== msg.currentGameId) applyFailedGameId(null);
          applyRoom({
            players: msg.players,
            hostId: msg.hostId,
            mode: msg.mode,
            currentGameId: msg.currentGameId,
            cursorIndex: msg.cursorIndex,
            games: msg.games,
            suggestions: msg.suggestions,
            config: msg.config ?? null,
            inputLegend: msg.inputLegend ?? [],
          });
        } else if (msg.t === "gameState") {
          setGame({ gameId: msg.gameId, state: msg.state });
        } else if (msg.t === "gameLaunch") {
          // setup() already ran server-side; the reducer starts here (screen authority) or, under
          // the sandbox, inside the frame - either way this screen drives it.
          setSetupError(null);
          applyResult(null);
          applyFailedGameId(null);
          launchedGameIdRef.current = msg.gameId;
          // gameLaunch carries {id,name} only; the views want the full roster, and roomState's
          // copy is the one that has it.
          const launchRoster = latestPlayers.length ? latestPlayers : msg.players.map((p) => ({ ...p, colorId: 0, avatarId: "", connected: true }));
          authority.launch(msg.gameId, launchRoster, msg.setupData, msg.now);
        } else if (msg.t === "gameFailure") {
          applyFailedGameId(msg.gameId);
        } else if (msg.t === "gameAction") {
          authority.action(msg.playerId, msg.payload, msg.now);
        } else if (msg.t === "error" && msg.code === "setup_failed") {
          // The relay sends this to the screen as well as the host's phone, so the room can see
          // why nothing happened. tryReattach's own error handler is scoped to its own promise.
          setSetupError(msg.message ?? "This game couldn't start.");
        }
      });
    }

    // A reload's saved room+token reattaches instead of creating a new room. Any failure
    // (dead room, rejected token) reports false so start() falls back to a fresh room -
    // never a hang or an error screen.
    async function tryReattach(stored: { code: string; token: string }): Promise<boolean> {
      const t = new WebRtcClientTransport(roomSocketUrl(SERVER_URL, stored.code), "screen", { stunUrl: STUN_URL });
      try {
        await t.connect();
      } catch {
        return false; // unknown/dead room 404s the WS handshake itself
      }
      if (cancelled) { t.close(); return true; }
      const permanentOff = wire(t);
      const accepted = await new Promise<boolean>((resolve) => {
        const stopWaiting = t.onMessage((msg) => {
          if (msg.t === "roomCreated") { stopWaiting(); resolve(true); }
          else if (msg.t === "error") { stopWaiting(); resolve(false); }
        });
        t.send({ t: "attachScreen", token: stored.token });
      });
      if (!accepted) { permanentOff(); t.close(); return false; }
      transport = t;
      transportRef.current = t;
      off = permanentOff;
      return true;
    }

    // A Durable Object is addressed by name at connect time, so the room code has to exist
    // before the socket opens: POST for the code, then connect straight to /room/:code.
    async function createFresh() {
      try {
        const roomCode = await createRoomHttp(SERVER_URL);
        if (cancelled) return;
        const t = new WebRtcClientTransport(roomSocketUrl(SERVER_URL, roomCode), "screen", { stunUrl: STUN_URL });
        transport = t;
        transportRef.current = t;
        await t.connect();
        off = wire(t);
        t.send({ t: "attachScreen" });
      } catch {
        if (!cancelled) setConnectError("Couldn't reach the server. Check your connection and refresh.");
      }
    }

    async function start() {
      const stored = loadScreenSession(sessionStorage);
      if (stored) {
        if (await tryReattach(stored)) return;
        if (cancelled) return;
        clearScreenSession(sessionStorage);
      }
      await createFresh();
    }
    start();

    return () => {
      cancelled = true;
      off();
      transport?.close();
    };
  }, []);

  // A returnToLobby (no follow-up gameLaunch) leaves the old instance/timer running otherwise -
  // a rematch's fresh gameLaunch already clears it via authority.launch, so only handle this exit.
  useEffect(() => {
    if (room?.mode !== "in-game") authority.reset();
  }, [room?.mode, authority]);

  const pendingGameId = room?.currentGameId ?? null;
  const pendingSummary = room?.games.find((g) => g.id === pendingGameId) ?? null;

  // Outranks every other in-game branch: once a game has died, nothing about it should keep
  // rendering, least of all its own last frame looking merely paused.
  if (failedGameId) {
    const failedSummary = room?.games.find((g) => g.id === failedGameId) ?? null;
    return (
      <TVStage inputLegend={room?.inputLegend}>
        <GameFailedScreen gameName={failedSummary?.name ?? "Game"} identityColors={failedSummary?.identityColors} />
      </TVStage>
    );
  }

  if (room?.mode === "in-game" && SANDBOX_ORIGIN_ERROR) {
    return (
      <TVStage inputLegend={room?.inputLegend}>
        <SandboxUnavailableScreen />
      </TVStage>
    );
  }

  // The sandboxed driver needs its frame mounted to make ANY progress at all: the bridge only
  // attaches from the frame's own onConnect, and nothing produces a first gameState until that
  // bridge exists. Gating the mount on `game` (matching pendingGameId) was a deadlock - the frame
  // never mounted because there was no state, and there was no state because the frame never
  // mounted. So the game view mounts as soon as a game is pending, and the loading screen is an
  // overlay on top of it rather than a replacement for it (todo 85).
  if (room?.mode === "in-game" && pendingGameId) {
    const readyGame = game && game.gameId === pendingGameId ? game : null;

    if (readyGame && result) {
      const winnerPlayer = result.winnerId ? room.players.find((p) => p.id === result.winnerId) ?? null : null;
      const winner =
        !result.isDraw && winnerPlayer
          ? {
              name: winnerPlayer.name,
              avatarId: winnerPlayer.avatarId,
              rankLabel: "1",
              rankSuffix: "ST",
            }
          : null;
      // Games that rank their players supply standings; the screen shows the top places and every
      // phone shows the whole table, so the room shares the outcome and each player reads their own.
      const standings = result.standings
        ?.map((s) => {
          const p = room.players.find((pp) => pp.id === s.playerId);
          return p ? { position: s.position, name: p.name, avatarId: p.avatarId, score: s.score == null ? "" : String(s.score) } : null;
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);
      return (
        <TVStage inputLegend={room?.inputLegend}>
          <EndOfRoundScreen
            gameName={pendingSummary?.name ?? "Game"}
            roundLabel="Results"
            roomCode={code}
            playerCount={room.players.length}
            winner={winner}
            standings={standings}
            showActions
          />
        </TVStage>
      );
    }

    const topBarPlayers: GameTopBarPlayer[] = room.players.map((p) => ({
      name: p.name,
      colorHex: colorHex(p.colorId),
      avatarId: p.avatarId,
      host: p.id === room.hostId,
      connected: p.connected,
    }));

    return (
      <TVStage inputLegend={room?.inputLegend}>
        <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div
            className="hb-anim-enter"
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              animation: "hb-game-in 260ms cubic-bezier(.2,.8,.2,1) 1 both",
            }}
          >
            <GameTopBar title={pendingSummary?.name ?? ""} roomCode={code} hostLabel={HOST_LABEL} players={topBarPlayers} />
            <GameSlot aspectRatio={pendingSummary?.aspectRatio}>
              {LazyDirectGameView ? (
                readyGame ? (
                  <Suspense fallback={null}>
                    <LazyDirectGameView gameId={readyGame.gameId} state={readyGame.state} players={room.players} />
                  </Suspense>
                ) : null
              ) : (
                <SandboxFrame
                  base={SANDBOX_URL}
                  gameId={pendingGameId}
                  version="dev"
                  role="screen"
                  players={room.players.map((p) => ({ id: p.id, name: p.name }))}
                  onConnect={(bridge) => sandboxRef.current?.attach(bridge)}
                  onMessage={(msg) => sandboxRef.current?.handle(msg)}
                  onError={() => reportFailure()}
                />
              )}
            </GameSlot>
          </div>
          {readyGame ? null : (
            <div style={{ position: "absolute", inset: 0 }}>
              <GameLoadingScreen
                gameName={pendingSummary?.name ?? "Game"}
                identityColors={pendingSummary?.identityColors}
                category={pendingSummary?.category}
              />
            </div>
          )}
        </div>
      </TVStage>
    );
  }

  if (room?.mode === "configuring" && room.config) {
    const schema = getSettingsSchema(room.config.gameId) ?? [];
    const gameName = room.games.find((g) => g.id === room.config!.gameId)?.name ?? "";
    return (
      <TVStage inputLegend={room?.inputLegend}>
        {/* Plain fade, not a second choreography: the lobby-to-game beat already opened the box. */}
        <div className="hb-anim-enter" style={{ flex: 1, minHeight: 0, display: "flex", animation: "hb-fade-in 200ms ease-out 1 both" }}>
        <ConfigPanel
          code={code}
          hostLabel={HOST_LABEL}
          gameName={gameName}
          fields={visibleSettingsFields(schema, room.config.values)}
          values={room.config.values}
          cursorIndex={room.config.cursorIndex}
          setupError={setupError ?? undefined}
        />
        </div>
      </TVStage>
    );
  }

  // Zero players: hero screen instead of the lobby. First join flips this for good.
  if ((room?.players.length ?? 0) === 0) {
    return (
      <TVStage inputLegend={room?.inputLegend}>
        <Hero code={code} qr={qr} error={connectError ?? undefined} />
        {preplayCorner}
      </TVStage>
    );
  }

  return (
    <TVStage inputLegend={room?.inputLegend}>
      <Lobby
        code={code}
        qr={qr}
        controllerLabel={CONTROLLER_URL.replace(/^https?:\/\//, "")}
        players={room?.players ?? []}
        hostId={room?.hostId ?? null}
        games={room?.games ?? []}
        cursorIndex={room?.cursorIndex ?? 0}
        suggestions={room?.suggestions ?? []}
      />
      {preplayCorner}
    </TVStage>
  );
}
