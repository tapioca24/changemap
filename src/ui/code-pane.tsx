import { useEffect, useRef, useState } from "react";
import type { MergedFileNode } from "../graph/model.js";
import type { CapturedFile, ReviewSummary } from "../shared/review.js";
import { request } from "./api.js";
import { codeLanguage } from "./code-language.js";
import { diffLines, sourceLines, splitDiffLines, type DiffLine } from "./code-lines.js";
import { references, statusLabels } from "./graph.js";
import { highlightFile } from "./highlight-client.js";
import type { CodeToken, TokenLines } from "./highlight-engine.js";

type Side = "before" | "after";
type ImageState =
  | { key: string; ok: true; width: number; height: number; url: string }
  | { key: string; ok: false; reason: string };

function useImageSide(snapshotId: string, path: string | null, side: Side) {
  const key = JSON.stringify([snapshotId, path, side]);
  const [state, setState] = useState<ImageState | null>(null);
  const current = state?.key === key ? state : null;
  useEffect(() => {
    if (!path || current) return;
    let disposed = false;
    const url = `/api/image?${new URLSearchParams({ snapshot: snapshotId, path, side })}`;
    fetch(url, { method: "HEAD", headers: { "X-Changemap-Request": "1" } })
      .then((response) => {
        if (disposed) return;
        if (!response.ok) {
          setState({
            key,
            ok: false,
            reason:
              response.headers.get("X-Changemap-Preview-Reason") ??
              `Preview unavailable (${response.status}).`,
          });
          return;
        }
        const mime = response.headers.get("Content-Type");
        const width = Number(response.headers.get("X-Changemap-Image-Width"));
        const height = Number(response.headers.get("X-Changemap-Image-Height"));
        if (
          !mime ||
          !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(mime) ||
          !width ||
          !height
        ) {
          setState({ key, ok: false, reason: "Invalid image preview response." });
          return;
        }
        setState({
          key,
          ok: true,
          width,
          height,
          url,
        });
      })
      .catch((error: Error) => {
        if (!disposed) setState({ key, ok: false, reason: error.message });
      });
    return () => {
      disposed = true;
    };
  }, [key, path, side, snapshotId, current]);
  return current;
}

function ImageCard({ side, state }: { side: Side; state: ImageState | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [enlarged, setEnlarged] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const label = side === "before" ? "Before" : "After";
  useEffect(() => {
    if (enlarged && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [enlarged]);
  function closeEnlarged() {
    dialogRef.current?.close();
  }
  return (
    <section className="image-card" aria-label={`${label} image preview`}>
      <div className="image-card-heading">
        <strong>{label}</strong>
        {state?.ok && (
          <span>
            {state.width.toLocaleString()} × {state.height.toLocaleString()} px
          </span>
        )}
      </div>
      {!state ? (
        <p role="status" className="image-card-note">
          Checking image…
        </p>
      ) : !state.ok ? (
        <p className="image-card-note">{state.reason}</p>
      ) : failedUrl === state.url ? (
        <p className="image-card-note">The browser could not decode this image.</p>
      ) : (
        <>
          <button
            ref={buttonRef}
            type="button"
            className="image-open"
            aria-label={`Enlarge ${label} image`}
            aria-haspopup="dialog"
            onClick={() => setEnlarged(true)}
          >
            <img
              src={state.url}
              alt={`${label} file preview`}
              onError={() => setFailedUrl(state.url)}
            />
          </button>
          {enlarged && (
            <dialog
              ref={dialogRef}
              className="image-lightbox"
              aria-label={`${label} image enlarged`}
              onClick={(event) => {
                if (event.target === event.currentTarget) closeEnlarged();
              }}
              onClose={() => {
                setEnlarged(false);
                buttonRef.current?.focus();
              }}
            >
              <div className="image-lightbox-content">
                <div className="image-lightbox-heading">
                  <strong>{label} image</strong>
                  <span>
                    {state.width.toLocaleString()} × {state.height.toLocaleString()} px
                  </span>
                  <button type="button" autoFocus onClick={closeEnlarged}>
                    Close ×
                  </button>
                </div>
                <img src={state.url} alt={`${label} image enlarged`} />
              </div>
            </dialog>
          )}
        </>
      )}
    </section>
  );
}

export interface DiffDisplaySettings {
  layout: "unified" | "split";
  ignoreWhitespace: boolean;
}

export const defaultDiffDisplay: DiffDisplaySettings = {
  layout: "unified",
  ignoreWhitespace: false,
};

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

export function CodePane({
  snapshot,
  node,
  display = defaultDiffDisplay,
  onDisplayChange,
}: {
  snapshot: ReviewSummary;
  node: MergedFileNode;
  display?: DiffDisplaySettings;
  onDisplayChange?: (next: DiffDisplaySettings) => void;
}) {
  const [mode, setMode] = useState<"diff" | "before" | "after">(
    node.status === "deleted" ? "before" : node.status === "unchanged" ? "after" : "diff",
  );
  const beforeImage = useImageSide(snapshot.id, node.oldPath, "before");
  const afterImage = useImageSide(snapshot.id, node.newPath, "after");
  const before = useCodeSide(
    snapshot.id,
    node.oldPath,
    "before",
    (mode === "before" && !node.change?.binary && !beforeImage?.ok) ||
      (mode === "diff" && !!node.change?.patch && !!codeLanguage(node.oldPath)),
  );
  const after = useCodeSide(
    snapshot.id,
    node.newPath,
    "after",
    (mode === "after" && !node.change?.binary && !afterImage?.ok) ||
      (mode === "diff" && !!node.change?.patch && !!codeLanguage(node.newPath)),
  );
  const selected = mode === "before" ? before : after;
  const current = selected.current;
  const showImage = node.change?.binary || beforeImage?.ok || afterImage?.ok;
  const binary = mode === "diff" ? node.change?.binary : current?.file?.encoding === "base64";
  const text =
    mode === "diff"
      ? display.ignoreWhitespace
        ? (node.change?.whitespacePatch ?? node.change?.patch)
        : node.change?.patch
      : current?.file?.content;
  const lines = mode === "diff" ? diffLines(text ?? "") : sourceLines(text ?? "");
  const noVisibleChanges =
    mode === "diff" &&
    display.ignoreWhitespace &&
    diffLines(node.change?.patch ?? "").some(
      (line) => line.kind === "add" || line.kind === "delete",
    ) &&
    !lines.some(
      (line) => typeof line !== "string" && (line.kind === "add" || line.kind === "delete"),
    );
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
      {!showImage && (
        <div className="display-settings" role="group" aria-label="Display settings">
          <span>DISPLAY</span>
          <button
            type="button"
            aria-label="Split diff"
            aria-pressed={display.layout === "split"}
            onClick={() =>
              onDisplayChange?.({
                ...display,
                layout: display.layout === "split" ? "unified" : "split",
              })
            }
          >
            {display.layout === "split" ? "Split" : "Unified"}
          </button>
          <label>
            <input
              type="checkbox"
              checked={display.ignoreWhitespace}
              onChange={(event) =>
                onDisplayChange?.({ ...display, ignoreWhitespace: event.target.checked })
              }
            />
            Ignore whitespace
          </label>
        </div>
      )}
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
      {showImage ? (
        <div className={`image-previews${mode === "diff" ? " image-previews-diff" : ""}`}>
          {(mode === "diff" || mode === "before") && node.oldPath && (
            <ImageCard side="before" state={beforeImage} />
          )}
          {(mode === "diff" || mode === "after") && node.newPath && (
            <ImageCard side="after" state={afterImage} />
          )}
        </div>
      ) : binary ? (
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
      ) : noVisibleChanges ? (
        <p className="pane-note">No differences after ignoring whitespace.</p>
      ) : text ? (
        <>
          {highlightWarning && (
            <p className="pane-note" role="status">
              Syntax highlighting unavailable: {highlightWarning}
            </p>
          )}
          <pre
            className={`code${mode === "diff" ? " code-diff" : ""}${mode === "diff" && display.layout === "split" ? " code-split" : ""}`}
            aria-label={mode === "diff" ? "File diff" : "Full file"}
            tabIndex={0}
          >
            {mode === "diff" && display.layout === "split" ? (
              <span className="split-grid">
                {splitDiffLines(lines as DiffLine[]).map((row, i) =>
                  row.kind === "separator" ? (
                    <span className={`split-separator line-${row.line.kind}`} key={i}>
                      {row.line.text}
                    </span>
                  ) : (
                    <span className="split-row" key={i}>
                      {([row.before, row.after] as const).map((side, index) => (
                        <span
                          className={`split-cell${side ? ` line-${side.kind}` : " split-empty"}`}
                          key={index}
                        >
                          <span className="line-number" aria-hidden="true">
                            {index === 0 ? side?.beforeLine : side?.afterLine}
                          </span>
                          {side?.kind === "delete" || side?.kind === "add" ? (
                            <span className="sr-only">
                              {side.kind === "add" ? "Added line: " : "Deleted line: "}
                            </span>
                          ) : null}
                          {side
                            ? diffTokens(side, before.tokens?.tokens, after.tokens?.tokens)
                            : null}
                        </span>
                      ))}
                    </span>
                  ),
                )}
              </span>
            ) : (
              lines.map((line, i) => (
                <span
                  className={
                    mode === "diff" ? `code-line line-${(line as DiffLine).kind}` : "code-line"
                  }
                  key={i}
                >
                  <span className="line-number" aria-hidden="true">
                    {mode === "diff" ? (line as DiffLine).beforeLine : i + 1}
                  </span>
                  {mode === "diff" && (
                    <span className="line-number" aria-hidden="true">
                      {(line as DiffLine).afterLine}
                    </span>
                  )}
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
              ))
            )}
          </pre>
        </>
      ) : (
        <p className="pane-note">{mode === "diff" ? "No text changes." : "Empty file."}</p>
      )}
    </aside>
  );
}
