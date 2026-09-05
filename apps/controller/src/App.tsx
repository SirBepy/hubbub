import { lazy, Suspense, useState, type CSSProperties } from "react";
import { visibleSettingsFields } from "@hubbub/sdk";
import {
  InputActionProvider,
  useRegisterInputActions,
  type InputAction,
} from "@hubbub/sdk/input";
import { GlowButton, NeutralButton, GameLoadingScreen, transitionView } from "@hubbub/ui";
import { getSettingsSchema } from "./game";
import { GameFailed } from "./game-failed";
import { usePublishInputLegend } from "./input-legend";
import { useRoomState } from "./use-room-state";
import { SandboxController } from "./sandbox-controller";
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

const roomFromUrl = new URLSearchParams(location.search).get("room") ?? "";

declare const __HUBBUB_DEV_LOADER__: boolean;
const DEV_LOADER = __HUBBUB_DEV_LOADER__;
// Null in production, so rollup drops the import and the workspace-game loader with it (S1).
const LazyDirectControllerView = DEV_LOADER ? lazy(() => import("./direct-controller-view")) : null;

// Sub-screens reached from the lobby footer or the fullscreen menu. Share/PassRemote/
// HowToPlay/About all drill down from the menu, so their back caret returns to it.
type PhoneView = "search" | "menu" | "share" | "howToPlay" | "about" | "passRemote" | null;

/** The phone owns the gamepad: it is already the thing allowed to send rematch/returnToLobby,
 * so binding a pad here needs no new server authority. The TV only displays the legend. */
export function App(props: { initialCode?: string } = {}) {
  return (
    <InputActionProvider>
      <ControllerApp {...props} />
    </InputActionProvider>
  );
}

/** Declares its actions for as long as it is mounted, so the legend follows the screen the
 * player is actually on rather than being hoisted into one big conditional. */
function BindActions({ actions }: { actions: InputAction[] }) {
  useRegisterInputActions(actions);
  return null;
}

function ControllerApp({ initialCode }: { initialCode?: string } = {}) {
  const [identity, setIdentityState] = useState<Identity | null>(() => loadIdentity());
  const [code, setCode] = useState((initialCode ?? roomFromUrl).toUpperCase());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [phoneView, setPhoneView] = useState<PhoneView>(null);

  // Every sub-screen swap is a real page change on a phone, so both go through transitionView
  // rather than the raw setters - a bare setState here would hard-cut instead of cross-fading.
  const openView = (v: PhoneView) => transitionView(() => setPhoneView(v));
  const openSettings = (v: boolean) => transitionView(() => setSettingsOpen(v));

  const {
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
    leaveRoom: leaveRoomConnection,
  } = useRoomState(code, identity, initialCode);

  const isHost = room?.hostId === playerId;

  usePublishInputLegend(transportRef, status);

  const pendingGameId = room?.currentGameId ?? null;

  // Leaving is also a phone-menu reset, not just a room disconnect - otherwise a rejoin
  // would land back on whatever sub-screen the player left from.
  function leaveRoom() {
    leaveRoomConnection();
    openView(null);
  }

  // Identity-first: no saved identity means show Settings before anything else.
  if (!identity) {
    return (
      <Settings
        onSave={(id) => {
          saveIdentity(id);
          // The first identity save is a real page swap (Settings -> join/lobby), unlike the
          // in-room identity edit below which stays on the same page.
          transitionView(() => setIdentityState(id));
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
      openSettings(false);
    };

    if (settingsOpen) {
      return (
        <Settings
          initial={identity}
          onSave={applyIdentity}
          onCancel={() => openSettings(false)}
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
          onClose={() => openView(null)}
          onShare={() => openView("share")}
          onPassRemote={() => openView("passRemote")}
          onChangeAvatar={() => openSettings(true)}
          onHowToPlay={() => openView("howToPlay")}
          onAbout={() => openView("about")}
          onLeave={leaveRoom}
        />
      );
    }
    if (phoneView === "share") {
      return <ShareScreen code={code} onBack={() => openView("menu")} />;
    }
    if (phoneView === "howToPlay") {
      return <HowToPlayScreen onBack={() => openView("menu")} />;
    }
    if (phoneView === "about") {
      return <AboutScreen onBack={() => openView("menu")} />;
    }
    if (phoneView === "passRemote") {
      return (
        <PassRemoteScreen
          players={room.players}
          playerId={playerId}
          onTransfer={(toPlayerId) => transportRef.current?.send({ t: "transferHost", toPlayerId })}
          onBack={() => openView("menu")}
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
          onBack={() => openView(null)}
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
      const live = game && pendingGameId === game.gameId ? game : null;
      const result = gameResult;
      const pendingSummary = room.games.find((g) => g.id === pendingGameId) ?? null;

      return (
        <main style={gamePage}>
          <IdentityHeader
            name={me.name}
            avatarId={me.avatarId}
            isHost={isHost}
            onOpenMenu={() => openView("menu")}
            connectionTier={tier.tier}
            connectionRttMs={tier.rttMs}
          />
          <div style={gameBody}>
            {/* Before the game's own end view, not after: a game's controller fills the body, so a
                scoreboard appended below it lands off-screen on a phone nobody scrolls. */}
            {result?.standings?.length ? <Scoreboard standings={result.standings} players={room.players} meId={playerId} /> : null}
            {failedGameId ? (
              <GameFailed isHost={isHost} />
            ) : live && transportRef.current ? (
              LazyDirectControllerView ? (
                <Suspense fallback={null}>
                  <LazyDirectControllerView
                    gameId={live.gameId}
                    state={live.state}
                    playerId={playerId}
                    players={room.players}
                    transport={transportRef.current}
                    onResult={setGameResult}
                  />
                </Suspense>
              ) : (
                <SandboxController
                  gameId={live.gameId}
                  state={live.state}
                  playerId={playerId}
                  players={room.players}
                  transport={transportRef.current}
                  onResult={setGameResult}
                  onFailure={() => setFailedGameId(live.gameId)}
                />
              )
            ) : (
              <GameLoadingScreen
                gameName={pendingSummary?.name ?? "Game"}
                identityColors={pendingSummary?.identityColors}
                category={pendingSummary?.category}
              />
            )}
          </div>
          <div style={gameFooter}>
            {result ? (
              isHost ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <BindActions
                    actions={[
                      { id: "rematch", label: "Rematch", run: () => transportRef.current?.send({ t: "rematch" }) },
                      { id: "back", label: "Back to lobby", run: () => transportRef.current?.send({ t: "returnToLobby" }) },
                    ]}
                  />
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
        onOpenMenu={() => openView("menu")}
        onOpenSearch={() => openView("search")}
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
        onOpenMenu={() => openView("menu")}
        onOpenSearch={() => openView("search")}
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
      onOpenSettings={() => openSettings(true)}
      onSaveIdentity={(id) => {
        saveIdentity(id);
        setIdentityState(id);
        openSettings(false);
      }}
      onCancelSettings={() => openSettings(false)}
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
