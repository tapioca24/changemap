import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  FileChange,
  ReviewStatus,
  ReviewSummary,
  StateDescription,
} from "../shared/review.js";
import "./style.css";

async function request<T>(path: string, method = "GET"): Promise<T> {
  const response = await fetch(path, { method, headers: { "X-Changemap-Request": "1" } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status}).`);
  return data as T;
}

function StateLabel({ state }: { state: StateDescription }) {
  return (
    <>
      <strong>{state.label}</strong>
      <code>{state.commit?.slice(0, 8) ?? state.kind}</code>
    </>
  );
}

function ChangedFile({ change }: { change: FileChange }) {
  const path = change.newPath ?? change.oldPath!;
  return (
    <details className="file">
      <summary>
        <span className={`change-status ${change.status}`}>{change.status}</span>
        <span className="file-path">
          {path}
          {change.status === "renamed" && <small>from {change.oldPath}</small>}
        </span>
        <span className="file-kind">{change.binary ? "binary" : "text"}</span>
        <span className="disclosure" aria-hidden="true">
          +
        </span>
      </summary>
      {change.binary ? (
        <div className="file-note">Text diff unavailable for this binary file.</div>
      ) : change.patch ? (
        <pre role="region" aria-label={`Diff for ${path}`} tabIndex={0}>
          {change.patch.split("\n").map((line, i) => (
            <span
              key={i}
              className={
                line.startsWith("+")
                  ? "line-add"
                  : line.startsWith("-")
                    ? "line-delete"
                    : line.startsWith("@@")
                      ? "line-hunk"
                      : undefined
              }
            >
              {line}
              {"\n"}
            </span>
          ))}
        </pre>
      ) : (
        <div className="file-note">No text changes.</div>
      )}
    </details>
  );
}

function App() {
  const [snapshot, setSnapshot] = useState<ReviewSummary | null>(null);
  const [status, setStatus] = useState<ReviewStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    request<ReviewSummary>("/api/snapshot")
      .then((next) => {
        if (!disposed) setSnapshot(next);
      })
      .catch((reason: Error) => {
        if (!disposed) setError(reason.message);
      });
    const poll = async () => {
      try {
        const next = await request<ReviewStatus>("/api/status");
        if (!disposed) {
          setStatus(next);
          setConnectionError(null);
        }
      } catch {
        if (!disposed)
          setConnectionError("Connection lost. Check that changemap is still running.");
      }
      if (!disposed) timer = setTimeout(poll, 1500);
    };
    void poll();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, []);

  async function refresh() {
    setBusy(true);
    try {
      const next = await request<ReviewSummary>("/api/refresh", "POST");
      setSnapshot(next);
      setStatus({ snapshotId: next.id, stale: false, refreshing: false, error: null });
      setError(null);
      setConnectionError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  const stale = status?.stale || (snapshot && status && snapshot.id !== status.snapshotId);
  const notice = error ?? status?.error ?? connectionError;
  const repository = snapshot?.repository.split(/[/\\]/).pop();
  return (
    <div className="app">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="changemap home">
          <span className="brand-mark" aria-hidden="true">
            ↗
          </span>
          changemap
        </a>
        <span className="local-label">
          <span aria-hidden="true">●</span> LOCAL REVIEW
        </span>
      </header>
      <main>
        <div className="eyebrow">
          {repository ?? "YOUR REPOSITORY"}
          <span>/</span>CHANGES
        </div>
        <div className="title-row">
          <div>
            <h1>A moment in your code.</h1>
            <p className="intro">Read the changes. Refresh when you’re ready.</p>
          </div>
          <button
            onClick={() => void refresh()}
            disabled={busy || status?.refreshing}
            className="refresh"
          >
            {busy ? "Capturing…" : notice ? "Retry refresh" : "Refresh comparison"}
            <span aria-hidden="true">↻</span>
          </button>
        </div>
        {notice && (
          <div className="notice error" role="alert">
            {notice}
            <small>Your captured comparison is kept until a refresh succeeds.</small>
          </div>
        )}
        {stale && !notice && (
          <div className="notice" role="status">
            New changes are available.
            <small>You’re still viewing the captured comparison. Refresh to update it.</small>
          </div>
        )}
        {snapshot ? (
          <>
            <section className="comparison" aria-label="Comparison targets">
              <div>
                <span className="caption">BEFORE</span>
                <StateLabel state={snapshot.before} />
              </div>
              <span className="direction" role="img" aria-label="to">
                →
              </span>
              <div>
                <span className="caption">AFTER</span>
                <StateLabel state={snapshot.after} />
              </div>
              <div className="capture-time">
                <span className="caption">CAPTURED</span>
                <time dateTime={snapshot.capturedAt}>
                  {new Date(snapshot.capturedAt).toLocaleTimeString()}
                </time>
                <span className="snapshot-state">
                  {stale ? "Update available" : "Snapshot held"}
                </span>
              </div>
            </section>
            <section className="changes" aria-label="Changed files">
              <div className="section-heading">
                <h2>
                  Changed files <span>{snapshot.changes.length.toString().padStart(2, "0")}</span>
                </h2>
                <span>BEFORE → AFTER</span>
              </div>
              {snapshot.changes.length ? (
                <div key={snapshot.id}>
                  {snapshot.changes.map((change) => (
                    <ChangedFile key={change.newPath ?? change.oldPath} change={change} />
                  ))}
                </div>
              ) : (
                <div className="empty">
                  <span aria-hidden="true">✓</span>
                  <h3>No changes</h3>
                  <p>These two states match. New changes will appear here after you refresh.</p>
                </div>
              )}
            </section>
            <footer>
              <span>
                Captured locally ·{" "}
                {snapshot.mode === "commit"
                  ? "Single commit"
                  : snapshot.mode === "compare"
                    ? "Direct comparison"
                    : snapshot.mode}
              </span>
              <span>Closing this tab keeps the server running. Stop it with Ctrl+C.</span>
            </footer>
          </>
        ) : (
          <div className="loading" role="status">
            {notice
              ? "The comparison could not be loaded. Use Retry refresh to try again."
              : "Loading your comparison…"}
          </div>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
