import { useEffect, useState } from "react";
import type { MergedFileNode } from "../graph/model.js";
import type { CapturedFile, ReviewSummary } from "../shared/review.js";
import { request } from "./api.js";
import { codeLanguage } from "./code-language.js";
import { diffLines, sourceLines, type DiffLine } from "./code-lines.js";
import { references, statusLabels } from "./graph.js";
import { highlightFile } from "./highlight-client.js";
import type { CodeToken, TokenLines } from "./highlight-engine.js";

type Side = "before" | "after";

function useCodeSide(snapshotId: string, path: string | null, side: Side, load: boolean) {
  const key = JSON.stringify([snapshotId, path, side]);
  const language = codeLanguage(path);
  const [captured, setCaptured] = useState<{
    key: string;
    file?: CapturedFile;
    error?: string;
  } | null>(null);
  const current = captured?.key === key ? captured : null;
  useEffect(() => {
    if (!load || !path || current) return;
    let disposed = false;
    request<CapturedFile>(`/api/file?${new URLSearchParams({ snapshot: snapshotId, path, side })}`)
      .then((file) => {
        if (!disposed) setCaptured({ key, file });
      })
      .catch((error: Error) => {
        if (!disposed) setCaptured({ key, error: error.message });
      });
    return () => {
      disposed = true;
    };
  }, [key, load, path, side, snapshotId, current]);

  const [highlight, setHighlight] = useState<{
    key: string;
    tokens?: TokenLines;
    error?: string;
  } | null>(null);
  const tokens = highlight?.key === key ? highlight : null;
  useEffect(() => {
    if (!language || current?.file?.encoding !== "utf8" || tokens) return;
    let disposed = false;
    highlightFile(current.file.content, language)
      .then((value) => {
        if (!disposed) setHighlight({ key, tokens: value });
      })
      .catch((error: Error) => {
        if (!disposed) setHighlight({ key, error: error.message });
      });
    return () => {
      disposed = true;
    };
  }, [key, language, current, tokens]);
  return { current, tokens };
}

function codeTokens(text: string, tokens: CodeToken[] | undefined) {
  if (!tokens || tokens.map((token) => token.content).join("") !== text) return text;
  return tokens.map((token, index) => (
    <span
      key={index}
      style={{
        color: token.color,
        fontStyle: token.fontStyle && token.fontStyle & 1 ? "italic" : undefined,
        fontWeight: token.fontStyle && token.fontStyle & 2 ? "bold" : undefined,
        textDecoration: token.fontStyle && token.fontStyle & 4 ? "underline" : undefined,
      }}
    >
      {token.content}
    </span>
  ));
}

function diffTokens(line: DiffLine, before?: TokenLines, after?: TokenLines) {
  if (line.kind === "add") return codeTokens(line.text, after?.[(line.afterLine ?? 0) - 1]);
  if (line.kind === "delete") return codeTokens(line.text, before?.[(line.beforeLine ?? 0) - 1]);
  if (line.kind === "context")
    return codeTokens(
      line.text,
      after?.[(line.afterLine ?? 0) - 1] ?? before?.[(line.beforeLine ?? 0) - 1],
    );
  return line.text;
}

export function CodePane({ snapshot, node }: { snapshot: ReviewSummary; node: MergedFileNode }) {
  const [mode, setMode] = useState<"diff" | "before" | "after">(
    node.status === "deleted" ? "before" : node.status === "unchanged" ? "after" : "diff",
  );
  const before = useCodeSide(
    snapshot.id,
    node.oldPath,
    "before",
    mode === "before" || (mode === "diff" && !!node.change?.patch && !!codeLanguage(node.oldPath)),
  );
  const after = useCodeSide(
    snapshot.id,
    node.newPath,
    "after",
    mode === "after" || (mode === "diff" && !!node.change?.patch && !!codeLanguage(node.newPath)),
  );
  const selected = mode === "before" ? before : after;
  const current = selected.current;
  const binary = mode === "diff" ? node.change?.binary : current?.file?.encoding === "base64";
  const text = mode === "diff" ? node.change?.patch : current?.file?.content;
  const lines = mode === "diff" ? diffLines(text ?? "") : sourceLines(text ?? "");
  const highlightWarning =
    mode === "diff"
      ? (before.tokens?.error ??
        before.current?.error ??
        after.tokens?.error ??
        after.current?.error)
      : selected.tokens?.error;
  const refs = references(snapshot.graph, node);
  return (
    <aside className="code-pane" aria-label="Code pane">
      <div className="pane-title">
        <span className={`status ${node.status}`}>{statusLabels[node.status]}</span>
        <h2>{node.newPath ?? node.oldPath}</h2>
        {node.status === "renamed" && (
          <p>
            Renamed from <code>{node.oldPath}</code>
          </p>
        )}
      </div>
      <div className="code-tabs" role="group" aria-label="Content view">
        {node.change && (
          <button aria-pressed={mode === "diff"} onClick={() => setMode("diff")}>
            Diff
          </button>
        )}
        {node.oldPath && (
          <button aria-pressed={mode === "before"} onClick={() => setMode("before")}>
            Before · full file
          </button>
        )}
        {node.newPath && (
          <button aria-pressed={mode === "after"} onClick={() => setMode("after")}>
            After · full file
          </button>
        )}
      </div>
      {!node.analyzed.before && !node.analyzed.after && (
        <p className="pane-note">Dependency analysis not available for this file.</p>
      )}
      {refs.length > 0 && (
        <details
          className="reference-details"
          open={refs.some((ref) => ref.outcome === "unresolved")}
        >
          <summary>
            Module references · {refs.filter((ref) => ref.outcome === "unresolved").length}{" "}
            unresolved · {refs.filter((ref) => ref.outcome === "excluded").length} intentionally
            excluded
          </summary>
          <ul>
            {refs.map((ref, i) => (
              <li key={i}>
                <strong>
                  {ref.side} {ref.line}:{ref.column} · {ref.outcome}
                </strong>
                <code>{ref.expression}</code>
                <span>{ref.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {binary ? (
        <p className="pane-note">
          Text diff unavailable for this binary file. No binary preview is provided.
        </p>
      ) : current?.error && mode !== "diff" ? (
        <p role="alert" className="pane-note">
          {current.error}
        </p>
      ) : mode !== "diff" && !current ? (
        <p role="status" className="pane-note">
          Loading captured contents…
        </p>
      ) : text ? (
        <>
          {highlightWarning && (
            <p className="pane-note" role="status">
              Syntax highlighting unavailable: {highlightWarning}
            </p>
          )}
          <pre
            className={mode === "diff" ? "code code-diff" : "code"}
            aria-label={mode === "diff" ? "File diff" : "Full file"}
            tabIndex={0}
          >
            {lines.map((line, i) => (
              <span
                className={
                  mode === "diff" ? `code-line line-${(line as DiffLine).kind}` : "code-line"
                }
                key={i}
              >
                <span className="line-number" aria-hidden="true">
                  {mode === "diff" ? "" : i + 1}
                </span>
                {mode === "diff" &&
                  ((line as DiffLine).kind === "add" || (line as DiffLine).kind === "delete") && (
                    <span className="sr-only">
                      {(line as DiffLine).kind === "add" ? "Added line: " : "Deleted line: "}
                    </span>
                  )}
                {mode === "diff"
                  ? diffTokens(line as DiffLine, before.tokens?.tokens, after.tokens?.tokens)
                  : codeTokens(line as string, selected.tokens?.tokens?.[i])}
                {"\n"}
              </span>
            ))}
          </pre>
        </>
      ) : (
        <p className="pane-note">{mode === "diff" ? "No text changes." : "Empty file."}</p>
      )}
    </aside>
  );
}
