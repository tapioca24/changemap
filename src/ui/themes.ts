import { flavors } from "@catppuccin/palette";
import type { CSSProperties } from "react";
import type { Settings } from "../shared/settings.js";
import palettes from "./theme-palettes.json" with { type: "json" };

type Theme = Settings["theme"];
type ExtraTheme = keyof typeof palettes;
const catppuccinFlavors = {
  "catppuccin-latte": "latte",
  "catppuccin-frappe": "frappe",
  "catppuccin-macchiato": "macchiato",
  "catppuccin-mocha": "mocha",
} as const;

function isExtraTheme(theme: Theme): theme is ExtraTheme {
  return theme in palettes;
}

export function themeName(theme: Theme): string {
  return isExtraTheme(theme)
    ? palettes[theme].name
    : `Catppuccin ${flavors[catppuccinFlavors[theme]].name}`;
}

export function isLightTheme(theme: Theme): boolean {
  return isExtraTheme(theme) ? palettes[theme].light : theme === "catppuccin-latte";
}

function rgb(hex: string): [number, number, number] {
  const value = hex.replace(/^#/, "");
  const expanded = value.length === 3 ? [...value].map((digit) => digit + digit).join("") : value;
  return [0, 2, 4].map((offset) => parseInt(expanded.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function hex([red, green, blue]: number[]): string {
  return `#${[red, green, blue].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

function mix(first: string, second: string, amount: number): string {
  const left = rgb(first);
  const right = rgb(second);
  return hex(left.map((value, index) => value * (1 - amount) + right[index] * amount));
}

function opaque(color: string, background: string): string {
  if (color.length !== 9) return hex(rgb(color));
  return mix(background, color.slice(0, 7), parseInt(color.slice(7), 16) / 255);
}

function luminance(color: string): number {
  const channels = rgb(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrast(first: string, second: string): number {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function readable(color: string, backgrounds: string[], minimum: number, light: boolean): string {
  if (backgrounds.every((background) => contrast(color, background) >= minimum)) return color;
  const target = light ? "#000000" : "#ffffff";
  let low = 0;
  let high = 1;
  for (let attempt = 0; attempt < 16; attempt++) {
    const middle = (low + high) / 2;
    if (
      backgrounds.every((background) => contrast(mix(color, target, middle), background) >= minimum)
    ) {
      high = middle;
    } else {
      low = middle;
    }
  }
  return mix(color, target, high);
}

export function themeColors(theme: Theme): Record<string, string> {
  if (!isExtraTheme(theme)) {
    return Object.fromEntries(
      flavors[catppuccinFlavors[theme]].colorEntries.map(([name, color]) => [name, color.hex]),
    );
  }
  const palette = palettes[theme];
  const base = hex(rgb(palette.base));
  const sourceText = opaque(palette.text, base);
  const surface0 = mix(opaque(palette.surface, base), sourceText, 0.05);
  const surface1 = mix(base, sourceText, 0.18);
  const surface2 = readable(surface1, [base, surface0, surface1], 3, palette.light);
  const backgrounds = [base, surface0, surface1];
  const text = readable(sourceText, backgrounds, 4.5, palette.light);
  const subtext0 = readable(opaque(palette.muted, base), backgrounds, 4.5, palette.light);
  const accent = (color: string) => readable(opaque(color, base), backgrounds, 4.5, palette.light);
  return {
    base,
    mantle: mix(base, palette.light ? text : "#000000", palette.light ? 0.035 : 0.09),
    crust: mix(base, palette.light ? text : "#000000", palette.light ? 0.07 : 0.18),
    surface0,
    surface1,
    surface2,
    overlay1: readable(mix(base, text, 0.5), backgrounds, 4.5, palette.light),
    overlay2: readable(mix(base, text, 0.6), backgrounds, 4.5, palette.light),
    text,
    subtext0,
    subtext1: readable(mix(subtext0, text, 0.5), backgrounds, 4.5, palette.light),
    red: accent(palette.red),
    green: accent(palette.green),
    yellow: accent(palette.yellow),
    blue: accent(palette.blue),
    mauve: accent(palette.magenta),
    lavender: accent(palette.magenta),
    sapphire: accent(palette.cyan),
    peach: accent(palette.orange),
    maroon: accent(palette.red),
  };
}

export function themeStyle(theme: Theme): CSSProperties {
  return Object.fromEntries(
    Object.entries(themeColors(theme)).map(([name, color]) => [`--${name}`, color]),
  ) as CSSProperties;
}
