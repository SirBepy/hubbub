import type { SettingsField } from "./types.js";

/** Fields currently visible given the draft's values (showIf gating). Shared by the server's
 * config-phase message handlers and both clients so cursor indexing always agrees. */
export function visibleSettingsFields(schema: SettingsField[], values: Record<string, string>): SettingsField[] {
  return schema.filter((f) => !f.showIf || values[f.showIf.field] === f.showIf.value);
}
