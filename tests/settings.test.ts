import { mkdtemp, readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { SettingsStore, configPath } from "../src/config/settings.js";
import { defaults, themes } from "../src/shared/settings.js";
const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "changemap-settings-"));
  roots.push(root);
  return { root, path: join(root, "config.toml") };
}
test("XDG accepts absolute paths and ignores relative or empty values", () => {
  const home = join(tmpdir(), "home");
  expect(configPath({ XDG_CONFIG_HOME: "relative" }, home)).toBe(
    join(home, ".config/changemap/config.toml"),
  );
  expect(configPath({ XDG_CONFIG_HOME: tmpdir() }, home)).toBe(
    join(tmpdir(), "changemap/config.toml"),
  );
  expect(configPath({}, home)).toBe(join(home, ".config/changemap/config.toml"));
});
test("startup creates nothing; first change saves and restart restores settings", async () => {
  const { root, path } = await fixture();
  const store = await SettingsStore.load(path);
  expect(store.state.settings).toEqual(defaults);
  expect(await readdir(root)).toEqual([]);
  expect(await store.save({ theme: "everforest-light-medium", orientation: "BT" })).toEqual({
    settings: { theme: "everforest-light-medium", orientation: "BT" },
    warning: null,
  });
  expect((await SettingsStore.load(path)).state.settings).toEqual({
    theme: "everforest-light-medium",
    orientation: "BT",
  });
  expect(await readdir(root)).toEqual(["config.toml"]);
});
test.each(themes)("theme %s survives a settings store restart", async (theme) => {
  const { path } = await fixture();
  await (await SettingsStore.load(path)).save({ theme, orientation: "LR" });
  expect((await SettingsStore.load(path)).state.settings.theme).toBe(theme);
});
test.each(["theme = [", 'theme = "unknown"', 'theme = "mocha"'])(
  "malformed settings are preserved: %s",
  async (text) => {
    const { path } = await fixture();
    await writeFile(path, text);
    const store = await SettingsStore.load(path);
    expect(store.state.warning).toContain("could not be loaded");
    expect(store.state.settings).toEqual(defaults);
    expect(
      (await store.save({ theme: "catppuccin-frappe", orientation: "RL" })).settings.theme,
    ).toBe("catppuccin-frappe");
    expect(await readFile(path, "utf8")).toBe(text);
  },
);
test("failed save preserves the old file and applies session settings", async () => {
  const { path } = await fixture();
  await writeFile(path, 'theme = "catppuccin-mocha"\n');
  const store = await SettingsStore.load(path);
  // Rename over a nonempty directory must fail even when tests run as root.
  await rm(path);
  await mkdir(path);
  await writeFile(join(path, "original"), "preserve");
  expect((await store.save({ theme: "catppuccin-latte", orientation: "TB" })).warning).toContain(
    "could not be saved",
  );
  expect(store.state.settings.theme).toBe("catppuccin-latte");
  expect(await readFile(join(path, "original"), "utf8")).toBe("preserve");
});
test("corruption after startup is preserved and queued saves finish in order", async () => {
  const { path } = await fixture();
  const store = await SettingsStore.load(path);
  await Promise.all([
    store.save({ theme: "catppuccin-latte", orientation: "TB" }),
    store.save({ theme: "catppuccin-macchiato", orientation: "RL" }),
  ]);
  expect((await SettingsStore.load(path)).state.settings).toEqual({
    theme: "catppuccin-macchiato",
    orientation: "RL",
  });
  await writeFile(path, "broken = [");
  expect((await store.save(defaults)).warning).toBeTruthy();
  expect(await readFile(path, "utf8")).toBe("broken = [");
});
test("unknown TOML settings survive a successful save", async () => {
  const { path } = await fixture();
  await writeFile(path, 'future = "keep"\n');
  await (await SettingsStore.load(path)).save(defaults);
  expect(await readFile(path, "utf8")).toContain('future = "keep"');
});
