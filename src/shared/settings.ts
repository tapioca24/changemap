export const themes = [
  "catppuccin-latte",
  "catppuccin-frappe",
  "catppuccin-macchiato",
  "catppuccin-mocha",
  "tokyo-night",
  "tokyo-night-storm",
  "tokyo-night-light",
  "rose-pine",
  "rose-pine-moon",
  "rose-pine-dawn",
  "vitesse-black",
  "vitesse-dark",
  "vitesse-dark-soft",
  "vitesse-light",
  "vitesse-light-soft",
  "kanagawa-wave",
  "kanagawa-dragon",
  "kanagawa-lotus",
  "everforest-dark-hard",
  "everforest-dark-medium",
  "everforest-dark-soft",
  "everforest-light-hard",
  "everforest-light-medium",
  "everforest-light-soft",
] as const;
export const orientations = ["LR", "TB", "RL", "BT"] as const;
export interface Settings {
  theme: (typeof themes)[number];
  orientation: (typeof orientations)[number];
}
export interface SettingsState {
  settings: Settings;
  warning: string | null;
}
export const defaults: Settings = { theme: "catppuccin-mocha", orientation: "LR" };
export function validSettings(value: unknown): value is Settings {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    themes.includes(record.theme as Settings["theme"]) &&
    orientations.includes(record.orientation as Settings["orientation"])
  );
}
