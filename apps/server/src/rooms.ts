import { type Identity, type Player, type Suggestion } from "@hubbub/protocol";
import { newRoomCode, newToken } from "@hubbub/protocol/tokens";

export type RoomMode = "lobby" | "configuring" | "in-game";
export type { Identity };

export interface RoomConfig { gameId: string; cursorIndex: number; values: Record<string, string>; }

interface StoredPlayer extends Player { token: string; }
interface Room {
  code: string;
  players: Map<string, StoredPlayer>;
  hostId: string | null;
  mode: RoomMode;
  currentGameId: string | null;
  cursorIndex: number;
  suggestions: Map<string, string>; // playerId -> gameId (latest wins)
  config: RoomConfig | null;
}

export interface JoinOk { ok: true; playerId: string; token: string; }
export interface JoinErr { ok: false; code: "no_room"; message: string; }

export class RoomManager {
  private rooms = new Map<string, Room>();

  createRoom(): string {
    let code = newRoomCode();
    while (this.rooms.has(code)) code = newRoomCode();
    this.rooms.set(code, { code, players: new Map(), hostId: null, mode: "lobby", currentGameId: null, cursorIndex: 0, suggestions: new Map(), config: null });
    return code;
  }

  join(code: string, identity: Identity, token?: string): JoinOk | JoinErr {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, code: "no_room", message: "Room not found" };

    if (token) {
      for (const p of room.players.values()) {
        if (p.token === token) {
          p.name = identity.name; p.colorId = identity.colorId; p.emoji = identity.emoji;
          p.connected = true;
          this.ensureHost(room);
          return { ok: true, playerId: p.id, token: p.token };
        }
      }
    }

    const id = newToken();
    const tok = newToken();
    room.players.set(id, { id, name: identity.name, colorId: identity.colorId, emoji: identity.emoji, connected: true, token: tok });
    this.ensureHost(room);
    return { ok: true, playerId: id, token: tok };
  }

  setIdentity(code: string, playerId: string, identity: Identity): void {
    const p = this.rooms.get(code)?.players.get(playerId);
    if (p) { p.name = identity.name; p.colorId = identity.colorId; p.emoji = identity.emoji; }
  }

  setConnected(code: string, playerId: string, connected: boolean): void {
    const room = this.rooms.get(code);
    const p = room?.players.get(playerId);
    if (!room || !p) return;
    p.connected = connected;
    if (!connected && room.hostId === playerId) room.hostId = this.oldestConnected(room);
    else if (connected) this.ensureHost(room);
  }

  private ensureHost(room: Room): void {
    if (room.hostId && room.players.get(room.hostId)?.connected) return;
    room.hostId = this.oldestConnected(room);
  }
  private oldestConnected(room: Room): string | null {
    for (const p of room.players.values()) if (p.connected) return p.id;
    return null;
  }

  hostId(code: string): string | null { return this.rooms.get(code)?.hostId ?? null; }
  isHost(code: string, playerId: string): boolean { return this.rooms.get(code)?.hostId === playerId; }

  transferHost(code: string, fromId: string, toId: string): boolean {
    const room = this.rooms.get(code);
    if (!room || room.hostId !== fromId) return false;
    const target = room.players.get(toId);
    if (!target || !target.connected) return false;
    room.hostId = toId;
    return true;
  }

  mode(code: string): RoomMode { return this.rooms.get(code)?.mode ?? "lobby"; }
  currentGameId(code: string): string | null { return this.rooms.get(code)?.currentGameId ?? null; }
  cursorIndex(code: string): number { return this.rooms.get(code)?.cursorIndex ?? 0; }

  setMode(code: string, mode: RoomMode, gameId: string | null): void {
    const room = this.rooms.get(code);
    if (!room) return;
    room.mode = mode;
    room.currentGameId = gameId;
  }

  config(code: string): RoomConfig | null { return this.rooms.get(code)?.config ?? null; }

  startConfig(code: string, gameId: string, defaults: Record<string, string>): void {
    const room = this.rooms.get(code);
    if (!room) return;
    room.mode = "configuring";
    room.config = { gameId, cursorIndex: 0, values: { ...defaults } };
  }

  moveConfigCursor(code: string, dir: "up" | "down", fieldCount: number): void {
    const room = this.rooms.get(code);
    if (!room?.config || fieldCount <= 0) return;
    const delta = dir === "up" ? -1 : 1;
    room.config.cursorIndex = Math.min(fieldCount - 1, Math.max(0, room.config.cursorIndex + delta));
  }
  /** Re-clamps the cursor after a showIf toggle changes the visible field count. */
  clampConfigCursor(code: string, fieldCount: number): void {
    const room = this.rooms.get(code);
    if (!room?.config || fieldCount <= 0) return;
    room.config.cursorIndex = Math.min(fieldCount - 1, Math.max(0, room.config.cursorIndex));
  }

  setConfigValue(code: string, field: string, value: string): void {
    const room = this.rooms.get(code);
    if (room?.config) room.config.values[field] = value;
  }

  cancelConfig(code: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    room.mode = "lobby";
    room.config = null;
  }
  clearConfig(code: string): void {
    const room = this.rooms.get(code);
    if (room) room.config = null;
  }

  moveCursor(code: string, dir: "up" | "down" | "left" | "right", count: number): void {
    const room = this.rooms.get(code);
    if (!room || count <= 0) return;
    const delta = dir === "left" || dir === "up" ? -1 : 1;
    room.cursorIndex = Math.min(count - 1, Math.max(0, room.cursorIndex + delta));
  }
  focusCursor(code: string, index: number, count: number): void {
    const room = this.rooms.get(code);
    if (!room || count <= 0) return;
    room.cursorIndex = Math.min(count - 1, Math.max(0, index));
  }

  /** Sets a player's suggestion (latest wins); suggesting the same game again toggles it off. */
  suggest(code: string, playerId: string, gameId: string): void {
    const room = this.rooms.get(code);
    if (!room || !room.players.has(playerId)) return;
    if (room.suggestions.get(playerId) === gameId) room.suggestions.delete(playerId);
    else room.suggestions.set(playerId, gameId);
  }
  dropSuggestion(code: string, playerId: string): void {
    this.rooms.get(code)?.suggestions.delete(playerId);
  }
  clearSuggestions(code: string): void {
    this.rooms.get(code)?.suggestions.clear();
  }
  suggestions(code: string): Suggestion[] {
    const room = this.rooms.get(code);
    if (!room) return [];
    return [...room.suggestions].map(([playerId, gameId]) => ({ gameId, playerId }));
  }

  connectedPlayers(code: string): Player[] {
    const room = this.rooms.get(code);
    if (!room) return [];
    return [...room.players.values()].filter((p) => p.connected).map(({ token, ...pub }) => pub);
  }
  players(code: string): Player[] {
    const room = this.rooms.get(code);
    if (!room) return [];
    return [...room.players.values()].map(({ token, ...pub }) => pub);
  }
}
