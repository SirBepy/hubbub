// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { sfx } from "@hubbub/sdk/sfx";
import { TVSettings } from "./TVSettings";

beforeEach(() => {
  localStorage.clear();
  sfx.setMuted(false);
  sfx.setVolume(1);
  vi.spyOn(sfx, "unlock").mockResolvedValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const gear = () => screen.getByRole("button", { name: "Settings" });
const slider = () => screen.getByRole("slider", { name: "Volume" }) as HTMLInputElement;

describe("TVSettings closed", () => {
  it("shows a quiet Settings button and none of the old 'Click for sound' nag", () => {
    render(<TVSettings />);
    expect(gear()).toBeTruthy();
    expect(screen.queryByText(/click for sound/i)).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps a 44px minimum hit area", () => {
    render(<TVSettings />);
    expect(gear().style.minWidth).toBe("44px");
    expect(gear().style.minHeight).toBe("44px");
  });

  it("shows no nag while nothing has unlocked the audio context yet", () => {
    // jsdom has no AudioContext, so the engine is genuinely locked here.
    expect(sfx.unlocked).toBe(false);
    render(<TVSettings />);
    expect(screen.queryByText(/click|sound|unmute/i)).toBeNull();
  });
});

describe("TVSettings open and close", () => {
  it("opens on click, closes on a second click, and exposes the state to assistive tech", () => {
    render(<TVSettings />);
    expect(gear().getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(gear());
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();
    expect(gear().getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(gear());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on Escape and hands focus back to the button", () => {
    render(<TVSettings />);
    fireEvent.click(gear());
    fireEvent.keyDown(slider(), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(gear());
  });

  it("closes on a press outside, but not on a press inside the panel", () => {
    render(<TVSettings />);
    fireEvent.click(gear());

    fireEvent.pointerDown(slider());
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("counts opening the panel as an unlock gesture", () => {
    render(<TVSettings />);
    fireEvent.click(gear());
    expect(sfx.unlock).toHaveBeenCalled();
  });
});

describe("TVSettings volume row", () => {
  it("renders the slider at the engine's current volume, 0 to 100", () => {
    sfx.setVolume(0.4);
    render(<TVSettings />);
    fireEvent.click(gear());
    expect(slider().type).toBe("range");
    expect(slider().min).toBe("0");
    expect(slider().max).toBe("100");
    expect(slider().value).toBe("40");
  });

  it("calls the engine's setter live as the slider moves", () => {
    const setVolume = vi.spyOn(sfx, "setVolume");
    render(<TVSettings />);
    fireEvent.click(gear());

    fireEvent.change(slider(), { target: { value: "35" } });
    expect(setVolume).toHaveBeenLastCalledWith(0.35);
    expect(sfx.volume).toBe(0.35);
    expect(slider().value).toBe("35");
  });

  it("plays one short blip on release, not per drag step", () => {
    const play = vi.spyOn(sfx, "play");
    render(<TVSettings />);
    fireEvent.click(gear());

    fireEvent.change(slider(), { target: { value: "20" } });
    fireEvent.change(slider(), { target: { value: "30" } });
    expect(play).not.toHaveBeenCalled();

    fireEvent.pointerUp(slider());
    expect(play).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledWith("pop");
  });

  it("blips on an arrow-key release too, but not on Tab", () => {
    const play = vi.spyOn(sfx, "play");
    render(<TVSettings />);
    fireEvent.click(gear());

    fireEvent.keyUp(slider(), { key: "Tab" });
    expect(play).not.toHaveBeenCalled();
    fireEvent.keyUp(slider(), { key: "ArrowRight" });
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("toggles mute from the speaker button and shows the muted state", () => {
    render(<TVSettings />);
    fireEvent.click(gear());

    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    expect(sfx.muted).toBe(true);
    expect(screen.getByText("Muted")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Unmute" }));
    expect(sfx.muted).toBe(false);
    expect(screen.getByText("100%")).toBeTruthy();
  });

  it("moving the slider while muted un-mutes, so the control never looks dead", () => {
    sfx.setMuted(true);
    render(<TVSettings />);
    fireEvent.click(gear());

    fireEvent.change(slider(), { target: { value: "50" } });
    expect(sfx.muted).toBe(false);
    expect(sfx.volume).toBe(0.5);
  });

  it("un-muting from a slider dragged to zero restores an audible volume", () => {
    sfx.setVolume(0);
    render(<TVSettings />);
    fireEvent.click(gear());

    fireEvent.click(screen.getByRole("button", { name: "Unmute" }));
    expect(sfx.volume).toBeGreaterThan(0);
  });
});
