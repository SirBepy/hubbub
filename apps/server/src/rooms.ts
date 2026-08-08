import { newRoomCode } from "@hubbub/protocol/tokens";
import { noopLogger, Room, type GameCatalog, type RelayLogger, type TokenSource } from "@hubbub/relay";

/** Multi-room index only - all per-room relay logic (join, host, lobby, config, game launch)
 * now lives in @hubbub/relay's Room, since a Durable Object instance IS one room. This class
 * keeps just what apps/server owns: code allocation and the code -> Room lookup. */
export class RoomManager {
  private rooms = new Map<string, Room>();

  constructor(private catalog: GameCatalog, private tokens: TokenSource, private logger: RelayLogger = noopLogger) {}

  createRoom(): string {
    let code = newRoomCode();
    while (this.rooms.has(code)) code = newRoomCode();
    this.rooms.set(code, Room.create(code, this.catalog, this.tokens, this.logger));
    return code;
  }

  /** Used by the HTTP upgrade gate (/room/:code) to 404 before the WS handshake completes. */
  has(code: string): boolean {
    return this.rooms.has(code);
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }
}
