import { flavors } from "@catppuccin/palette";
import { describe, expect, test } from "vitest";
import { themes } from "../src/shared/settings.js";
import { contrast, isLightTheme, themeColors, themeName } from "../src/ui/themes.js";

const additionalThemes = themes.slice(4);

describe("theme registry", () => {
  test("Catppuccin IDs retain their original palette and include the family in labels", () => {
    expect(themes.slice(0, 4).map(themeName)).toEqual([
      "Catppuccin Latte",
      "Catppuccin Frappé",
      "Catppuccin Macchiato",
      "Catppuccin Mocha",
    ]);
    for (const flavor of ["latte", "frappe", "macchiato", "mocha"] as const) {
      const base = flavors[flavor].colorEntries.find(([name]) => name === "base")?.[1].hex;
      expect(themeColors(`catppuccin-${flavor}`).base).toBe(base);
    }
  });

  test("all 20 official variants have names and semantic colors", () => {
    expect(additionalThemes).toHaveLength(20);
    expect(new Set(themes).size).toBe(24);
    for (const theme of additionalThemes) {
      expect(themeName(theme)).toBeTruthy();
      const colors = themeColors(theme);
      for (const role of [
        "base",
        "surface0",
        "surface1",
        "surface2",
        "text",
        "subtext0",
        "red",
        "green",
        "yellow",
        "blue",
        "mauve",
        "lavender",
      ]) {
        expect(colors[role], `${theme}: ${role}`).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  test("text and meaningful accent colors meet AA contrast against main surfaces", () => {
    for (const theme of additionalThemes) {
      const colors = themeColors(theme);
      for (const background of ["base", "mantle", "crust", "surface0", "surface1"]) {
        for (const foreground of [
          "text",
          "subtext0",
          "subtext1",
          "overlay1",
          "overlay2",
          "red",
          "green",
          "yellow",
          "blue",
          "mauve",
          "lavender",
          "sapphire",
          "peach",
          "maroon",
        ]) {
          expect(
            contrast(colors[foreground], colors[background]),
            `${theme}: ${foreground} on ${background}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
      for (const background of ["base", "surface0", "surface1"]) {
        expect(
          contrast(colors.surface2, colors[background]),
          `${theme}: border on ${background}`,
        ).toBeGreaterThanOrEqual(3);
      }
      expect(
        contrast(colors.lavender, colors.crust),
        `${theme}: refresh button`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("light variants are marked for browser controls", () => {
    expect(additionalThemes.filter(isLightTheme)).toEqual([
      "tokyo-night-light",
      "rose-pine-dawn",
      "vitesse-light",
      "vitesse-light-soft",
      "kanagawa-lotus",
      "everforest-light-hard",
      "everforest-light-medium",
      "everforest-light-soft",
    ]);
  });
});
