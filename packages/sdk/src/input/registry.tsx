import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

/** A logical action a physical device can be bound to - never a key or button code, per
 * CLAUDE.md's input contract. `run` is what the framework (or a game) does when it fires. */
export type InputAction = {
  id: string;
  label: string;
  run: () => void;
};

type Group = { key: string; actions: InputAction[] };
type Registry = {
  actions: InputAction[];
  register: (key: string, actions: InputAction[]) => void;
  unregister: (key: string) => void;
};

const InputActionContext = createContext<Registry | null>(null);

/** Holds whatever the currently-mounted screens declare. Platform screens register today; a game
 * registers its own in-round actions through the same hook, which is why this is a registry and
 * not a constant per screen. */
export function InputActionProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<Group[]>([]);

  const register = useCallback((key: string, actions: InputAction[]) => {
    setGroups((prev) => [...prev.filter((g) => g.key !== key), { key, actions }]);
  }, []);
  const unregister = useCallback((key: string) => {
    setGroups((prev) => prev.filter((g) => g.key !== key));
  }, []);

  const value = useMemo<Registry>(
    () => ({ actions: groups.flatMap((g) => g.actions), register, unregister }),
    [groups, register, unregister],
  );
  return <InputActionContext.Provider value={value}>{children}</InputActionContext.Provider>;
}

/** Declares the actions live on this screen for as long as it is mounted. */
export function useRegisterInputActions(actions: InputAction[]): void {
  const key = useId();
  const registry = useContext(InputActionContext);
  const register = registry?.register;
  const unregister = registry?.unregister;
  const latest = useRef(actions);
  latest.current = actions;
  // Registering the array as given would freeze this render's `run` closures; the indirection
  // keeps them current, and the signature decides when a re-register is actually needed.
  const signature = actions.map((a) => `${a.id} ${a.label}`).join("");
  useEffect(() => {
    if (!register || !unregister) return;
    const bound = latest.current.map((a, i) => ({ id: a.id, label: a.label, run: () => latest.current[i]?.run() }));
    register(key, bound);
    return () => unregister(key);
  }, [register, unregister, key, signature]);
}

export function useInputActions(): InputAction[] {
  return useContext(InputActionContext)?.actions ?? [];
}
