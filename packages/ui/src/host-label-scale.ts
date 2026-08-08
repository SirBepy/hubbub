// "LOCALHOST:5175" (14 chars) is the baseline local host and must render unshrunk.
const FIT_CHARS = 14;

/** Font-size multiplier so a long host shrinks to fit its chit instead of ellipsing. */
export function hostLabelFontScale(hostLabel: string): number {
  return Math.min(1, FIT_CHARS / hostLabel.length);
}
