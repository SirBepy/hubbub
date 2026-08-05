import { useEffect, useRef, useState } from "react";

/** A warm chunk resolves in ~50ms on LAN, and a loader shown that briefly reads as a glitch,
 * so nothing is rendered before this. */
export const LOADER_SHOW_AFTER_MS = 600;
/** Once the loader IS on screen it is committed for this long, so it lands as a beat the room
 * can read rather than a blink. */
export const LOADER_MIN_VISIBLE_MS = 1000;

export type LoadingGate<T> = {
  value: T | null;
  /** True only in the slow tier: the caller should render a loading screen. */
  showLoader: boolean;
};

/**
 * Two-tier gate around an async load, keyed so a new key restarts it.
 * Fast tier: resolves before LOADER_SHOW_AFTER_MS and the value appears with no loader at all.
 * Slow tier: the loader appears and stays for at least LOADER_MIN_VISIBLE_MS after appearing.
 */
export function useLoadingGate<T>(key: string | null, load: (key: string) => Promise<T> | null): LoadingGate<T> {
  const [value, setValue] = useState<T | null>(null);
  const [showLoader, setShowLoader] = useState(false);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    setValue(null);
    setShowLoader(false);
    if (!key) return;

    const pending = loadRef.current(key);
    if (!pending) return;

    let cancelled = false;
    let shownAt = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(
      setTimeout(() => {
        if (cancelled) return;
        shownAt = Date.now();
        setShowLoader(true);
      }, LOADER_SHOW_AFTER_MS),
    );

    pending.then(
      (resolved) => {
        if (cancelled) return;
        const heldFor = shownAt ? Date.now() - shownAt : 0;
        const wait = shownAt ? Math.max(0, LOADER_MIN_VISIBLE_MS - heldFor) : 0;
        timers.push(
          setTimeout(() => {
            if (cancelled) return;
            setValue(resolved);
            setShowLoader(false);
          }, wait),
        );
      },
      (err) => {
        if (!cancelled) console.error(`[hubbub] failed to load game "${key}"`, err);
      },
    );

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [key]);

  return { value, showLoader };
}
