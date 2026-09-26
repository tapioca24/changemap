import { expect, test } from "vitest";
import { editorCommand, parseEditorCommand } from "../src/server/editor.js";

test("editor commands keep quoted executable paths and arguments without invoking a shell", () => {
  expect(parseEditorCommand('"/some editor/bin" --reuse-window')).toEqual([
    "/some editor/bin",
    "--reuse-window",
  ]);
  expect(parseEditorCommand("vim -u 'config with spaces'")).toEqual([
    "vim",
    "-u",
    "config with spaces",
  ]);
  expect(() => parseEditorCommand("'unclosed")).toThrow("unclosed quote");
});

test("editor selection uses explicit command, then VISUAL, then EDITOR", () => {
  const env = { VISUAL: "code --reuse-window", EDITOR: "vim" };
  expect(editorCommand("nvim", env)).toEqual(["nvim"]);
  expect(editorCommand(undefined, env)).toEqual(["code", "--reuse-window"]);
  expect(editorCommand(undefined, { EDITOR: "vim" })).toEqual(["vim"]);
  expect(() => editorCommand(undefined, {})).toThrow("No editor configured");
});
