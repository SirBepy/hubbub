import { useEffect, useRef, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { WebSocketClientTransport, type GameSummary, type Player, type RoomConfig, type Suggestion } from "@hubbub/protocol";
import { visibleSettingsFields } from "@hubbub/sdk";
import { TVStage, GameTopBar, EndOfRoundScreen, colorHex, type GameTopBarPlayer } from "@hubbub/ui";
import { getScreen, getLogic, getSettingsSchema } from "./game";
import { Lobby } from "./lobby";
import { ConfigPanel } from "./config-panel";
import { SERVER_URL, CONTROLLER_URL } from "./config";

interface RoomState {
  players: Player[];
  hostId: string | null;
  mode: "lobby" | "configuring" | "in-game";
  currentGameId: string | null;
  cursorIndex: number;
  games: GameSummary[];
  suggestions: Suggestion[];
  config: RoomConfig | null;
}

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
            config: msg.config ?? null,
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

    const topBarPlayers: GameTopBarPlayer[] = players.map((p) => ({
      name: p.name,
      colorHex: colorHex(p.colorId),
      emoji: p.emoji,
      host: p.id === room.hostId,
      connected: p.connected,
    }));

    return (
      <TVStage>
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <GameTopBar title={summary?.name ?? ""} pairHexes={pairHexes} roomCode={code} players={topBarPlayers} />
          <GameSlot aspectRatio={summary?.aspectRatio}>
            <Screen state={game.state} players={players} />
          </GameSlot>
        </div>
      </TVStage>
    );
  }

  if (room?.mode === "configuring" && room.config) {
    const schema = getSettingsSchema(room.config.gameId) ?? [];
    const gameName = room.games.find((g) => g.id === room.config!.gameId)?.name ?? "";
    return (
      <TVStage>
        <ConfigPanel
          code={code}
          gameName={gameName}
          fields={visibleSettingsFields(schema, room.config.values)}
          values={room.config.values}
          cursorIndex={room.config.cursorIndex}
        />
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
