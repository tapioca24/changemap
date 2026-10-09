import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { ReviewSummary } from "../shared/review.js";
import type { Settings } from "../shared/settings.js";
import { Graph } from "./graph.js";
import { CodePane, defaultDiffDisplay, type DiffDisplaySettings } from "./code-pane.js";
import { ChevronRight, Files } from "lucide-react";
import { StatusBadge } from "./status-badge.js";
import { Button } from "@base-ui/react/button";

const storageKey = "changemap.workspace";
const minCodePanePixels = 320;
const maxCodePanePixels = 1920;
// A cookie survives the CLI's ephemeral ports; store only these non-sensitive preferences.
export interface WorkspacePreferences {
  width: number;
  widthUnit: "px" | "%";
  listOpen: boolean;
  display: DiffDisplaySettings;
}

export function loadPreferences(): WorkspacePreferences {
  try {
    const value = JSON.parse(
      decodeURIComponent(
        document.cookie
          .split("; ")
          .find((cookie) => cookie.startsWith(`${storageKey}=`))
          ?.slice(storageKey.length + 1) ?? "null",
      ),
    );
    const hasWidth = typeof value?.width === "number" && Number.isFinite(value.width);
    const widthUnit = hasWidth && value?.widthUnit === "px" ? "px" : "%";
    return {
      width: hasWidth
        ? widthUnit === "px"
          ? Math.min(maxCodePanePixels, Math.max(minCodePanePixels, value.width))
          : Math.min(70, Math.max(0, value.width))
        : 45,
      widthUnit,
      listOpen: typeof value?.listOpen === "boolean" ? value.listOpen : false,
      display: {
        layout: value?.display?.layout === "split" ? "split" : "unified",
        ignoreWhitespace:
          typeof value?.display?.ignoreWhitespace === "boolean"
            ? value.display.ignoreWhitespace
            : defaultDiffDisplay.ignoreWhitespace,
      },
    };
  } catch {
    return { width: 45, widthUnit: "%", listOpen: false, display: defaultDiffDisplay };
  }
}

export function savePreferences(preferences: WorkspacePreferences) {
  try {
    document.cookie = `${storageKey}=${encodeURIComponent(JSON.stringify(preferences))}; Path=/; Max-Age=31536000; SameSite=Strict`;
  } catch {
    /* Storage is optional. */
  }
}

export function Workspace({
  snapshot,
  direction,
  groupByDirectory,
  selected,
  onSelect,
  preferences,
  setPreferences,
}: {
  snapshot: ReviewSummary;
  direction: Settings["orientation"];
  groupByDirectory: boolean;
  selected: string | null;
  onSelect(id: string | null): void;
  preferences: WorkspacePreferences;
  setPreferences: React.Dispatch<React.SetStateAction<WorkspacePreferences>>;
}) {
  const [paneOpen, setPaneOpen] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [width, setWidth] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const node = snapshot.graph.merged.nodes.find((file) => file.id === selected);
  const open = paneOpen && !!node;
  const narrow = width > 0 && width < 960;
  const outside = snapshot.graph.merged.nodes.filter(
    (file) => !file.analyzed.before && !file.analyzed.after,
  );
  const otherFilesWidth = narrow ? 220 : 280;
  const graphMinimum = preferences.listOpen && outside.length ? otherFilesWidth + 320 : 320;
  const maximum =
    width && !narrow
      ? Math.max(0, Math.min(maxCodePanePixels, width - graphMinimum - 6))
      : maxCodePanePixels;
  const minimum = Math.min(maximum, minCodePanePixels);
  const preferredWidth =
    preferences.widthUnit === "px"
      ? preferences.width
      : Math.min(maxCodePanePixels, Math.max(minCodePanePixels, (width * preferences.width) / 100));
  // Only the displayed width is constrained by available space; keep the preference for restoration.
  const paneWidth = Math.min(maximum, Math.max(minimum, preferredWidth));
  useEffect(() => {
    const element = root.current!;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    // Wait for the first wide-screen opening before converting defaults or legacy percentages.
    if (!open || width < 960 || preferences.widthUnit === "px") return;
    setPreferences((current) =>
      current.widthUnit === "px" ? current : { ...current, width: preferredWidth, widthUnit: "px" },
    );
  }, [open, width, preferences.widthUnit, preferredWidth, setPreferences]);
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
    setPreferences((current) => ({
      ...current,
      width: Math.min(maximum, Math.max(minimum, next)),
      widthUnit: "px",
    }));
  }
  return (
    <div
      ref={root}
      className={`workspace${open ? " pane-open" : ""}${resizing ? " resizing" : ""}`}
      style={{ "--pane-width": `${paneWidth}px` } as CSSProperties}
    >
      <section className="map-pane" aria-label="Change map" inert={narrow && open}>
        <div className="map-body">
          {!!outside.length && (
            <section
              id="outside-files"
              className={`unanalyzed${preferences.listOpen ? " is-open" : ""}`}
              aria-label="Unanalyzed changed files"
              inert={!preferences.listOpen}
              aria-hidden={!preferences.listOpen}
            >
              <div className="unanalyzed-heading">
                <h2>
                  Other files <span>{outside.length}</span>
                </h2>
                <p>Outside dependency analysis</p>
              </div>
              <div className="unanalyzed-list">
                {outside.map((file) => (
                  <button
                    className={`unanalyzed-node ${file.status}`}
                    key={file.id}
                    aria-pressed={selected === file.id}
                    onClick={() => select(file.id)}
                  >
                    <StatusBadge status={file.status} />
                    <strong>{file.newPath ?? file.oldPath}</strong>
                    {file.change?.binary && <small>Binary</small>}
                  </button>
                ))}
              </div>
            </section>
          )}
          {!!outside.length && (
            <Button
              className={`other-files-toggle${preferences.listOpen ? " is-open" : ""}`}
              aria-label={
                preferences.listOpen ? "Close Other files" : `Open Other files (${outside.length})`
              }
              aria-expanded={preferences.listOpen}
              aria-controls="outside-files"
              onClick={() =>
                setPreferences((current) => ({ ...current, listOpen: !current.listOpen }))
              }
            >
              <Files aria-hidden="true" />
              <span>{preferences.listOpen ? "Close" : `Other files · ${outside.length}`}</span>
            </Button>
          )}
          {selected && !open && (
            <Button className="reopen-code" onClick={() => setPaneOpen(true)}>
              Open selected file <ChevronRight aria-hidden="true" />
            </Button>
          )}
          <Graph
            graph={snapshot.graph}
            direction={direction}
            groupByDirectory={groupByDirectory}
            selected={selected}
            onSelect={select}
            resizing={resizing}
            suspended={narrow && open}
          />
        </div>
      </section>
      {open && (
        <>
          <div
            className="pane-resizer"
            role="separator"
            aria-label="Resize code pane"
            aria-orientation="vertical"
            aria-valuemin={minimum}
            aria-valuemax={maximum}
            aria-valuenow={paneWidth}
            aria-valuetext={`${Math.round(paneWidth)} pixels`}
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
                resize(root.current!.getBoundingClientRect().right - event.clientX);
            }}
            onPointerUp={(event) => {
              event.currentTarget.releasePointerCapture(event.pointerId);
              setResizing(false);
            }}
            onPointerCancel={() => setResizing(false)}
            onLostPointerCapture={() => setResizing(false)}
            onKeyDown={(event) => {
              const next = {
                ArrowLeft: paneWidth + 20,
                ArrowRight: paneWidth - 20,
                Home: minimum,
                End: maximum,
              }[event.key];
              if (next !== undefined) {
                event.preventDefault();
                resize(next);
              }
            }}
          />
          <div id="code-panel" className="code-panel">
            <CodePane
              key={node.id}
              snapshot={snapshot}
              node={node}
              display={preferences.display}
              onClose={close}
              closeButtonRef={closeButton}
              narrow={narrow}
            />
          </div>
        </>
      )}
    </div>
  );
}
