import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CapturedState, ChangeStatus, FileChange } from "../shared/review.js";
import { git, nulRecords } from "./command.js";
import { fileBytes } from "./state.js";

// fast-import accepts C-quoted paths. Octal UTF-8 bytes also cover control characters.
function quotePath(path: string): string {
  return `"${[...Buffer.from(path)].map((byte) => `\\${byte.toString(8).padStart(3, "0")}`).join("")}"`;
}

function importState(ref: string, state: CapturedState): Buffer[] {
  const chunks: Buffer[] = [
    Buffer.from(
      `commit refs/heads/${ref}\ncommitter changemap <local@changemap> 0 +0000\ndata 0\n\ndeleteall\n`,
    ),
  ];
  for (const [path, file] of Object.entries(state.files)) {
    if (file.mode === "160000") {
      chunks.push(Buffer.from(`M 160000 ${file.content} ${quotePath(path)}\n`));
    } else {
      const data = fileBytes(file);
      chunks.push(
        Buffer.from(`M ${file.mode} inline ${quotePath(path)}\ndata ${data.length}\n`),
        data,
        Buffer.from("\n"),
      );
    }
  }
  chunks.push(Buffer.from("\n"));
  return chunks;
}

export async function diffStates(
  before: CapturedState,
  after: CapturedState,
  objectFormat = "sha1",
): Promise<readonly FileChange[]> {
  const directory = await mkdtemp(join(tmpdir(), "changemap-diff-"));
  // Never inherit GIT_DIR, GIT_INDEX_FILE, object stores, config injection, etc.
  const environment: NodeJS.ProcessEnv = Object.fromEntries(
    Object.keys(process.env)
      .filter((key) => key.startsWith("GIT_"))
      .map((key) => [key, undefined]),
  );
  Object.assign(environment, {
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: join(directory, "no-global-config"),
    GIT_ATTR_NOSYSTEM: "1",
  });
  const run = (args: string[], input?: Buffer) => git(directory, args, input, environment);
  try {
    await run(["init", "--bare", "--quiet", "--template=", `--object-format=${objectFormat}`, "."]);
    await run(
      ["fast-import", "--quiet"],
      Buffer.concat([...importState("before", before), ...importState("after", after)]),
    );
    const common = [
      "diff",
      "--no-ext-diff",
      "--no-textconv",
      "--no-color",
      "--find-renames=50%",
      "--no-relative",
      "--src-prefix=a/",
      "--dst-prefix=b/",
    ];
    const records = nulRecords(
      await run([...common, "--raw", "--no-abbrev", "-z", "before", "after", "--"]),
    );
    const changes: FileChange[] = [];
    for (let i = 0; i < records.length;) {
      const [oldMode, newMode, , , code] = records[i++].slice(1).split(" ");
      const first = records[i++];
      const oldPath = code === "A" ? null : first;
      const newPath = code === "D" ? null : code.startsWith("R") ? records[i++] : first;
      const status: ChangeStatus = code.startsWith("R")
        ? "renamed"
        : code === "A"
          ? "added"
          : code === "D"
            ? "deleted"
            : "modified";
      const binary =
        (oldPath !== null && before.files[oldPath]?.encoding === "base64") ||
        (newPath !== null && after.files[newPath]?.encoding === "base64");
      const paths = [
        ...new Set([oldPath, newPath].filter((path): path is string => path !== null)),
      ];
      const patch = binary
        ? null
        : (await run([...common, "--patch", "before", "after", "--", ...paths])).toString("utf8");
      const whitespacePatch = binary
        ? null
        : (await run([...common, "--patch", "-w", "before", "after", "--", ...paths])).toString(
            "utf8",
          );
      changes.push(
        Object.freeze({
          status,
          oldPath,
          newPath,
          oldMode: oldMode === "000000" ? null : oldMode,
          newMode: newMode === "000000" ? null : newMode,
          binary,
          patch,
          whitespacePatch,
        }),
      );
    }
    return Object.freeze(changes);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
