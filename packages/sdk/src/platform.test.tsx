// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PlatformProvider, REMATCH_PENDING_MS, usePlatform } from "./platform.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Buttons() {
  const p = usePlatform();
  return (
    <>
      <button onClick={p.rematch}>{p.rematchPending ? "pending" : "rematch"}</button>
      <button onClick={p.returnToLobby}>lobby</button>
    </>
  );
}

describe("usePlatform", () => {
  it("host: rematch sends once, shows pending, and ignores mashing until the window passes", () => {
    vi.useFakeTimers();
    const onAction = vi.fn();
    render(<PlatformProvider isHost onAction={onAction}><Buttons /></PlatformProvider>);
    const btn = screen.getByText("rematch");
    for (let i = 0; i < 5; i++) fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith("rematch");
    expect(screen.getByText("pending")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(REMATCH_PENDING_MS + 1); });
    fireEvent.click(screen.getByText("rematch"));
    expect(onAction).toHaveBeenCalledTimes(2);
  });

  it("host: returnToLobby forwards", () => {
    const onAction = vi.fn();
    render(<PlatformProvider isHost onAction={onAction}><Buttons /></PlatformProvider>);
    fireEvent.click(screen.getByText("lobby"));
    expect(onAction).toHaveBeenCalledWith("returnToLobby");
  });

  it("non-host: every action is a no-op", () => {
    const onAction = vi.fn();
    render(<PlatformProvider isHost={false} onAction={onAction}><Buttons /></PlatformProvider>);
    fireEvent.click(screen.getByText("rematch"));
    fireEvent.click(screen.getByText("lobby"));
    expect(onAction).not.toHaveBeenCalled();
  });

  it("outside a provider the hook is inert instead of throwing", () => {
    render(<Buttons />);
    fireEvent.click(screen.getByText("rematch"));
    expect(screen.getByText("rematch")).toBeTruthy();
  });
});
