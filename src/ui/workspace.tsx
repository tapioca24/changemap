import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { ReviewSummary } from "../shared/review.js";
import type { Settings } from "../shared/settings.js";
import { Graph, statusLabels } from "./graph.js";
import { CodePane } from "./code-pane.js";

const storageKey = "changemap.workspace";
// A cookie survives the CLI's ephemeral ports; store only these non-sensitive preferences.
function loadPreferences(): { width: number; listOpen: boolean } {
  try {
    const value = JSON.parse(
      decodeURIComponent(
        document.cookie
          .split("; ")
          .find((cookie) => cookie.startsWith(`${storageKey}=`))
          ?.slice(storageKey.length + 1) ?? "null",
      ),
    );
    return {
      width:
        typeof value?.width === "number" && Number.isFinite(value.width)
          ? Math.min(50, Math.max(0, value.width))
          : 30,
      listOpen: typeof value?.listOpen === "boolean" ? value.listOpen : true,
    };
  } catch {
    return { width: 30, listOpen: true };
  }
}

export function Workspace({
  snapshot,
  direction,
  selected,
  onSelect,
  refresh,
}: {
  snapshot: ReviewSummary;
  direction: Settings["orientation"];
  selected: string | null;
  onSelect(id: string | null): void;
  refresh: ReactNode;
}) {
  const [preferences, setPreferences] = useState(loadPreferences);
  const [paneOpen, setPaneOpen] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [width, setWidth] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const node = snapshot.graph.merged.nodes.find((file) => file.id === selected);
  const open = paneOpen && !!node;
  const narrow = width > 0 && width < 960;
  const minimum = width ? Math.min(50, (320 / width) * 100) : 0;
  const paneWidth = Math.max(minimum, preferences.width);
  const outside = snapshot.graph.merged.nodes.filter(
    (file) => !file.analyzed.before && !file.analyzed.after,
  );
  useEffect(() => {
    const element = root.current!;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    try {
      if (!resizing)
        document.cookie = `${storageKey}=${encodeURIComponent(JSON.stringify(preferences))}; Path=/; Max-Age=31536000; SameSite=Strict`;
    } catch {
      /* Storage is optional. */
    }
  }, [preferences, resizing]);
  useEffect(() => {
    if (open && narrow) closeButton.current?.focus();
  }, [open, narrow]);
  const select = useCallback(
    (id: string) => {
      returnFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      onSelect(id);
      setPaneOpen(true);
    },
    [onSelect],
  );
  function close() {
    setPaneOpen(false);
    requestAnimationFrame(() => returnFocus.current?.isConnected && returnFocus.current.focus());
  }
  function resize(next: number) {
    setPreferences((current) => ({ ...current, width: Math.min(50, Math.max(minimum, next)) }));
  }
  return (
    <div
      ref={root}
      className={`workspace${open ? " pane-open" : ""}${resizing ? " resizing" : ""}`}
      style={{ "--pane-width": `${paneWidth}%` } as CSSProperties}
    >
      <section className="map-pane" aria-label="Change map" inert={narrow && open}>
        <div className="map-toolbar">
          <h1>Change map</h1>
          {!!outside.length && (
            <button
              aria-expanded={preferences.listOpen}
              aria-controls="outside-files"
              onClick={() =>
                setPreferences((current) => ({ ...current, listOpen: !current.listOpen }))
              }
            >
              Other files <span>{outside.length}</span>
            </button>
          )}
          {selected && !open && (
            <button onClick={() => setPaneOpen(true)}>Open selected file</button>
          )}
          {refresh}
        </div>
        <div className="map-body">
          {!!outside.length && preferences.listOpen && (
            <section
              id="outside-files"
              className="unanalyzed"
              aria-label="Unanalyzed changed files"
            >
              <h2>Outside dependency analysis</h2>
              <p>These files are not analyzed; this does not mean they have no dependencies.</p>
              <div>
                {outside.map((file) => (
                  <button
                    className={`unanalyzed-node ${file.status}`}
                    key={file.id}
                    aria-pressed={selected === file.id}
                    onClick={() => select(file.id)}
                  >
                    <span>{statusLabels[file.status]}</span>
                    <strong>{file.newPath ?? file.oldPath}</strong>
                    {file.change?.binary && <small>Binary</small>}
                  </button>
                ))}
              </div>
            </section>
          )}
          <Graph
            graph={snapshot.graph}
            direction={direction}
            selected={selected}
            onSelect={select}
            resizing={resizing}
            suspended={narrow && open}
          />
        </div>
        <div className="legend" aria-label="Graph legend">
          {Object.entries(statusLabels).map(([status, label]) => (
            <span className={`status ${status}`} key={status}>
              {label}
            </span>
          ))}
          <small>
            Reference source → target · Edges: + added · − dashed deleted · solid unchanged
          </small>
        </div>
      </section>
      {open && (
        <>
          <div
            className="pane-resizer"
            role="separator"
            aria-label="Resize code pane"
            aria-orientation="vertical"
            aria-valuemin={Math.round(minimum)}
            aria-valuemax={50}
            aria-valuenow={Math.round(paneWidth)}
            aria-controls="code-panel"
            tabIndex={0}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              setResizing(true);
            }}
            onPointerMove={(event) => {
              if (resizing && width)
                resize(
                  ((root.current!.getBoundingClientRect().right - event.clientX) / width) * 100,
                );
            }}
            onPointerUp={(event) => {
              event.currentTarget.releasePointerCapture(event.pointerId);
              setResizing(false);
            }}
            onPointerCancel={() => setResizing(false)}
            onLostPointerCapture={() => setResizing(false)}
            onKeyDown={(event) => {
              const next = {
                ArrowLeft: paneWidth + 2,
                ArrowRight: paneWidth - 2,
                Home: minimum,
                End: 50,
              }[event.key];
              if (next !== undefined) {
                event.preventDefault();
                resize(next);
              }
            }}
          />
          <div id="code-panel" className="code-panel">
            <div className="code-toolbar">
              <span>CAPTURED CODE</span>
              <button ref={closeButton} onClick={close}>
                {narrow ? "← Back to graph" : "Close code pane ×"}
              </button>
            </div>
            <CodePane key={node.id} snapshot={snapshot} node={node} />
          </div>
        </>
      )}
    </div>
  );
}
