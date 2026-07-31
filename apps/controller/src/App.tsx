import { useRef, useState, type CSSProperties } from "react";
import { WebSocketClientTransport, type Suggestion } from "@hubbub/protocol";
import { createActionSender } from "@hubbub/sdk/react";
import { getController } from "./game";
import { ControllerLobby } from "./lobby";
import { Settings } from "./settings";
import { loadIdentity, saveIdentity, type Identity } from "./identity";
import { SERVER_URL } from "./config";

const roomFromUrl = new URLSearchParams(location.search).get("room") ?? "";

type RoomState = {
  players: { id: string; name: string; color: string; emoji: string; connected: boolean }[];
  hostId: string | null;
  mode: "lobby" | "in-game";
  currentGameId: string | null;
  cursorIndex: number;
  games: { id: string; name: string; minPlayers: number; maxPlayers?: number; featured: boolean }[];
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
    t.send({ t: "joinRoom", code, name: identity.name, color: identity.color, emoji: identity.emoji, token });
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
      transportRef.current?.send({ t: "setIdentity", name: id.name, color: id.color, emoji: id.emoji });
      setSettingsOpen(false);
    };

    if (settingsOpen) {
      return (
        <Settings
          initial={identity}
          onSave={applyIdentity}
          onCancel={() => setSettingsOpen(false)}
        />
      );
    }

    if (room.mode === "in-game") {
      const Controller = getController(game?.gameId ?? null);
      return (
        <main style={ui}>
          {Controller && game && transportRef.current ? (
            <Controller
              state={game.state}
              playerId={playerId}
              send={createActionSender<any>(transportRef.current)}
            />
          ) : (
            <p>Loading game…</p>
          )}
          {isHost && (
            <button
              onClick={() => transportRef.current?.send({ t: "returnToLobby" })}
              style={{ ...button, background: "#eee" }}
            >
              Back to lobby
            </button>
          )}
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
        onNav={(dir) => transportRef.current?.send({ t: "lobbyNav", dir })}
        onFocus={(index) => transportRef.current?.send({ t: "lobbyFocus", index })}
        onConfirm={() => transportRef.current?.send({ t: "lobbyConfirm" })}
        onTransferHost={(toPlayerId) => transportRef.current?.send({ t: "transferHost", toPlayerId })}
        onSuggest={(gameId) => transportRef.current?.send({ t: "suggestGame", gameId })}
        onOpenSettings={() => setSettingsOpen(true)}
      />
    );
  }

  return (
    <main style={ui}>
      <h1>Hubbub</h1>
      <p>{identity.emoji} {identity.name}</p>
      <button onClick={() => setIdentityState(null)} style={{ ...button, fontSize: 16, background: "#eee" }}>
        Edit identity
      </button>
      <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ROOM" maxLength={4} style={input} />
      <button disabled={code.length !== 4 || status === "joining"} onClick={join} style={button}>
        {status === "joining" ? "Joining…" : "Join"}
      </button>
      {status === "error" && <p style={{ color: "crimson" }}>{error}</p>}
    </main>
  );
}

const ui: CSSProperties = { fontFamily: "system-ui", display: "flex", flexDirection: "column", gap: 16, padding: 24, maxWidth: 360, margin: "0 auto" };
const input: CSSProperties = { fontSize: 24, padding: 12, textAlign: "center" };
const button: CSSProperties = { fontSize: 24, padding: 12 };
