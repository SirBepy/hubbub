import { describe, it, expect } from "vitest";
import { GAME_LOGICS } from "./logics.js";
import { GAME_SCREENS } from "./screens.js";
import { GAME_CONTROLLERS } from "./controllers.js";

describe("games manifest", () => {
  it("registers the same game ids in logics, screens, and controllers", () => {
    const logicIds = new Set(Object.keys(GAME_LOGICS));
    const screenIds = new Set(Object.keys(GAME_SCREENS));
    const controllerIds = new Set(Object.keys(GAME_CONTROLLERS));
    expect(screenIds).toEqual(logicIds);
    expect(controllerIds).toEqual(logicIds);
  });
});
