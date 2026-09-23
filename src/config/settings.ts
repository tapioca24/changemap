import { mkdir, readFile, rename, writeFile, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { randomUUID } from "node:crypto";
import { parse, stringify } from "smol-toml";
import { defaults, validSettings, type Settings, type SettingsState } from "../shared/settings.js";

export function configPath(env: NodeJS.ProcessEnv = process.env, home = homedir()) {
  const base = env.XDG_CONFIG_HOME;
  return join(base && isAbsolute(base) ? base : join(home, ".config"), "changemap", "config.toml");
}
export class SettingsStore {
  state: SettingsState = { settings: { ...defaults }, warning: null };
  private blocked = false;
  private queue: Promise<unknown> = Promise.resolve();
  private constructor(readonly path: string) {}
  static async load(path = configPath()) {
    const store = new SettingsStore(path);
    try {
      const value = { ...defaults, ...parse(await readFile(path, "utf8")) };
      if (!validSettings(value)) throw new Error("Invalid theme or orientation.");
      store.state.settings = { theme: value.theme, orientation: value.orientation };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        store.blocked = true;
        store.state.warning =
          "Configuration could not be loaded; started with defaults. Changes apply only to this session. The original file is preserved.";
      }
    }
    return store;
  }
  save(settings: Settings): Promise<SettingsState> {
    if (!validSettings(settings)) return Promise.reject(new Error("Invalid settings."));
    const operation = this.queue.then(async () => {
      this.state.settings = { ...settings };
      if (this.blocked) return this.state;
      const temporary = `${this.path}.${randomUUID()}.tmp`;
      try {
        await mkdir(dirname(this.path), { recursive: true });
        // Preserve unknown TOML keys and refuse to overwrite a file corrupted since startup.
        let existing = {};
        try {
          existing = parse(await readFile(this.path, "utf8"));
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        await writeFile(temporary, stringify({ ...existing, ...settings }), {
          flag: "wx",
          mode: 0o600,
        });
        await rename(temporary, this.path);
        this.state.warning = null;
      } catch {
        this.state.warning =
          "Settings could not be saved. Changes apply to this session but will not persist across restarts. The existing file is preserved.";
      } finally {
        await unlink(temporary).catch(() => {});
      }
      return { settings: { ...this.state.settings }, warning: this.state.warning };
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
