import { parseInput, type ReviewInput } from "../git/input.js";
import type { GoOptions } from "../analysis/go.js";

export type CliOptions =
  | { command: "help" }
  | { command: "version" }
  | {
      command: "review";
      input: ReviewInput;
      port: number;
      open: boolean;
      editor?: string;
      go: GoOptions;
    };

export function parseOptions(args: readonly string[]): CliOptions {
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) return { command: "help" };
  if (args.length === 1 && ["--version", "-v"].includes(args[0])) return { command: "version" };
  const positional: string[] = [];
  let open = true;
  let port = 0;
  let editor: string | undefined;
  const go: { os?: string; arch?: string; tags?: string[] } = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--no-open") open = false;
    else if (arg === "--editor" || arg.startsWith("--editor=")) {
      const value = arg === "--editor" ? args[++i] : arg.slice(9);
      if (!value || value.startsWith("-")) throw new Error("--editor requires a command.");
      editor = value;
    } else if (arg === "--port" || arg.startsWith("--port=")) {
      const value = arg === "--port" ? args[++i] : arg.slice(7);
      if (!value || !/^\d+$/.test(value) || Number(value) > 65535)
        throw new Error("--port requires an integer from 0 to 65535 (0 selects a free port).");
      port = Number(value);
    } else if (/^--go-(os|arch|tags)(=|$)/.test(arg)) {
      const [flag, inline] = arg.split(/=(.*)/s);
      const value = inline ?? args[++i];
      if (!value || value.startsWith("-")) throw new Error(`${flag} requires a value.`);
      if (flag === "--go-tags") {
        const tags = value.split(",");
        if (tags.some((tag) => !/^[\p{L}\p{N}_.]+$/u.test(tag)))
          throw new Error("--go-tags requires comma-separated build tags.");
        go.tags = [...new Set(tags)].sort();
      } else {
        if (!/^[a-z0-9]+$/.test(value)) throw new Error(`${flag} requires a Go platform name.`);
        go[flag === "--go-os" ? "os" : "arch"] = value;
      }
    } else if (arg.startsWith("-"))
      throw new Error(`Unknown or misplaced option: ${arg}. Use --help.`);
    else positional.push(arg);
  }
  return { command: "review", input: parseInput(positional), open, port, editor, go };
}
