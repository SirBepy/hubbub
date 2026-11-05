// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GameEndControls } from "./GameEndControls";

afterEach(cleanup);

describe("GameEndControls", () => {
  it("host gets both buttons wired to their callbacks", () => {
    const onRematch = vi.fn();
    const onReturnToLobby = vi.fn();
    render(<GameEndControls isHost onRematch={onRematch} onReturnToLobby={onReturnToLobby} />);
    fireEvent.click(screen.getByText("Rematch"));
    fireEvent.click(screen.getByText("Back to lobby"));
    expect(onRematch).toHaveBeenCalledTimes(1);
    expect(onReturnToLobby).toHaveBeenCalledTimes(1);
  });

  it("disables Rematch and says so while pending", () => {
    render(<GameEndControls isHost rematchPending onRematch={() => {}} onReturnToLobby={() => {}} />);
    expect((screen.getByText("Starting…").closest("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("non-host sees a waiting caption and no buttons", () => {
    render(<GameEndControls isHost={false} onRematch={() => {}} onReturnToLobby={() => {}} />);
    expect(screen.getByText("Waiting for the host…")).toBeTruthy();
    expect(screen.queryByText("Rematch")).toBeNull();
  });
});
