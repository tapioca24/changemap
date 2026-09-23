import { mkdtemp, readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { SettingsStore, configPath } from "../src/config/settings.js";
import { defaults } from "../src/shared/settings.js";
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
  expect(await store.save({ theme: "latte", orientation: "BT" })).toEqual({
    settings: { theme: "latte", orientation: "BT" },
    warning: null,
  });
  expect((await SettingsStore.load(path)).state.settings).toEqual({
    theme: "latte",
    orientation: "BT",
  });
  expect(await readdir(root)).toEqual(["config.toml"]);
});
test.each(["theme = [", 'theme = "unknown"'])(
  "malformed settings are preserved: %s",
  async (text) => {
    const { path } = await fixture();
    await writeFile(path, text);
    const store = await SettingsStore.load(path);
    expect(store.state.warning).toContain("could not be loaded");
    expect(store.state.settings).toEqual(defaults);
    expect((await store.save({ theme: "frappe", orientation: "RL" })).settings.theme).toBe(
      "frappe",
    );
    expect(await readFile(path, "utf8")).toBe(text);
  },
);
test("failed save preserves the old file and applies session settings", async () => {
  const { path } = await fixture();
  await writeFile(path, 'theme = "mocha"\n');
  const store = await SettingsStore.load(path);
  // Rename over a nonempty directory must fail even when tests run as root.
  await rm(path);
  await mkdir(path);
  await writeFile(join(path, "original"), "preserve");
  expect((await store.save({ theme: "latte", orientation: "TB" })).warning).toContain(
    "could not be saved",
  );
  expect(store.state.settings.theme).toBe("latte");
  expect(await readFile(join(path, "original"), "utf8")).toBe("preserve");
});
test("corruption after startup is preserved and queued saves finish in order", async () => {
  const { path } = await fixture();
  const store = await SettingsStore.load(path);
  await Promise.all([
    store.save({ theme: "latte", orientation: "TB" }),
    store.save({ theme: "macchiato", orientation: "RL" }),
  ]);
  expect((await SettingsStore.load(path)).state.settings).toEqual({
    theme: "macchiato",
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
