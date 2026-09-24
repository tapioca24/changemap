export type DiffLine = {
  kind: "add" | "delete" | "context" | "hunk" | "meta";
  text: string;
  beforeLine?: number;
  afterLine?: number;
};

export type SplitDiffRow =
  | { kind: "pair"; before?: DiffLine; after?: DiffLine }
  | { kind: "separator"; line: DiffLine };

export function splitDiffLines(lines: readonly DiffLine[]): SplitDiffRow[] {
  const rows: SplitDiffRow[] = [];
  let deleted: DiffLine[] = [];
  let added: DiffLine[] = [];
  const flush = () => {
    for (let i = 0; i < Math.max(deleted.length, added.length); i++) {
      rows.push({ kind: "pair", before: deleted[i], after: added[i] });
    }
    deleted = [];
    added = [];
  };
  for (const line of lines) {
    if (line.kind === "delete") deleted.push(line);
    else if (line.kind === "add") added.push(line);
    else {
      flush();
      if (line.kind === "context") rows.push({ kind: "pair", before: line, after: line });
      else rows.push({ kind: "separator", line });
    }
  }
  flush();
  return rows;
}

export function sourceLines(content: string): string[] {
  if (!content) return [];
  const lines = content.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line));
}

export function diffLines(patch: string): DiffLine[] {
  const lines = sourceLines(patch);
  const result: DiffLine[] = [];
  let before = 0;
  let after = 0;
  let inHunk = false;
  for (const line of lines) {
    if (line.startsWith("diff --git ")) inHunk = false;
    if (!inHunk && /^(?:diff --git |index |--- |\+\+\+ )/.test(line)) continue;
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk) {
      before = Number(hunk[1]);
      after = Number(hunk[2]);
      inHunk = true;
      result.push({ kind: "hunk", text: line });
    } else if (inHunk && line.startsWith("+")) {
      result.push({ kind: "add", text: line.slice(1), afterLine: after++ });
    } else if (inHunk && line.startsWith("-")) {
      result.push({ kind: "delete", text: line.slice(1), beforeLine: before++ });
    } else if (inHunk && line.startsWith(" ")) {
      result.push({
        kind: "context",
        text: line.slice(1),
        beforeLine: before++,
        afterLine: after++,
      });
    } else {
      // Git headers and the no-newline marker are metadata, even if they contain +/-.
      result.push({ kind: "meta", text: line });
    }
  }
  return result;
}
