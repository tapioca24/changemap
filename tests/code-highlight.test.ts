import { expect, test } from "vitest";
import { codeLanguage } from "../src/ui/code-language.js";
import { diffLines, sourceLines } from "../src/ui/code-lines.js";
import { highlightSource } from "../src/ui/highlight-engine.js";
import {
  highlightFile,
  MAX_HIGHLIGHT_CHARACTERS,
  MAX_HIGHLIGHT_LINES,
} from "../src/ui/highlight-client.js";

test("common source paths resolve to the expected language and unknown paths remain plain", () => {
  expect(codeLanguage("src/view.tsx")).toBe("tsx");
  expect(codeLanguage("src/view.mts")).toBe("typescript");
  expect(codeLanguage("Dockerfile.dev")).toBe("dockerfile");
  expect(codeLanguage(".github/workflows/ci.yml")).toBe("yaml");
  expect(codeLanguage("src/main.cpp")).toBe("cpp");
  expect(codeLanguage("script.zsh")).toBe("shellscript");
  expect(codeLanguage("images/logo.svg")).toBe("xml");
  expect(codeLanguage("notes.unknown")).toBeNull();
});

test("diff lines map to both captured files without showing change markers as code", () => {
  const patch = [
    "diff --git a/a.ts b/a.ts",
    "--- a/a.ts",
    "+++ b/a.ts",
    "@@ -2,3 +2,4 @@ function f()",
    " unchanged",
    "-old",
    "+new",
    "+more",
    " tail",
    "\\ No newline at end of file",
  ].join("\n");
  expect(diffLines(patch)).toEqual([
    { kind: "hunk", text: "@@ -2,3 +2,4 @@ function f()" },
    { kind: "context", text: "unchanged", beforeLine: 2, afterLine: 2 },
    { kind: "delete", text: "old", beforeLine: 3 },
    { kind: "add", text: "new", afterLine: 3 },
    { kind: "add", text: "more", afterLine: 4 },
    { kind: "context", text: "tail", beforeLine: 4, afterLine: 5 },
    { kind: "meta", text: "\\ No newline at end of file" },
  ]);
  expect(sourceLines("one\n\n")).toEqual(["one", ""]);
  expect(sourceLines("one\r\ntwo\r\n")).toEqual(["one", "two"]);
});

test("Shiki keeps multiline syntax state and emits reconstructable lines", async () => {
  const code = "/* opening\nstill a comment */\nconst value = 1;\n";
  const tokens = await highlightSource(code, "typescript");
  expect(tokens.slice(0, 3).map((line) => line.map((token) => token.content).join(""))).toEqual(
    sourceLines(code),
  );
  expect(tokens[1].some((token) => token.color?.includes("comment"))).toBe(true);
  expect(tokens[2].some((token) => token.color?.includes("keyword"))).toBe(true);
});

test("large files fall back before worker startup", async () => {
  await expect(
    highlightFile("x".repeat(MAX_HIGHLIGHT_CHARACTERS + 1), "typescript"),
  ).rejects.toThrow("too large");
  await expect(highlightFile("x\n".repeat(MAX_HIGHLIGHT_LINES), "typescript")).rejects.toThrow(
    "too many lines",
  );
});
