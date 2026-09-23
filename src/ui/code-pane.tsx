import { useEffect, useState } from "react";
import type { MergedFileNode } from "../graph/model.js";
import type { CapturedFile, ReviewSummary } from "../shared/review.js";
import { request } from "./api.js";
import { references, statusLabels } from "./graph.js";

export function CodePane({ snapshot, node }: { snapshot: ReviewSummary; node: MergedFileNode }) {
  const [mode, setMode] = useState<"diff" | "before" | "after">(
    node.status === "deleted" ? "before" : node.status === "unchanged" ? "after" : "diff",
  );
  const [content, setContent] = useState<{
    key: string;
    file?: CapturedFile;
    error?: string;
  } | null>(null);
  const path = mode === "before" ? node.oldPath : node.newPath;
  const key = `${snapshot.id}:${node.id}:${mode}`;
  useEffect(() => {
    if (mode === "diff" || !path) return;
    let disposed = false;
    request<CapturedFile>(
      `/api/file?${new URLSearchParams({ snapshot: snapshot.id, path, side: mode })}`,
    )
      .then((file) => {
        if (!disposed) setContent({ key, file });
      })
      .catch((error: Error) => {
        if (!disposed) setContent({ key, error: error.message });
      });
    return () => {
      disposed = true;
    };
  }, [snapshot.id, path, mode, key]);
  const current = content?.key === key ? content : null;
  const binary = mode === "diff" ? node.change?.binary : current?.file?.encoding === "base64";
  const text = mode === "diff" ? node.change?.patch : current?.file?.content;
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
        <pre className="code" aria-label={mode === "diff" ? "File diff" : "Full file"} tabIndex={0}>
          {text.split("\n").map((line, i) => (
            <span
              className={
                mode === "diff"
                  ? line.startsWith("+")
                    ? "line-add"
                    : line.startsWith("-")
                      ? "line-delete"
                      : line.startsWith("@@")
                        ? "line-hunk"
                        : ""
                  : ""
              }
              key={i}
            >
              <span className="line-number" aria-hidden="true">
                {mode === "diff" ? "" : i + 1}
              </span>
              {line}
              {"\n"}
            </span>
          ))}
        </pre>
      ) : (
        <p className="pane-note">{mode === "diff" ? "No text changes." : "Empty file."}</p>
      )}
    </aside>
  );
}
