import { Tabs } from "@base-ui/react/tabs";
import { shortcutGroups } from "./shortcuts.js";
import { Dialog } from "@base-ui/react/dialog";
import { Popover } from "@base-ui/react/popover";
import { Checkbox } from "@base-ui/react/checkbox";
import type { ReviewSummary } from "../shared/review.js";
import { themes, orientations, type Settings } from "../shared/settings.js";
import { Check, ChevronDown, Info, Settings as SettingsIcon, X } from "lucide-react";
import { themeName } from "./themes.js";

// Base UI owns composite interactions (dialogs, popovers, tabs, radio and checkbox state).
// Native selects retain the platform picker for the long theme list and graph directions.

export function SnapshotDetails({ snapshot }: { snapshot: ReviewSummary }) {
  const go = snapshot.graph.after.go ?? snapshot.graph.before.go;
  return (
    <Popover.Root>
      <Popover.Trigger className="snapshot-trigger" aria-label="Snapshot details">
        <Info aria-hidden="true" />
        <span>Details</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          className="review-popover-positioner"
          side="bottom"
          align="end"
          sideOffset={8}
        >
          <Popover.Popup className="snapshot-popup">
            <Popover.Title>Snapshot details</Popover.Title>
            <dl>
              <dt>Repository</dt>
              <dd title={snapshot.repository}>{snapshot.repository}</dd>
              <dt>Before</dt>
              <dd>
                {snapshot.before.label}{" "}
                <code>{snapshot.before.commit ?? snapshot.before.kind}</code>
              </dd>
              <dt>After</dt>
              <dd>
                {snapshot.after.label} <code>{snapshot.after.commit ?? snapshot.after.kind}</code>
              </dd>
              <dt>Changed files</dt>
              <dd>{snapshot.changes.length}</dd>
              <dt>Captured</dt>
              <dd>
                <time dateTime={snapshot.capturedAt}>
                  {new Date(snapshot.capturedAt).toLocaleString()}
                </time>
              </dd>
              {go && (
                <>
                  <dt>Go analysis</dt>
                  <dd>
                    {go.os}/{go.arch} · tags: {go.tags.join(", ") || "none"} · {go.version} · cgo
                    disabled
                  </dd>
                </>
              )}
            </dl>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function SettingsDialog({
  section,
  onSectionChange,
  open,
  onOpenChange,
  settings,
  ready,
  warning,
  onSettingsChange,
}: {
  section: string;
  onSectionChange(section: string): void;
  open: boolean;
  onOpenChange(open: boolean): void;
  settings: Settings;
  ready: boolean;
  warning: string | null;
  onSettingsChange(next: Settings): void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger
        className="icon-button settings-trigger"
        onClick={() => onSectionChange("display")}
        aria-label="Settings"
        title={warning ?? "Settings"}
      >
        <SettingsIcon aria-hidden="true" />
        {warning && (
          <span className="settings-warning-indicator" aria-hidden="true">
            !
          </span>
        )}
      </Dialog.Trigger>
      {warning && (
        <span className="sr-only" role="status">
          {warning}
        </span>
      )}
      <Dialog.Portal>
        <Dialog.Backdrop className="dialog-backdrop" />
        <Dialog.Viewport className="dialog-viewport">
          <Dialog.Popup className="settings-dialog">
            <header className="dialog-heading">
              <div>
                <Dialog.Title>Settings</Dialog.Title>
                <Dialog.Description>Changes are applied as you choose them.</Dialog.Description>
              </div>
              <Dialog.Close className="icon-button" aria-label="Close settings">
                <X aria-hidden="true" />
              </Dialog.Close>
            </header>
            {warning && (
              <p role="status" className="settings-warning">
                {warning}
              </p>
            )}
            <Tabs.Root value={section} onValueChange={(value) => onSectionChange(String(value))}>
              <Tabs.List className="settings-tabs" aria-label="Settings sections">
                <Tabs.Tab value="display">Display</Tabs.Tab>
                <Tabs.Tab value="shortcuts">Keyboard shortcuts</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="display" className="settings-content">
                <label className="settings-field">
                  Theme
                  <span className="settings-select-wrap">
                    <select
                      value={settings.theme}
                      disabled={!ready}
                      onChange={(event) =>
                        onSettingsChange({
                          ...settings,
                          theme: event.target.value as Settings["theme"],
                        })
                      }
                    >
                      {themes.map((theme) => (
                        <option key={theme} value={theme}>
                          {themeName(theme)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown aria-hidden="true" />
                  </span>
                </label>
                <label className="settings-field">
                  Graph direction
                  <span className="settings-select-wrap">
                    <select
                      value={settings.orientation}
                      disabled={!ready}
                      onChange={(event) =>
                        onSettingsChange({
                          ...settings,
                          orientation: event.target.value as Settings["orientation"],
                        })
                      }
                    >
                      {orientations.map((direction) => (
                        <option key={direction} value={direction}>
                          {
                            {
                              LR: "Left → Right",
                              TB: "Top → Bottom",
                              RL: "Right → Left",
                              BT: "Bottom → Top",
                            }[direction]
                          }
                        </option>
                      ))}
                    </select>
                    <ChevronDown aria-hidden="true" />
                  </span>
                </label>
                <label className="whitespace-choice">
                  <Checkbox.Root
                    checked={settings.groupByDirectory}
                    disabled={!ready}
                    onCheckedChange={(checked) =>
                      onSettingsChange({ ...settings, groupByDirectory: checked === true })
                    }
                    className="settings-checkbox"
                  >
                    <Checkbox.Indicator className="settings-checkbox-indicator">
                      <Check aria-hidden="true" />
                    </Checkbox.Indicator>
                  </Checkbox.Root>
                  <span>
                    <strong>Group files by directory</strong>
                  </span>
                </label>
                <label className="settings-field">
                  Code font size
                  <span className="settings-select-wrap">
                    <select
                      value={settings.codeFontSize}
                      disabled={!ready}
                      onChange={(event) =>
                        onSettingsChange({ ...settings, codeFontSize: Number(event.target.value) })
                      }
                    >
                      {Array.from({ length: 15 }, (_, i) => i + 10).map((size) => (
                        <option key={size} value={size}>
                          {size}px
                        </option>
                      ))}
                    </select>
                    <ChevronDown aria-hidden="true" />
                  </span>
                </label>
              </Tabs.Panel>
              <Tabs.Panel
                value="shortcuts"
                className="shortcut-help"
                aria-labelledby="shortcut-heading"
              >
                <h3 id="shortcut-heading">Keyboard shortcuts</h3>
                <p>Available outside text fields and dialogs.</p>
                {shortcutGroups.map((group) => (
                  <div className="shortcut-group" key={group.title}>
                    <h4>{group.title}</h4>
                    <dl>
                      {group.shortcuts.map(([key, action]) => (
                        <div className="shortcut-row" key={key}>
                          <dt>{action}</dt>
                          <dd>
                            <kbd>{key}</kbd>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </Tabs.Panel>
            </Tabs.Root>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
