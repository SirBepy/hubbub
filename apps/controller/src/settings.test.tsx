// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AVATAR_SETS } from "@hubbub/ui";
import { Settings } from "./settings";

const initial = { name: "Mira", colorId: 2, avatarId: AVATAR_SETS[0].characters[0].id };

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const nameField = () => screen.getByPlaceholderText("Your name") as HTMLInputElement;
const openPicker = () => fireEvent.click(screen.getByRole("button", { name: "Change avatar" }));
const type = (value: string) => fireEvent.change(nameField(), { target: { value } });

describe("Settings, first run (no onCancel)", () => {
  it("offers a Continue button that stays disabled until a name is typed, and no Save or Cancel", () => {
    const onSave = vi.fn();
    render(<Settings onSave={onSave} />);
    const cont = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    expect(cont.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();

    type("   ");
    expect(cont.disabled).toBe(true);
    type("  Bepy ");
    expect(cont.disabled).toBe(false);
    fireEvent.click(cont);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ name: "Bepy" });
  });

  it("does not save a half-finished identity when an avatar is picked or the name is typed", () => {
    const onSave = vi.fn();
    render(<Settings onSave={onSave} />);
    type("Bepy");
    act(() => vi.advanceTimersByTime(5000));
    openPicker();
    // First run pre-randomizes the avatar, so the picker may open on any set's tab.
    fireEvent.click(screen.getAllByRole("tab")[0]);
    fireEvent.click(screen.getByTitle(AVATAR_SETS[0].characters[1].label));
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("Settings, edit mode (onCancel set)", () => {
  it("has no Save or Cancel buttons and shows only the avatar and the name", () => {
    render(<Settings initial={initial} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
    expect(nameField().value).toBe("Mira");
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("hides the name in the picker and saves the moment an avatar is picked", () => {
    const onSave = vi.fn();
    render(<Settings initial={initial} onSave={onSave} onCancel={vi.fn()} />);
    openPicker();
    expect(screen.queryByPlaceholderText("Your name")).toBeNull();
    const next = AVATAR_SETS[0].characters[1];
    fireEvent.click(screen.getByTitle(next.label));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ name: "Mira", colorId: 2, avatarId: next.id });
  });

  it("keeps the picker open after a pick and returns to the profile via Back", () => {
    render(<Settings initial={initial} onSave={vi.fn()} onCancel={vi.fn()} />);
    openPicker();
    fireEvent.click(screen.getByTitle(AVATAR_SETS[0].characters[1].label));
    expect(screen.getByRole("tablist")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(nameField().value).toBe("Mira");
  });

  it("debounces a valid name edit into one save and never sends a blank one", () => {
    const onSave = vi.fn();
    render(<Settings initial={initial} onSave={onSave} onCancel={vi.fn()} />);
    type("Mir");
    type("Mira Q");
    expect(onSave).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1000));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ name: "Mira Q" });

    onSave.mockClear();
    type("   ");
    fireEvent.blur(nameField());
    act(() => vi.advanceTimersByTime(5000));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves an avatar pick under the last good name when the field is blank", () => {
    const onSave = vi.fn();
    render(<Settings initial={initial} onSave={onSave} onCancel={vi.fn()} />);
    type("");
    openPicker();
    fireEvent.click(screen.getByTitle(AVATAR_SETS[0].characters[1].label));
    expect(onSave.mock.calls[0][0].name).toBe("Mira");
  });

  it("flushes a pending valid name edit when leaving", () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(<Settings initial={initial} onSave={onSave} onCancel={onCancel} />);
    type("Mirabel");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ name: "Mirabel" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("warns instead of leaving when the name is blank, and saves nothing", () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(<Settings initial={initial} onSave={onSave} onCancel={onCancel} />);
    type("");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("dialog").textContent).toContain("A name is required");
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave anyway" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(5000));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("gives both confirm actions the same height", () => {
    render(<Settings initial={initial} onSave={vi.fn()} onCancel={vi.fn()} />);
    type("");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    const stay = screen.getByRole("button", { name: "Keep editing" });
    const leave = screen.getByRole("button", { name: "Leave anyway" });
    expect(stay.style.height).toBe("48px");
    expect(leave.style.height).toBe(stay.style.height);
  });
});

describe("Settings avatar picker tabs", () => {
  it("renders one tab per avatar set and shows only the active set's credits", () => {
    render(<Settings initial={initial} onSave={vi.fn()} onCancel={vi.fn()} />);
    openPicker();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(AVATAR_SETS.length);
    AVATAR_SETS.forEach((set, i) => expect(tabs[i].textContent).toContain(set.name));

    const [first, second] = AVATAR_SETS;
    expect(screen.getByText(first.attribution)).toBeTruthy();
    expect(screen.queryByText(second.attribution)).toBeNull();

    fireEvent.click(tabs[1]);
    expect(screen.getByText(second.attribution)).toBeTruthy();
    expect(screen.getByText(second.licenseName)).toBeTruthy();
    expect(screen.queryByText(first.attribution)).toBeNull();
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
  });

  it("opens on the tab that holds the current avatar", () => {
    const second = AVATAR_SETS[1];
    render(<Settings initial={{ ...initial, avatarId: second.characters[0].id }} onSave={vi.fn()} onCancel={vi.fn()} />);
    openPicker();
    expect(screen.getByText(second.attribution)).toBeTruthy();
  });

  it("keeps a character taken by another connected player disabled", () => {
    const takenChar = AVATAR_SETS[0].characters[3];
    const onSave = vi.fn();
    const roomPlayers = [
      { id: "me", name: "Mira", avatarId: initial.avatarId, colorId: 2, connected: true },
      { id: "other", name: "Ana", avatarId: takenChar.id, colorId: 1, connected: true },
    ] as any;
    render(<Settings initial={initial} onSave={onSave} onCancel={vi.fn()} roomPlayers={roomPlayers} ownPlayerId="me" />);
    openPicker();
    const btn = screen.getByTitle(takenChar.label) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onSave).not.toHaveBeenCalled();
    expect((screen.getByTitle(AVATAR_SETS[0].characters[1].label) as HTMLButtonElement).disabled).toBe(false);
  });
});
