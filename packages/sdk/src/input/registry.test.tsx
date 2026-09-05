// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { InputActionProvider, useInputActions, useRegisterInputActions, type InputAction } from "./registry.js";

afterEach(cleanup);

function Registrant({ id, label }: { id: string; label: string }) {
  useRegisterInputActions([{ id, label, run: () => {} }]);
  return null;
}

function Probe({ onActions }: { onActions: (actions: InputAction[]) => void }) {
  onActions(useInputActions());
  return null;
}

describe("input action registry", () => {
  it("surfaces a registrant's actions through useInputActions", () => {
    let seen: InputAction[] = [];
    render(
      <InputActionProvider>
        <Registrant id="rematch" label="Rematch" />
        <Probe
          onActions={(a) => {
            seen = a;
          }}
        />
      </InputActionProvider>,
    );
    expect(seen.map((a) => a.id)).toEqual(["rematch"]);
  });

  it("removes a registrant's actions once it unmounts", () => {
    let seen: InputAction[] = [];
    function Screen({ mounted }: { mounted: boolean }) {
      return (
        <InputActionProvider>
          {mounted && <Registrant id="rematch" label="Rematch" />}
          <Probe
            onActions={(a) => {
              seen = a;
            }}
          />
        </InputActionProvider>
      );
    }
    const { rerender } = render(<Screen mounted={true} />);
    expect(seen.map((a) => a.id)).toEqual(["rematch"]);

    act(() => rerender(<Screen mounted={false} />));
    expect(seen).toEqual([]);
  });

  it("keeps registration order stable across renders", () => {
    let seen: InputAction[] = [];
    const tree = (
      <InputActionProvider>
        <Registrant id="a" label="A" />
        <Registrant id="b" label="B" />
        <Probe
          onActions={(a) => {
            seen = a;
          }}
        />
      </InputActionProvider>
    );
    const { rerender } = render(tree);
    expect(seen.map((a) => a.id)).toEqual(["a", "b"]);

    act(() => rerender(tree));
    expect(seen.map((a) => a.id)).toEqual(["a", "b"]);
  });
});
