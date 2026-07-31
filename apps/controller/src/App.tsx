import { useRef, useState, type CSSProperties } from "react";
import { WebSocketClientTransport, type Suggestion, type Player, type GameSummary } from "@hubbub/protocol";
import { createActionSender } from "@hubbub/sdk/react";
import { Avatar, GlowButton, NeutralButton, colorHex, colorName } from "@hubbub/ui";
import { getController, getLogic } from "./game";
import { ControllerLobby } from "./lobby";
import { Settings } from "./settings";
import { loadIdentity, saveIdentity, type Identity } from "./identity";
import { SERVER_URL } from "./config";

const roomFromUrl = new URLSearchParams(location.search).get("room") ?? "";

type RoomState = {
  players: Player[];
  hostId: string | null;
  mode: "lobby" | "in-game";
  currentGameId: string | null;
  cursorIndex: number;
  games: GameSummary[];
  suggestions: Suggestion[];
};
type GameSlot = { gameId: string; state: any };

export function App() {
  const [identity, setIdentityState] = useState<Identity | null>(() => loadIdentity());
  const [code, setCode] = useState(roomFromUrl.toUpperCase());
  const [status, setStatus] = useState<"idle" | "joining" | "in" | "error">("idle");
  const [error, setError] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [game, setGame] = useState<GameSlot | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const transportRef = useRef<WebSocketClientTransport>();

  const isHost = room?.hostId === playerId;

  async function join() {
    if (!identity) return;
    setStatus("joining");
    const t = new WebSocketClientTransport(SERVER_URL);
    transportRef.current = t;
    await t.connect();
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
        setError(msg.message);
        setStatus("error");
      }
    });
    const token = localStorage.getItem(`hubbub:token:${code}`) ?? undefined;
    t.send({ t: "joinRoom", code, name: identity.name, colorId: identity.colorId, emoji: identity.emoji, token });
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
    const applyIdentity = (id: Identity) => {
      saveIdentity(id);
      setIdentityState(id);
      transportRef.current?.send({ t: "setIdentity", name: id.name, colorId: id.colorId, emoji: id.emoji });
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

    if (room.mode === "in-game") {
      const Controller = getController(game?.gameId ?? null);
      const logic = getLogic(game?.gameId ?? null);
      const gameSummary = room.games.find((g) => g.id === game?.gameId);
      const [c1, c2] = gameSummary?.identityColors ?? [1, 0];
      const result = game && logic?.result ? logic.result(game.state) : null;

      return (
        <main style={gamePage}>
          <div style={gameHeader}>
            <div style={gameWordmark}>{(gameSummary?.name ?? "").toUpperCase()}</div>
            <div style={{ ...gameHairline, background: `linear-gradient(to right, ${colorHex(c1)}, ${colorHex(c2)})` }} />
          </div>
          <div style={gameBody}>
            {Controller && game && transportRef.current ? (
              <Controller
                state={game.state}
                playerId={playerId}
                players={room.players}
                send={createActionSender<any>(transportRef.current)}
              />
            ) : (
              <p style={{ color: "var(--text-muted)" }}>Loading game…</p>
            )}
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

    return (
      <ControllerLobby
        players={room.players}
        hostId={room.hostId}
        games={room.games}
        cursorIndex={room.cursorIndex}
        suggestions={room.suggestions}
        playerId={playerId}
        isHost={isHost}
        onFocus={(index) => transportRef.current?.send({ t: "lobbyFocus", index })}
        onConfirm={() => transportRef.current?.send({ t: "lobbyConfirm" })}
        onTransferHost={(toPlayerId) => transportRef.current?.send({ t: "transferHost", toPlayerId })}
        onSuggest={(gameId) => transportRef.current?.send({ t: "suggestGame", gameId })}
        onOpenSettings={() => setSettingsOpen(true)}
      />
    );
  }

  return (
    <main style={joinPage}>
      <div style={wordmark}>HUBBUB</div>
      <div style={joinIdentityRow}>
        <Avatar size={52} colorHex={colorHex(identity.colorId)} emoji={identity.emoji} surface={1} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={joinIdentityName}>{identity.name}</div>
          <div style={joinIdentitySub}>
            <span style={{ ...dot, background: colorHex(identity.colorId) }} />
            {colorName(identity.colorId)} · you
          </div>
        </div>
        <button type="button" onClick={() => setSettingsOpen(true)} style={editButton}>
          Edit
        </button>
      </div>
      {settingsOpen ? (
        <Settings
          initial={identity}
          onSave={(id) => {
            saveIdentity(id);
            setIdentityState(id);
            setSettingsOpen(false);
          }}
          onCancel={() => setSettingsOpen(false)}
        />
      ) : (
        <>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CODE"
            maxLength={4}
            style={codeInput}
          />
          <GlowButton
            height={56}
            label={status === "joining" ? "Joining…" : "Join room"}
            disabled={code.length !== 4 || status === "joining"}
            onClick={join}
          />
          {status === "error" && <p style={{ color: "var(--player-magenta)", font: "500 13px var(--font-ui)" }}>{error}</p>}
        </>
      )}
    </main>
  );
}

const joinPage: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
  height: "100dvh",
  padding: 16,
  background: "var(--surface-0)",
  color: "var(--text-primary)",
};
const wordmark: CSSProperties = { font: "700 22px var(--font-display)", letterSpacing: "0.03em" };
const joinIdentityRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: 12,
  background: "var(--surface-1)",
  border: "1px solid var(--divider)",
  borderRadius: "var(--radius-md)",
};
const joinIdentityName: CSSProperties = { font: "600 18px var(--font-ui)" };
const joinIdentitySub: CSSProperties = { display: "flex", alignItems: "center", gap: 6, font: "500 12px var(--font-ui)", color: "var(--text-muted)" };
const dot: CSSProperties = { width: 8, height: 8, borderRadius: "50%", flex: "none" };
const editButton: CSSProperties = {
  flex: "none",
  font: "600 13px var(--font-ui)",
  color: "var(--accent)",
  background: "transparent",
  border: "1px solid rgba(145,132,217,.55)",
  borderRadius: "var(--radius-md)",
  padding: "8px 12px",
  cursor: "pointer",
};
const codeInput: CSSProperties = {
  height: 56,
  padding: "0 12px",
  textAlign: "center",
  background: "var(--surface-1)",
  border: "1px solid var(--divider)",
  borderRadius: "var(--radius-md)",
  color: "var(--text-primary)",
  font: "700 32px var(--font-display)",
  letterSpacing: "0.12em",
};

const gamePage: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100dvh",
  background: "var(--surface-0)",
  color: "var(--text-primary)",
};
const gameHeader: CSSProperties = { flex: "none", padding: "8px 16px 12px" };
const gameWordmark: CSSProperties = { font: "700 22px var(--font-display)", letterSpacing: "0.06em", marginBottom: 6 };
const gameHairline: CSSProperties = { width: 88, height: 2 };
const gameBody: CSSProperties = { flex: 1, minHeight: 0, overflowY: "auto", padding: "0 16px" };
const gameFooter: CSSProperties = { flex: "none", padding: "12px 16px 16px", display: "flex", justifyContent: "center" };
const waitingCaption: CSSProperties = { font: "500 13px var(--font-ui)", color: "var(--text-faint)" };
