import { createHash } from "node:crypto";
import { lstat, readFile, readlink } from "node:fs/promises";
import { isUtf8 } from "node:buffer";
import { join } from "node:path";
import type { CapturedFile, CapturedState } from "../shared/review.js";
import { git, gitText, nulRecords } from "./command.js";

interface Entry {
  path: string;
  mode: string;
  oid: string;
}

export function capturedFile(mode: string, bytes: Buffer): CapturedFile {
  const binary = bytes.subarray(0, 8000).includes(0) || !isUtf8(bytes);
  return Object.freeze({
    mode,
    encoding: binary ? "base64" : "utf8",
    content: bytes.toString(binary ? "base64" : "utf8"),
  });
}

export function fileBytes(file: CapturedFile): Buffer {
  return Buffer.from(file.content, file.encoding);
}

function parseEntries(data: Buffer, index: boolean): Entry[] {
  return nulRecords(data).map((record) => {
    const tab = record.indexOf("\t");
    const [mode, second, third] = record.slice(0, tab).split(" ");
    if (index && third !== "0")
      throw new Error(
        "The index has unresolved conflicts. Resolve them before capturing a review.",
      );
    return { path: record.slice(tab + 1), mode, oid: index ? second : third };
  });
}

async function readObjects(
  repository: string,
  entries: Entry[],
): Promise<Record<string, CapturedFile>> {
  const files: Record<string, CapturedFile> = Object.create(null);
  const ids = [
    ...new Set(entries.filter((entry) => entry.mode !== "160000").map((entry) => entry.oid)),
  ];
  const objects = new Map<string, Buffer>();
  if (ids.length) {
    const data = await git(repository, ["cat-file", "--batch"], `${ids.join("\n")}\n`);
    let offset = 0;
    for (const id of ids) {
      const newline = data.indexOf(10, offset);
      const [oid, kind, sizeText] = data.subarray(offset, newline).toString().split(" ");
      const size = Number(sizeText);
      if (
        oid !== id ||
        kind !== "blob" ||
        !Number.isSafeInteger(size) ||
        size < 0 ||
        newline + size + 1 >= data.length
      ) {
        throw new Error(`Cannot capture Git blob ${id}.`);
      }
      offset = newline + 1;
      objects.set(id, data.subarray(offset, offset + size));
      offset += size + 1;
    }
  }
  for (const entry of entries) {
    files[entry.path] = capturedFile(
      entry.mode,
      entry.mode === "160000" ? Buffer.from(entry.oid) : objects.get(entry.oid)!,
    );
  }
  return files;
}

export function emptyState(): CapturedState {
  return Object.freeze({
    kind: "empty",
    label: "Empty state",
    files: Object.freeze(Object.create(null)),
  });
}

export async function commitState(
  repository: string,
  commit: string,
  label: string,
): Promise<CapturedState> {
  const entries = parseEntries(await git(repository, ["ls-tree", "-r", "-z", commit]), false);
  const files = await readObjects(repository, entries);
  return Object.freeze({ kind: "commit", label, commit, files: Object.freeze(files) });
}

export async function indexEntries(repository: string): Promise<Entry[]> {
  return parseEntries(await git(repository, ["ls-files", "--stage", "-z"]), true);
}

export async function indexState(repository: string): Promise<CapturedState> {
  // An empty-tree comparison gives the logical index and excludes intent-to-add
  // placeholders without parsing Git's undocumented binary index/debug format.
  const emptyTree = (await git(repository, ["hash-object", "-t", "tree", "--stdin"], ""))
    .toString()
    .trim();
  const records = nulRecords(
    await git(repository, [
      "diff",
      "--cached",
      "--raw",
      "--no-abbrev",
      "-z",
      "--no-renames",
      "--no-ext-diff",
      "--no-textconv",
      "--ita-invisible-in-index",
      emptyTree,
      "--",
    ]),
  );
  const entries: Entry[] = [];
  for (let i = 0; i < records.length; i += 2) {
    const [, mode, , oid, status] = records[i].slice(1).split(" ");
    if (status !== "A")
      throw new Error(
        "The index has unresolved conflicts. Resolve them before capturing a review.",
      );
    entries.push({ path: records[i + 1], mode, oid });
  }
  return Object.freeze({
    kind: "index",
    label: "Index",
    files: Object.freeze(await readObjects(repository, entries)),
  });
}

// Never follow a symlink in an ancestor, including one swapped for a tracked directory.
async function safeStat(repository: string, path: string) {
  const parts = path.split("/");
  if (
    parts.some((part) => !part || part === ".." || part === ".") ||
    (process.platform === "win32" && /[\\:]/.test(path))
  ) {
    throw new Error(`Unsupported repository path: ${JSON.stringify(path)}`);
  }
  for (let i = 1; i < parts.length; i++) {
    const parent = await lstat(join(repository, ...parts.slice(0, i)));
    if (!parent.isDirectory() || parent.isSymbolicLink()) return null;
  }
  return lstat(join(repository, path));
}

export async function worktreeState(repository: string, entries: Entry[]): Promise<CapturedState> {
  if (
    (await gitText(repository, ["config", "--bool", "--get", "core.sparseCheckout"]).catch(
      () => "false",
    )) === "true"
  ) {
    throw new Error(
      "Worktree reviews of sparse checkouts are not supported yet. Use a commit or staged comparison.",
    );
  }
  const tracked = new Map(entries.map((entry) => [entry.path, entry]));
  const untracked = nulRecords(
    await git(repository, ["ls-files", "--others", "--exclude-standard", "-z"]),
  );
  const paths = [...new Set([...tracked.keys(), ...untracked])].sort();
  const files: Record<string, CapturedFile> = Object.create(null);
  const filemode = await gitText(repository, ["config", "--bool", "--get", "core.filemode"]).catch(
    () => "false",
  );
  const symlinks = await gitText(repository, ["config", "--bool", "--get", "core.symlinks"]).catch(
    () => "true",
  );
  for (const path of paths) {
    const entry = tracked.get(path);
    try {
      const stat = await safeStat(repository, path);
      if (!stat) continue;
      if (entry?.mode === "160000" && stat.isDirectory()) {
        const initialized = await lstat(join(repository, path, ".git")).then(
          () => true,
          (error: NodeJS.ErrnoException) => {
            if (error.code === "ENOENT") return false;
            throw error;
          },
        );
        // An uninitialized submodule must not resolve HEAD from its parent repository.
        const oid = initialized
          ? await gitText(join(repository, path), ["rev-parse", "--verify", "HEAD"])
          : entry.oid;
        if (
          initialized &&
          (await gitText(join(repository, path), [
            "status",
            "--porcelain=v1",
            "--untracked-files=normal",
          ]))
        ) {
          throw new Error(
            `Cannot capture uncommitted contents inside submodule ${JSON.stringify(path)}. Commit or stash them inside the submodule first.`,
          );
        }
        files[path] = capturedFile("160000", Buffer.from(oid));
      } else if (stat.isSymbolicLink()) {
        files[path] = capturedFile(
          "120000",
          await readlink(join(repository, path), { encoding: "buffer" }),
        );
      } else if (stat.isFile()) {
        const mode =
          entry?.mode === "120000" && symlinks === "false"
            ? "120000"
            : filemode === "true"
              ? stat.mode & 0o111
                ? "100755"
                : "100644"
              : entry?.mode === "100755"
                ? "100755"
                : "100644";
        files[path] = capturedFile(mode, await readFile(join(repository, path)));
      } else if (!stat.isDirectory()) {
        throw new Error(`Cannot capture special file ${JSON.stringify(path)}.`);
      }
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code === "ENOENT" ||
        (error as NodeJS.ErrnoException).code === "ENOTDIR"
      )
        continue;
      throw error;
    }
  }
  return Object.freeze({ kind: "worktree", label: "Working tree", files: Object.freeze(files) });
}

export function stateFingerprint(state: CapturedState): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify([state.kind, state.commit]));
  for (const path of Object.keys(state.files).sort()) {
    const file = state.files[path];
    hash.update(JSON.stringify([path, file.mode, file.encoding, file.content]));
  }
  return hash.digest("hex");
}
