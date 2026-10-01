import { useEffect, useRef, useState } from "react";
import type { ReviewStatus, ReviewSummary } from "../shared/review.js";
import { defaults, type Settings, type SettingsState } from "../shared/settings.js";
import { request } from "./api.js";
import { isLightTheme, themeStyle } from "./themes.js";
import { Workspace, loadPreferences, savePreferences } from "./workspace.js";
import { SettingsDialog, SnapshotDetails } from "./review-controls.js";
import { RefreshCw } from "lucide-react";
import { Button } from "@base-ui/react/button";
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
  const [preferences, setPreferences] = useState(loadPreferences);
  useEffect(() => savePreferences(preferences), [preferences]);
  const settingsRef = useRef(settings);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const saveVersion = useRef(0);
  useEffect(() => {
    for (const [name, value] of Object.entries(themeStyle(settings.theme))) {
      if (name.startsWith("--") && typeof value === "string")
        document.documentElement.style.setProperty(name, value);
    }
  }, [settings.theme]);
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
    <Button
      className="refresh"
      disabled={busy || status?.refreshing}
      onClick={() => void refresh()}
      aria-label={
        busy || status?.refreshing
          ? "Capturing comparison"
          : notice
            ? "Retry refresh"
            : "Refresh comparison"
      }
      title={
        busy || status?.refreshing ? "Capturing…" : notice ? "Retry refresh" : "Refresh comparison"
      }
    >
      <RefreshCw aria-hidden="true" />
      <span>
        {busy || status?.refreshing ? "Capturing…" : notice ? "Retry refresh" : "Refresh"}
      </span>
    </Button>
  );
  return (
    <div
      className="app"
      style={themeStyle(settings.theme)}
      data-theme={settings.theme}
      data-color-scheme={isLightTheme(settings.theme) ? "light" : "dark"}
    >
      <header className="topbar">
        <a className="wordmark" href="/">
          ↗ changemap
        </a>
        {snapshot && (
          <div className="header-comparison" role="group" aria-label="Comparison targets">
            <strong className="repository-name" title={snapshot.repository}>
              {snapshot.repository.split(/[/\\]/).pop()}
            </strong>
            <span className="comparison-target">
              <small>BEFORE</small>
              <strong>{snapshot.before.label}</strong>
              <code>{snapshot.before.commit?.slice(0, 8) ?? snapshot.before.kind}</code>
            </span>
            <span className="comparison-arrow">→</span>
            <span className="comparison-target">
              <small>AFTER</small>
              <strong>{snapshot.after.label}</strong>
              <code>{snapshot.after.commit?.slice(0, 8) ?? snapshot.after.kind}</code>
            </span>
          </div>
        )}
        <div className="header-actions">
          {snapshot && (
            <>
              <span className="change-count">{snapshot.changes.length} changed files</span>
              <time className="capture-clock" dateTime={snapshot.capturedAt}>
                {new Date(snapshot.capturedAt).toLocaleTimeString()}
              </time>
              {stale && (
                <span className="update-available" role="status">
                  Update available
                </span>
              )}
              <SnapshotDetails snapshot={snapshot} />
            </>
          )}
          {refreshButton}
          <SettingsDialog
            settings={settings}
            ready={settingsReady}
            warning={settingsWarning}
            onSettingsChange={changeSettings}
            display={preferences.display}
            onDisplayChange={(display) => setPreferences((current) => ({ ...current, display }))}
          />
        </div>
      </header>
      <main>
        {notice && (
          <div className="notice error" role="alert">
            {notice}
            <small>Your captured graph and code are kept until a refresh succeeds.</small>
          </div>
        )}
        {snapshot ? (
          <>
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
                preferences={preferences}
                setPreferences={setPreferences}
              />
            ) : (
              <section className="empty">
                <span>✓</span>
                <h2>No changes</h2>
                <p>These two states match. New changes appear after you refresh.</p>
              </section>
            )}
          </>
        ) : (
          <div className="loading-comparison">
            <p role="status">
              {notice ? "Use Retry refresh to load the comparison." : "Loading your comparison…"}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
