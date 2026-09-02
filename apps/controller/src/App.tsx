import { useEffect, useRef, useState, type CSSProperties } from "react";
import { roomSocketUrl, type Suggestion, type Player, type GameSummary, type RoomConfig } from "@hubbub/protocol";
import { WebRtcClientTransport, type TierState } from "@hubbub/protocol/webrtc";
import { createActionSender } from "@hubbub/sdk/react";
import { visibleSettingsFields } from "@hubbub/sdk";
import { GlowButton, NeutralButton, GameLoadingScreen, useLoadingGate } from "@hubbub/ui";
import { loadGameController, getSettingsSchema } from "./game";
import { HostLobby, PlayerLobby } from "./lobby";
import { ConfigRemote } from "./config-remote";
import { Settings } from "./settings";
import { MenuScreen } from "./menu";
import { SearchScreen } from "./search";
import { Scoreboard } from "./scoreboard";
import { ShareScreen } from "./share";
import { AboutScreen } from "./about";
import { HowToPlayScreen } from "./how-to-play";
import { PassRemoteScreen } from "./pass-remote";
import { JoinScreen } from "./join";
import { IdentityHeader } from "./header";
import { loadIdentity, saveIdentity, type Identity } from "./identity";
import { SERVER_URL, STUN_URL } from "./config";

const roomFromUrl = new URLSearchParams(location.search).get("room") ?? "";

type RoomState = {
  players: Player[];
  hostId: string | null;
  mode: "lobby" | "configuring" | "in-game";
  currentGameId: string | null;
  cursorIndex: number;
  games: GameSummary[];
  suggestions: Suggestion[];
  config: RoomConfig | null;
};
type GameSlot = { gameId: string; state: any };
// Sub-screens reached from the lobby footer or the fullscreen menu. Share/PassRemote/
// HowToPlay/About all drill down from the menu, so their back caret returns to it.
type PhoneView = "search" | "menu" | "share" | "howToPlay" | "about" | "passRemote" | null;

export function App({ initialCode }: { initialCode?: string } = {}) {
  const [identity, setIdentityState] = useState<Identity | null>(() => loadIdentity());
  const [code, setCode] = useState((initialCode ?? roomFromUrl).toUpperCase());
  const [status, setStatus] = useState<"idle" | "joining" | "in" | "error">("idle");
  const [error, setError] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [game, setGame] = useState<GameSlot | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [configError, setConfigError] = useState("");
  const [phoneView, setPhoneView] = useState<PhoneView>(null);
  const [tier, setTier] = useState<TierState>({ tier: null, rttMs: null });
  const transportRef = useRef<WebRtcClientTransport>();

  const isHost = room?.hostId === playerId;

  // Keyed on currentGameId so the chunk downloads while the host is still configuring.
  const pendingGameId = room?.currentGameId ?? null;
  const { value: loadedGame, showLoader } = useLoadingGate(pendingGameId, loadGameController);

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
      } else if (msg.t === "gameState") {
        setGame({ gameId: msg.gameId, state: msg.state });
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
    setPhoneView(null);
    setTier({ tier: null, rttMs: null });
  }

  // Identity-first: no saved identity means show Settings before anything else.
  if (!identity) {
    return (
      <Settings
        onSave={(id) => {
          saveIdentity(id);
          setIdentityState(id);
        }}
      />
    );
  }

  if (status === "in" && room) {
    const me = room.players.find((p) => p.id === playerId);

    const applyIdentity = (id: Identity) => {
      saveIdentity(id);
      setIdentityState(id);
      transportRef.current?.send({ t: "setIdentity", name: id.name, colorId: id.colorId, avatarId: id.avatarId });
      setSettingsOpen(false);
    };

    if (settingsOpen) {
      return (
        <Settings
          initial={identity}
          onSave={applyIdentity}
          onCancel={() => setSettingsOpen(false)}
          roomPlayers={room.players}
          ownPlayerId={playerId}
        />
      );
    }

    if (!me) {
      return <main style={loadingPage}>Joining…</main>;
    }

    if (phoneView === "menu") {
      return (
        <MenuScreen
          me={me}
          isHost={isHost}
          onClose={() => setPhoneView(null)}
          onShare={() => setPhoneView("share")}
          onPassRemote={() => setPhoneView("passRemote")}
          onChangeAvatar={() => setSettingsOpen(true)}
          onHowToPlay={() => setPhoneView("howToPlay")}
          onAbout={() => setPhoneView("about")}
          onLeave={leaveRoom}
        />
      );
    }
    if (phoneView === "share") {
      return <ShareScreen code={code} onBack={() => setPhoneView("menu")} />;
    }
    if (phoneView === "howToPlay") {
      return <HowToPlayScreen onBack={() => setPhoneView("menu")} />;
    }
    if (phoneView === "about") {
      return <AboutScreen onBack={() => setPhoneView("menu")} />;
    }
    if (phoneView === "passRemote") {
      return (
        <PassRemoteScreen
          players={room.players}
          playerId={playerId}
          onTransfer={(toPlayerId) => transportRef.current?.send({ t: "transferHost", toPlayerId })}
          onBack={() => setPhoneView("menu")}
        />
      );
    }
    if (phoneView === "search") {
      return (
        <SearchScreen
          games={room.games}
          suggestions={room.suggestions}
          playerId={playerId}
          onSuggest={(gameId) => transportRef.current?.send({ t: "suggestGame", gameId })}
          onBack={() => setPhoneView(null)}
        />
      );
    }

    if (room.mode === "configuring" && room.config) {
      const schema = getSettingsSchema(room.config.gameId) ?? [];
      const gameName = room.games.find((g) => g.id === room.config!.gameId)?.name ?? "";
      return (
        <ConfigRemote
          gameName={gameName}
          fields={visibleSettingsFields(schema, room.config.values)}
          values={room.config.values}
          cursorIndex={room.config.cursorIndex}
          isHost={isHost}
          error={configError}
          onCursor={(dir) => transportRef.current?.send({ t: "configCursor", dir })}
          onAdjust={(field, dir) => transportRef.current?.send({ t: "configAdjust", field, dir })}
          onSet={(field, value) => transportRef.current?.send({ t: "configSet", field, value })}
          onConfirm={() => { setConfigError(""); transportRef.current?.send({ t: "configConfirm" }); }}
          onCancel={() => { setConfigError(""); transportRef.current?.send({ t: "configCancel" }); }}
        />
      );
    }

    if (room.mode === "in-game") {
      const ready = loadedGame && game && pendingGameId === game.gameId ? loadedGame : null;
      const Controller = ready?.Controller ?? null;
      const logic = ready?.logic ?? null;
      const result = game && logic?.result ? logic.result(game.state) : null;
      const pendingSummary = room.games.find((g) => g.id === pendingGameId) ?? null;

      return (
        <main style={gamePage}>
          <IdentityHeader
            name={me.name}
            avatarId={me.avatarId}
            isHost={isHost}
            onOpenMenu={() => setPhoneView("menu")}
            connectionTier={tier.tier}
            connectionRttMs={tier.rttMs}
          />
          <div style={gameBody}>
            {/* Before the game's own end view, not after: a game's controller fills the body, so a
                scoreboard appended below it lands off-screen on a phone nobody scrolls. */}
            {result?.standings?.length ? <Scoreboard standings={result.standings} players={room.players} meId={playerId} /> : null}
            {Controller && game && transportRef.current ? (
              <Controller
                state={game.state}
                playerId={playerId}
                players={room.players}
                send={createActionSender<any>(transportRef.current)}
              />
            ) : showLoader ? (
              <GameLoadingScreen
                gameName={pendingSummary?.name ?? "Game"}
                identityColors={pendingSummary?.identityColors}
                category={pendingSummary?.category}
              />
            ) : null}
          </div>
          <div style={gameFooter}>
            {result ? (
              isHost ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <GlowButton
                    height={56}
                    label="Rematch"
                    fullWidth={false}
                    onClick={() => transportRef.current?.send({ t: "rematch" })}
                  />
                  <NeutralButton
                    height={56}
                    label="Back to lobby"
                    fullWidth={false}
                    onClick={() => transportRef.current?.send({ t: "returnToLobby" })}
                  />
                </div>
              ) : (
                <div style={waitingCaption}>Waiting for the host…</div>
              )
            ) : (
              isHost && (
                <NeutralButton
                  height={40}
                  label="Back to lobby"
                  fullWidth={false}
                  onClick={() => transportRef.current?.send({ t: "returnToLobby" })}
                />
              )
            )}
          </div>
        </main>
      );
    }

    return isHost ? (
      <HostLobby
        me={me}
        players={room.players}
        games={room.games}
        cursorIndex={room.cursorIndex}
        suggestions={room.suggestions}
        onFocus={(index) => transportRef.current?.send({ t: "lobbyFocus", index })}
        onStart={() => transportRef.current?.send({ t: "configStart" })}
        onOpenMenu={() => setPhoneView("menu")}
        onOpenSearch={() => setPhoneView("search")}
      />
    ) : (
      <PlayerLobby
        me={me}
        playerId={playerId}
        players={room.players}
        hostId={room.hostId}
        games={room.games}
        suggestions={room.suggestions}
        onSuggest={(gameId) => transportRef.current?.send({ t: "suggestGame", gameId })}
        onOpenMenu={() => setPhoneView("menu")}
        onOpenSearch={() => setPhoneView("search")}
      />
    );
  }

  return (
    <JoinScreen
      identity={identity}
      code={code}
      onCodeChange={setCode}
      status={status}
      error={error}
      onJoin={join}
      settingsOpen={settingsOpen}
      onOpenSettings={() => setSettingsOpen(true)}
      onSaveIdentity={(id) => {
        saveIdentity(id);
        setIdentityState(id);
        setSettingsOpen(false);
      }}
      onCancelSettings={() => setSettingsOpen(false)}
    />
  );
}

const loadingPage: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100dvh",
  background: "var(--surface-0)",
  color: "var(--text-muted)",
  font: "500 14px var(--font-ui)",
};
const gamePage: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100dvh",
  background: "var(--surface-0)",
  color: "var(--text-primary)",
};
const gameBody: CSSProperties = { flex: 1, minHeight: 0, overflowY: "auto", padding: "0 16px" };
const gameFooter: CSSProperties = { flex: "none", padding: "12px 16px 16px", display: "flex", justifyContent: "center" };
const waitingCaption: CSSProperties = { font: "500 13px var(--font-ui)", color: "var(--text-faint)" };
