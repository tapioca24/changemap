import { spawn } from "node:child_process";
import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import type { ReviewSnapshot } from "../git/snapshot.js";
import { fileBytes } from "../git/state.js";

export interface EditorFile {
  available: boolean;
  path: string;
  differs: boolean;
  reason?: string;
}

export async function inspectEditorFile(
  snapshot: ReviewSnapshot,
  nodeId: string,
): Promise<EditorFile & { absolutePath?: string }> {
  const node = snapshot.summary.graph.merged.nodes.find((candidate) => candidate.id === nodeId);
  if (!node)
    return { available: false, path: "", differs: false, reason: "File is not in this review." };
  const path = node.newPath ?? node.oldPath;
  if (!path) return { available: false, path: "", differs: false, reason: "File has no path." };
  const parts = path.split("/");
  if (
    parts.some((part) => !part || part === "." || part === "..") ||
    (process.platform === "win32" && /[\\:]/.test(path))
  ) {
    return { available: false, path, differs: false, reason: "Unsupported repository path." };
  }
  const root = await realpath(snapshot.summary.repository);
  const candidate = join(root, ...parts);
  let absolutePath: string;
  try {
    absolutePath = await realpath(candidate);
    const inside = relative(root, absolutePath);
    if (!inside || inside === ".." || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
      return {
        available: false,
        path,
        differs: false,
        reason: "File resolves outside the repository.",
      };
    }
    const actual = await stat(absolutePath);
    if (!actual.isFile()) {
      return { available: false, path, differs: false, reason: "Path is not a regular file." };
    }
    const captured = snapshot.after.files[path] ?? snapshot.before.files[path];
    if (!captured) return { available: true, path, absolutePath, differs: true };
    const bytes = fileBytes(captured);
    const differs = actual.size !== bytes.length || !(await readFile(absolutePath)).equals(bytes);
    return { available: true, path, absolutePath, differs };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        available: false,
        path,
        differs: false,
        reason: "File is absent from the working tree.",
      };
    }
    throw error;
  }
}

export function parseEditorCommand(command: string): string[] {
  const words: string[] = [];
  let word = "";
  let quote: "'" | '"' | null = null;
  let started = false;
  for (let i = 0; i < command.length; i++) {
    const character = command[i];
    if (character === quote) {
      quote = null;
    } else if (quote === null && (character === "'" || character === '"')) {
      quote = character;
      started = true;
    } else if (character === "\\" && command[i + 1] && /[\s"'\\]/.test(command[i + 1])) {
      word += command[++i];
      started = true;
    } else if (quote === null && /\s/.test(character)) {
      if (started) words.push(word);
      word = "";
      started = false;
    } else {
      word += character;
      started = true;
    }
  }
  if (quote !== null) throw new Error("Editor command has an unclosed quote.");
  if (started) words.push(word);
  if (!words[0]) throw new Error("Editor command is empty.");
  return words;
}

export function editorCommand(override?: string, env: NodeJS.ProcessEnv = process.env): string[] {
  const command = override ?? (env.VISUAL?.trim() || env.EDITOR?.trim());
  if (!command) {
    throw new Error("No editor configured. Pass --editor or set VISUAL or EDITOR.");
  }
  return parseEditorCommand(command);
}

export async function launchEditor(path: string, command: readonly string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command[0], [...command.slice(1), path], {
      stdio: "inherit",
      windowsHide: false,
    });
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };
    child.once("error", (error) => finish(error));
    child.once("exit", (code, signal) => {
      if (code === 0) finish();
      else
        finish(
          new Error(
            `${command[0]} exited with ${signal ?? code}. Check the terminal running changemap for details.${process.stdin.isTTY ? "" : " No terminal is attached; terminal editors need one."}`,
          ),
        );
    });
    const timer = setTimeout(() => {
      child.unref();
      finish();
    }, 350);
  });
}
