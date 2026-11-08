// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { InputActionProvider, useInputActions, type InputAction } from "@hubbub/sdk/input";
import { EndActions } from "./end-actions";

afterEach(cleanup);

function Probe({ onActions }: { onActions: (a: InputAction[]) => void }) {
  onActions(useInputActions());
  return null;
}

describe("EndActions", () => {
  it("registers rematch and back, and runs the handlers it was given", () => {
    const onRematch = vi.fn();
    const onBack = vi.fn();
    let seen: InputAction[] = [];
    render(
      <InputActionProvider>
        <EndActions onRematch={onRematch} onBack={onBack} />
        <Probe onActions={(a) => (seen = a)} />
      </InputActionProvider>,
    );
    expect(seen.map((a) => a.id)).toEqual(["rematch", "back"]);
    seen.find((a) => a.id === "rematch")!.run();
    seen.find((a) => a.id === "back")!.run();
    expect(onRematch).toHaveBeenCalledOnce();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("drops both actions when it unmounts", () => {
    let seen: InputAction[] = [];
    const tree = (mounted: boolean) => (
      <InputActionProvider>
        {mounted && <EndActions onRematch={() => {}} onBack={() => {}} />}
        <Probe onActions={(a) => (seen = a)} />
      </InputActionProvider>
    );
    const { rerender } = render(tree(true));
    expect(seen).toHaveLength(2);
    rerender(tree(false));
    expect(seen).toHaveLength(0);
  });
});
