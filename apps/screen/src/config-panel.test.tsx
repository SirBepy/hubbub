// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ConfigPanel } from "./config-panel";

afterEach(cleanup);

const base = { code: "ABCD", hostLabel: "Bepy", gameName: "Music Guesser", fields: [], values: {}, cursorIndex: 0 };

describe("ConfigPanel setup failure", () => {
  it("shows the hint and no alert when setup has not failed", () => {
    render(<ConfigPanel {...base} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(/START to begin/)).toBeTruthy();
  });

  it("renders the game's own message verbatim, replacing the hint", () => {
    const message = "You need internet to play this game - Deezer could not be reached";
    render(<ConfigPanel {...base} setupError={message} />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(message);
    expect(screen.queryByText(/START to begin/)).toBeNull();
    expect(screen.getByText(/press START again/)).toBeTruthy();
  });
});
