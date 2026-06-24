import { useRef, useState, type CSSProperties } from "react";
import { WebSocketClientTransport } from "@hubbub/protocol";
import { useGameState, createActionSender } from "@hubbub/sdk/react";
import { GameController } from "./game";
import { SERVER_URL } from "./config";

const roomFromUrl = new URLSearchParams(location.search).get("room") ?? "";

export function App() {
  const [code, setCode] = useState(roomFromUrl.toUpperCase());
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "joining" | "in" | "error">("idle");
  const [error, setError] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [transport, setTransport] = useState<WebSocketClientTransport | null>(null);
  const transportRef = useRef<WebSocketClientTransport>();
  const game = useGameState<any>(transport);

  async function join() {
    setStatus("joining");
    const t = new WebSocketClientTransport(SERVER_URL);
    transportRef.current = t;
    await t.connect();
    t.onMessage((msg) => {
      if (msg.t === "joined") {
        localStorage.setItem(`hubbub:token:${code}`, msg.token);
        setPlayerId(msg.playerId);
        setStatus("in");
      } else if (msg.t === "error") {
        setError(msg.message);
        setStatus("error");
      }
    });
    setTransport(t);
    const token = localStorage.getItem(`hubbub:token:${code}`) ?? undefined;
    t.send({ t: "joinRoom", code, name, token });
  }

  if (status === "in") {
    return (
      <main style={ui}>
        {game ? (
          <GameController
            state={game}
            playerId={playerId}
            send={createActionSender<any>(transportRef.current!)}
          />
        ) : (
          <p>Waiting for the game…</p>
        )}
      </main>
    );
  }

  return (
    <main style={ui}>
      <h1>Hubbub</h1>
      <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ROOM" maxLength={4} style={input} />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={24} style={input} />
      <button disabled={code.length !== 4 || name.trim() === "" || status === "joining"} onClick={join} style={button}>
        {status === "joining" ? "Joining…" : "Join"}
      </button>
      {status === "error" && <p style={{ color: "crimson" }}>{error}</p>}
    </main>
  );
}

const ui: CSSProperties = { fontFamily: "system-ui", display: "flex", flexDirection: "column", gap: 16, padding: 24, maxWidth: 360, margin: "0 auto" };
const input: CSSProperties = { fontSize: 24, padding: 12, textAlign: "center" };
const button: CSSProperties = { fontSize: 24, padding: 12 };
