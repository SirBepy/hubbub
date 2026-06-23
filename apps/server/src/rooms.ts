import { type Player } from "@hubbub/protocol";
import { newRoomCode, newToken } from "@hubbub/protocol/tokens";

interface StoredPlayer extends Player {
  token: string;
}
interface Room {
  code: string;
  players: Map<string, StoredPlayer>;
}

export interface JoinOk {
  ok: true;
  playerId: string;
  token: string;
}
export interface JoinErr {
  ok: false;
  code: "no_room";
  message: string;
}

export class RoomManager {
  private rooms = new Map<string, Room>();

  createRoom(): string {
    let code = newRoomCode();
    while (this.rooms.has(code)) code = newRoomCode();
    this.rooms.set(code, { code, players: new Map() });
    return code;
  }

  hasRoom(code: string): boolean {
    return this.rooms.has(code);
  }

  join(code: string, name: string, token?: string): JoinOk | JoinErr {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, code: "no_room", message: "Room not found" };

    if (token) {
      for (const p of room.players.values()) {
        if (p.token === token) {
          p.name = name;
          p.connected = true;
          return { ok: true, playerId: p.id, token: p.token };
        }
      }
    }

    const id = newToken();
    const newTok = newToken();
    room.players.set(id, { id, name, connected: true, token: newTok });
    return { ok: true, playerId: id, token: newTok };
  }

  setConnected(code: string, playerId: string, connected: boolean): void {
    const p = this.rooms.get(code)?.players.get(playerId);
    if (p) p.connected = connected;
  }

  players(code: string): Player[] {
    const room = this.rooms.get(code);
    if (!room) return [];
    return [...room.players.values()].map(({ token, ...pub }) => pub);
  }
}
