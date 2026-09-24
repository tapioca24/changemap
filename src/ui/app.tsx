import { useEffect, useRef, useState, type CSSProperties } from "react";
import { flavors } from "@catppuccin/palette";
import type { ReviewStatus, ReviewSummary } from "../shared/review.js";
import {
  defaults,
  themes,
  orientations,
  type Settings,
  type SettingsState,
} from "../shared/settings.js";
import { request } from "./api.js";
import { Workspace } from "./workspace.js";
import "./style.css";

export function App() {
  const [snapshot, setSnapshot] = useState<ReviewSummary | null>(null);
  const [status, setStatus] = useState<ReviewStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(defaults);
  const [settingsReady, setSettingsReady] = useState(false);
  const [settingsWarning, setSettingsWarning] = useState<string | null>(null);
  const settingsRef = useRef(settings);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const saveVersion = useRef(0);
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
    request<SettingsState>("/api/settings")
      .then((next) => {
        if (!disposed) {
          setSettings(next.settings);
          settingsRef.current = next.settings;
          setSettingsWarning(next.warning);
          setSettingsReady(true);
        }
      })
      .catch(() => {
        if (!disposed) {
          setSettingsWarning("Settings could not be loaded. Defaults are active.");
          setSettingsReady(true);
        }
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
  function changeSettings(next: Settings) {
    settingsRef.current = next;
    setSettings(next);
    const version = ++saveVersion.current;
    saveQueue.current = saveQueue.current.then(async () => {
      try {
        const result = await request<SettingsState>("/api/settings", "POST", next);
        if (version === saveVersion.current) setSettingsWarning(result.warning);
      } catch {
        if (version === saveVersion.current)
          setSettingsWarning(
            "Settings could not be saved. These changes may not persist across restarts.",
          );
      }
    });
  }
  async function refresh() {
    setBusy(true);
    try {
      const next = await request<ReviewSummary>("/api/refresh", "POST");
      setSnapshot(next);
      setSelected((current) => {
        const previous = snapshot?.graph.merged.nodes.find((file) => file.id === current);
        if (!previous) return null;
        const match = next.graph.merged.nodes.find(
          (file) =>
            (previous.oldPath !== null && file.oldPath === previous.oldPath) ||
            (previous.newPath !== null && file.newPath === previous.newPath),
        );
        return match?.id ?? null;
      });
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
  const refreshButton = (
    <button
      className="refresh"
      disabled={busy || status?.refreshing}
      onClick={() => void refresh()}
    >
      {busy || status?.refreshing ? "Capturing…" : notice ? "Retry refresh" : "Refresh comparison"}{" "}
      ↻
    </button>
  );
  const palette = flavors[settings.theme];
  const style = Object.fromEntries(
    palette.colorEntries.map(([name, color]) => [`--${name}`, color.hex]),
  ) as CSSProperties;
  return (
    <div className="app" style={style} data-theme={settings.theme}>
      <header className="topbar">
        <a className="wordmark" href="/">
          ↗ changemap
        </a>
        <span className="local-label">LOCAL / REVIEW</span>
        <div className="settings">
          <label>
            Theme
            <select
              value={settings.theme}
              disabled={!settingsReady}
              onChange={(event) =>
                changeSettings({
                  ...settingsRef.current,
                  theme: event.target.value as Settings["theme"],
                })
              }
            >
              {themes.map((theme) => (
                <option key={theme} value={theme}>
                  {flavors[theme].name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Direction
            <select
              value={settings.orientation}
              disabled={!settingsReady}
              onChange={(event) =>
                changeSettings({
                  ...settingsRef.current,
                  orientation: event.target.value as Settings["orientation"],
                })
              }
            >
              {orientations.map((direction) => (
                <option key={direction} value={direction}>
                  {
                    {
                      LR: "Left → right",
                      TB: "Top → bottom",
                      RL: "Right → left",
                      BT: "Bottom → top",
                    }[direction]
                  }
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <main>
        {settingsWarning && (
          <div className="notice" role="status">
            {settingsWarning}
          </div>
        )}
        {notice && (
          <div className="notice error" role="alert">
            {notice}
            <small>Your captured graph and code are kept until a refresh succeeds.</small>
          </div>
        )}
        {stale && !notice && (
          <div className="notice" role="status">
            New changes are available.{" "}
            <small>The captured graph and code stay fixed until you refresh.</small>
          </div>
        )}
        {snapshot ? (
          <>
            <section className="comparison" aria-label="Comparison targets">
              <strong className="repository-name" title={snapshot.repository}>
                {snapshot.repository.split(/[/\\]/).pop()}
              </strong>
              <div>
                <small>BEFORE</small>
                <strong>{snapshot.before.label}</strong>
                <code>{snapshot.before.commit?.slice(0, 8) ?? snapshot.before.kind}</code>
              </div>
              <span>→</span>
              <div>
                <small>AFTER</small>
                <strong>{snapshot.after.label}</strong>
                <code>{snapshot.after.commit?.slice(0, 8) ?? snapshot.after.kind}</code>
              </div>
              <div className="capture-time">
                <small>{snapshot.changes.length} CHANGED FILES</small>
                <time dateTime={snapshot.capturedAt}>
                  {new Date(snapshot.capturedAt).toLocaleTimeString()}
                </time>
                <span>{stale ? "Update available" : "Snapshot held"}</span>
              </div>
            </section>
            {snapshot.graph.incomplete && (
              <details className="notice analysis">
                <summary>Dependency analysis is incomplete. Direct users may be missing.</summary>
                <p>
                  Resolved dependencies and code remain available. Unresolved references may exist
                  outside the displayed graph.
                </p>
                <ul>
                  {(["before", "after"] as const).flatMap((side) =>
                    snapshot.graph[side].diagnostics.map((diagnostic, i) => (
                      <li key={`${side}-${i}`}>
                        {side} · {diagnostic.path}: {diagnostic.message}
                      </li>
                    )),
                  )}
                </ul>
              </details>
            )}
            {snapshot.changes.length ? (
              <Workspace
                snapshot={snapshot}
                direction={settings.orientation}
                selected={selected}
                onSelect={setSelected}
                refresh={refreshButton}
              />
            ) : (
              <section className="empty">
                {refreshButton}
                <span>✓</span>
                <h2>No changes</h2>
                <p>These two states match. New changes appear after you refresh.</p>
              </section>
            )}
            <footer>
              <span>Captured locally · {snapshot.mode}</span>
              <span>Stop the server with Ctrl+C.</span>
            </footer>
          </>
        ) : (
          <div className="loading-comparison">
            {refreshButton}
            <p role="status">
              {notice ? "Use Retry refresh to load the comparison." : "Loading your comparison…"}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
