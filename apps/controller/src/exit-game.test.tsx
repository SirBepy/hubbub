// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ExitGameButton } from "./exit-game";

afterEach(cleanup);

describe("ExitGameButton", () => {
  it("asks before exiting and only fires onExit on confirm", () => {
    const onExit = vi.fn();
    render(<ExitGameButton onExit={onExit} />);
    fireEvent.click(screen.getByLabelText("Exit game"));
    expect(onExit).not.toHaveBeenCalled();
    expect(screen.getByText(/Are you sure you want to exit the game/)).toBeTruthy();
    fireEvent.click(screen.getByText("Exit"));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("mounts the dialog on document.body, outside the header that holds the button", () => {
    const { container } = render(<ExitGameButton onExit={() => {}} />);
    fireEvent.click(screen.getByLabelText("Exit game"));
    const dialog = screen.getByRole("dialog");
    expect(container.contains(dialog)).toBe(false);
    expect(dialog.parentElement).toBe(document.body);
  });

  it("Stay closes the prompt without exiting", () => {
    const onExit = vi.fn();
    render(<ExitGameButton onExit={onExit} />);
    fireEvent.click(screen.getByLabelText("Exit game"));
    fireEvent.click(screen.getByText("Stay"));
    expect(onExit).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
