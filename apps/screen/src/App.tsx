import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { WebSocketClientTransport, type GameSummary, type Player } from "@hubbub/protocol";
import { getScreen } from "./game";
import { Lobby } from "./lobby";
import { SERVER_URL, CONTROLLER_URL } from "./config";

interface RoomState {
  players: Player[];
  hostId: string | null;
  mode: "lobby" | "in-game";
  currentGameId: string | null;
  cursorIndex: number;
  games: GameSummary[];
}

interface GameState {
  gameId: string;
  state: any;
}

export function App() {
  const [code, setCode] = useState<string>("");
  const [qr, setQr] = useState<string>("");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const transportRef = useRef<WebSocketClientTransport>();

  useEffect(() => {
    const t = new WebSocketClientTransport(SERVER_URL);
    transportRef.current = t;
    let off = () => {};
    t.connect().then(() => {
      off = t.onMessage((msg) => {
        if (msg.t === "roomCreated") {
          setCode(msg.code);
          QRCode.toDataURL(`${CONTROLLER_URL}/?room=${msg.code}`).then(setQr);
        } else if (msg.t === "roomState") {
          setRoom({
            players: msg.players,
            hostId: msg.hostId,
            mode: msg.mode,
            currentGameId: msg.currentGameId,
            cursorIndex: msg.cursorIndex,
            games: msg.games,
          });
        } else if (msg.t === "gameState") {
          setGame({ gameId: msg.gameId, state: msg.state });
        }
      });
      t.send({ t: "createRoom" });
    });
    return () => {
      off();
      t.close();
    };
  }, []);

  const Screen = getScreen(game?.gameId ?? null);

  if (room?.mode === "in-game" && Screen && game) {
    return (
      <main style={{ fontFamily: "system-ui", textAlign: "center", padding: 32 }}>
        <Screen state={game.state} />
      </main>
    );
  }

  return (
    <main style={{ fontFamily: "system-ui", textAlign: "center", padding: 32 }}>
      <h1>Hubbub</h1>
      <Lobby
        code={code}
        qr={qr}
        controllerLabel={CONTROLLER_URL.replace(/^https?:\/\//, "")}
        players={room?.players ?? []}
        hostId={room?.hostId ?? null}
        games={room?.games ?? []}
        cursorIndex={room?.cursorIndex ?? 0}
      />
    </main>
  );
}
