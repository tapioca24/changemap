export const themes = ["latte", "frappe", "macchiato", "mocha"] as const;
export const orientations = ["LR", "TB", "RL", "BT"] as const;
export interface Settings {
  theme: (typeof themes)[number];
  orientation: (typeof orientations)[number];
}
export interface SettingsState {
  settings: Settings;
  warning: string | null;
}
export const defaults: Settings = { theme: "mocha", orientation: "LR" };
export function validSettings(value: unknown): value is Settings {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    themes.includes(record.theme as Settings["theme"]) &&
    orientations.includes(record.orientation as Settings["orientation"])
  );
}
