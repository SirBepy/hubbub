import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { WebSocketClientTransport, type GameSummary, type Player, type Suggestion } from "@hubbub/protocol";
import { TVStage, GameTopBar, PlayerPill, EndOfRoundScreen, colorHex } from "@hubbub/ui";
import { getScreen, getLogic } from "./game";
import { Lobby } from "./lobby";
import { SERVER_URL, CONTROLLER_URL } from "./config";

interface RoomState {
  players: Player[];
  hostId: string | null;
  mode: "lobby" | "in-game";
  currentGameId: string | null;
  cursorIndex: number;
  games: GameSummary[];
  suggestions: Suggestion[];
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
            suggestions: msg.suggestions,
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
  const logic = getLogic(game?.gameId ?? null);

  if (room?.mode === "in-game" && Screen && game) {
    const players = room.players;
    const summary = room.games.find((g) => g.id === game.gameId) ?? null;
    const pairHexes: [string, string] = summary?.identityColors
      ? [colorHex(summary.identityColors[0]), colorHex(summary.identityColors[1])]
      : [colorHex(1), colorHex(0)];

    const result = logic?.result?.(game.state) ?? null;
    if (result) {
      const winnerPlayer = result.winnerId ? players.find((p) => p.id === result.winnerId) ?? null : null;
      const winner =
        !result.isDraw && winnerPlayer
          ? {
              name: winnerPlayer.name,
              emoji: winnerPlayer.emoji,
              colorHex: colorHex(winnerPlayer.colorId),
              rankLabel: "1",
              rankSuffix: "ST",
            }
          : null;
      return (
        <TVStage>
          <EndOfRoundScreen
            gameName={summary?.name ?? "Game"}
            roundLabel="Results"
            roomCode={code}
            playerCount={players.length}
            winner={winner}
            showActions
          />
        </TVStage>
      );
    }

    return (
      <TVStage>
        <div style={{ width: 1920, height: 1080, display: "flex", flexDirection: "column" }}>
          <GameTopBar title={(summary?.name ?? "").toUpperCase()} pairHexes={pairHexes} roomCode={code}>
            {players.map((p) => (
              <PlayerPill key={p.id} colorHex={colorHex(p.colorId)} emoji={p.emoji} locked={p.connected} />
            ))}
          </GameTopBar>
          <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
            <Screen state={game.state} players={players} />
          </div>
        </div>
      </TVStage>
    );
  }

  return (
    <TVStage>
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
    </TVStage>
  );
}
