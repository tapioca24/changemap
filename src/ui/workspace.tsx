import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ReviewSummary } from "../shared/review.js";
import type { Settings } from "../shared/settings.js";
import { Graph } from "./graph.js";
import { CodePane, defaultDiffDisplay, type DiffDisplaySettings } from "./code-pane.js";
import { ArrowLeft, ChevronRight, Files } from "lucide-react";
import { createMapModel, type GoView } from "./map-model.js";
import { PackagePane } from "./package-pane.js";
import { StatusBadge } from "./status-badge.js";
import { Button } from "@base-ui/react/button";

const storageKey = "changemap.workspace";
const maxCodePanePixels = 1920;
const maxCodePanePercentage = 70;
// A cookie survives the CLI's ephemeral ports; store only these non-sensitive preferences.
export interface WorkspacePreferences {
  width: number;
  listOpen: boolean;
  display: DiffDisplaySettings;
  goView: GoView;
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
    return {
      width:
        typeof value?.width === "number" && Number.isFinite(value.width)
          ? Math.min(maxCodePanePercentage, Math.max(0, value.width))
          : 45,
      listOpen: typeof value?.listOpen === "boolean" ? value.listOpen : false,
      goView: value?.goView === "files" ? "files" : "packages",
      display: {
        layout: value?.display?.layout === "split" ? "split" : "unified",
        ignoreWhitespace:
          typeof value?.display?.ignoreWhitespace === "boolean"
            ? value.display.ignoreWhitespace
            : defaultDiffDisplay.ignoreWhitespace,
      },
    };
  } catch {
    return { width: 45, listOpen: false, display: defaultDiffDisplay, goView: "packages" };
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
  const [packageSelection, setPackageSelection] = useState<string | null>(null);
  const [showPackageFiles, setShowPackageFiles] = useState(false);
  const map = useMemo(
    () => createMapModel(snapshot.graph, preferences.goView),
    [snapshot.graph, preferences.goView],
  );
  const pkg = map.nodes.find((node) => node.kind === "package" && node.id === packageSelection);
  const activePackage = pkg?.kind === "package" ? pkg : null;
  const mapSelection =
    activePackage?.id ??
    map.nodes.find((item) =>
      item.kind === "file" ? item.id === selected : item.files.some((file) => file.id === selected),
    )?.id ??
    null;
  const hasGo = snapshot.graph.merged.nodes.some(
    (file) =>
      (file.analyzed.before && file.oldPath?.endsWith(".go")) ||
      (file.analyzed.after && file.newPath?.endsWith(".go")),
  );
  const [resizing, setResizing] = useState(false);
  const [width, setWidth] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const node = snapshot.graph.merged.nodes.find((file) => file.id === selected);
  const open = paneOpen && (showPackageFiles ? !!activePackage : !!node);
  const narrow = width > 0 && width < 960;
  const outside = snapshot.graph.merged.nodes.filter(
    (file) => !file.analyzed.before && !file.analyzed.after,
  );
  const otherFilesWidth = narrow ? 220 : 280;
  const graphMinimum = preferences.listOpen && outside.length ? otherFilesWidth + 320 : 320;
  const maximum = width
    ? Math.max(
        0,
        Math.min(
          maxCodePanePercentage,
          (maxCodePanePixels / width) * 100,
          narrow ? maxCodePanePercentage : ((width - graphMinimum - 6) / width) * 100,
        ),
      )
    : maxCodePanePercentage;
  const minimum = width ? Math.min(maximum, (320 / width) * 100) : 0;
  const paneWidth = Math.min(maximum, Math.max(minimum, preferences.width));
  useEffect(() => {
    const element = root.current!;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (open && (narrow || activePackage)) closeButton.current?.focus();
  }, [open, narrow, showPackageFiles, node?.id, activePackage?.id]);
  const select = useCallback(
    (id: string) => {
      returnFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const target = map.nodes.find((item) => item.id === id);
      if (target?.kind === "package") {
        setPackageSelection(id);
        setShowPackageFiles(true);
        onSelect(null);
      } else {
        setPackageSelection(null);
        setShowPackageFiles(false);
        onSelect(id);
      }
      setPaneOpen(true);
    },
    [onSelect, map],
  );
  function close() {
    setPaneOpen(false);
    requestAnimationFrame(() => returnFocus.current?.isConnected && returnFocus.current.focus());
  }
  function resize(next: number) {
    setPreferences((current) => ({
      ...current,
      width: Math.min(maximum, Math.max(minimum, next)),
    }));
  }
  return (
    <div
      ref={root}
      className={`workspace${open ? " pane-open" : ""}${resizing ? " resizing" : ""}`}
      style={{ "--pane-width": `${paneWidth}%` } as CSSProperties}
    >
      <section className="map-pane" aria-label="Change map" inert={narrow && open}>
        {hasGo && (
          <div className="map-toolbar go-map-toolbar">
            <label>
              Go map
              <select
                aria-label="Go map granularity"
                value={preferences.goView}
                onChange={(event) => {
                  const goView = event.target.value as GoView;
                  setPreferences((current) => ({ ...current, goView }));
                  setPackageSelection(null);
                  setShowPackageFiles(false);
                  if (showPackageFiles) setPaneOpen(false);
                }}
              >
                <option value="packages">Packages</option>
                <option value="files">Files</option>
              </select>
            </label>
            <span>Direct dependencies and users of changed files</span>
          </div>
        )}
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
          {(selected || activePackage) && !open && (
            <Button className="reopen-code" onClick={() => setPaneOpen(true)}>
              {showPackageFiles ? "Open selected package" : "Open selected file"}{" "}
              <ChevronRight aria-hidden="true" />
            </Button>
          )}
          <Graph
            graph={snapshot.graph}
            model={map}
            direction={direction}
            groupByDirectory={groupByDirectory}
            selected={mapSelection}
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
                End: maximum,
              }[event.key];
              if (next !== undefined) {
                event.preventDefault();
                resize(next);
              }
            }}
          />
          <div id="code-panel" className="code-panel">
            {showPackageFiles && activePackage ? (
              <PackagePane
                pkg={activePackage}
                onSelect={(id) => {
                  onSelect(id);
                  setShowPackageFiles(false);
                }}
                onClose={close}
                closeButtonRef={closeButton}
                narrow={narrow}
              />
            ) : node ? (
              <>
                {activePackage && (
                  <Button className="package-back" onClick={() => setShowPackageFiles(true)}>
                    <ArrowLeft aria-hidden="true" /> Back to package files
                  </Button>
                )}
                <CodePane
                  key={node.id}
                  snapshot={snapshot}
                  node={node}
                  display={preferences.display}
                  onClose={close}
                  closeButtonRef={closeButton}
                  narrow={narrow}
                />
              </>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
