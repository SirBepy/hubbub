import { flushSync } from "react-dom";

/**
 * Runs `update` inside document.startViewTransition when the browser supports it and the user
 * has not asked for reduced motion, else applies it immediately. flushSync forces the DOM
 * mutation to finish synchronously inside the transition callback - without it React's async
 * commit can land after the browser has already snapshotted the "old" frame, and the API
 * captures no visual diff to animate.
 */
export function transitionView(update: () => void): void {
  let ran = false;
  const run = () => {
    if (ran) return;
    ran = true;
    update();
  };
  try {
    const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const supported = typeof document !== "undefined" && typeof document.startViewTransition === "function";
    if (!supported || reduced) {
      run();
      return;
    }
    document.startViewTransition(() => flushSync(run));
  } catch {
    // A page swap must never hang on a transition failure.
    run();
  }
}
