// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Scoreboard } from "./scoreboard";

afterEach(cleanup);

const players = [
  { id: "p1", name: "Mira", avatarId: "bear", colorId: 0 },
  { id: "p2", name: "Bepy", avatarId: "fox", colorId: 1 },
  { id: "p3", name: "Ana", avatarId: "deer", colorId: 2 },
] as any;

describe("Scoreboard", () => {
  it("lists every player with position and score, not just the top three", () => {
    render(
      <Scoreboard
        standings={[
          { playerId: "p1", position: 1, score: 70 },
          { playerId: "p2", position: 2, score: 55 },
          { playerId: "p3", position: 3, score: 40 },
        ]}
        players={players}
        meId="p3"
      />,
    );
    for (const name of ["Mira", "Bepy", "Ana"]) expect(screen.getByText(name)).toBeTruthy();
    expect(screen.getByText("40")).toBeTruthy();
  });

  it("renders tied positions as given rather than renumbering them", () => {
    render(
      <Scoreboard
        standings={[
          { playerId: "p1", position: 1, score: 70 },
          { playerId: "p2", position: 2, score: 55 },
          { playerId: "p3", position: 2, score: 55 },
        ]}
        players={players}
        meId={null}
      />,
    );
    expect(screen.getAllByText("2")).toHaveLength(2);
    expect(screen.queryByText("3")).toBeNull();
  });

  it("omits a score that the game did not supply", () => {
    const { container } = render(
      <Scoreboard standings={[{ playerId: "p1", position: 1 }]} players={players} meId="p1" />,
    );
    expect(screen.getByText("Mira")).toBeTruthy();
    expect(container.textContent).not.toContain("undefined");
  });

  it("drops a standing whose player has left, instead of rendering a blank row", () => {
    render(
      <Scoreboard
        standings={[
          { playerId: "p1", position: 1, score: 70 },
          { playerId: "ghost", position: 2, score: 10 },
        ]}
        players={players}
        meId="p1"
      />,
    );
    expect(screen.getByText("Mira")).toBeTruthy();
    expect(screen.queryByText("10")).toBeNull();
  });
});
