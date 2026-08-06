/** Strips scheme + leading www (keeps a port, LAN addresses need it), uppercases for display. */
export function formatHostLabel(url: string): string {
  const host = url.replace(/^[a-z]+:\/\//i, "").replace(/^www\./i, "");
  return host.toUpperCase();
}
