import { Dialog } from "@base-ui/react/dialog";
import { Popover } from "@base-ui/react/popover";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Radio } from "@base-ui/react/radio";
import { Checkbox } from "@base-ui/react/checkbox";
import type { ReviewSummary } from "../shared/review.js";
import { themes, orientations, type Settings } from "../shared/settings.js";
import type { DiffDisplaySettings } from "./code-pane.js";
import {
  Check,
  ChevronDown,
  Columns2,
  Info,
  Settings as SettingsIcon,
  TextAlignStart,
  X,
} from "lucide-react";
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
  settings,
  ready,
  warning,
  onSettingsChange,
  display,
  onDisplayChange,
}: {
  settings: Settings;
  ready: boolean;
  warning: string | null;
  onSettingsChange(next: Settings): void;
  display: DiffDisplaySettings;
  onDisplayChange(next: DiffDisplaySettings): void;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        className="icon-button settings-trigger"
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
                <Dialog.Title>Display settings</Dialog.Title>
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
            <div className="settings-content">
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
              <fieldset className="diff-layout-field">
                <legend>Diff layout</legend>
                <RadioGroup
                  className="layout-choices"
                  value={display.layout}
                  onValueChange={(value) =>
                    onDisplayChange({ ...display, layout: value as DiffDisplaySettings["layout"] })
                  }
                >
                  <label className="layout-choice">
                    <Radio.Root value="unified" className="layout-radio">
                      <Radio.Indicator />
                    </Radio.Root>
                    <TextAlignStart className="layout-icon" aria-hidden="true" />
                    <span>
                      <strong>Unified</strong>
                      <small>Changes in one column</small>
                    </span>
                  </label>
                  <label className="layout-choice">
                    <Radio.Root value="split" className="layout-radio">
                      <Radio.Indicator />
                    </Radio.Root>
                    <Columns2 className="layout-icon" aria-hidden="true" />
                    <span>
                      <strong>Split</strong>
                      <small>Before and after side by side</small>
                    </span>
                  </label>
                </RadioGroup>
              </fieldset>
              <label className="whitespace-choice">
                <Checkbox.Root
                  checked={display.ignoreWhitespace}
                  onCheckedChange={(checked) =>
                    onDisplayChange({ ...display, ignoreWhitespace: checked === true })
                  }
                  className="settings-checkbox"
                >
                  <Checkbox.Indicator className="settings-checkbox-indicator">
                    <Check aria-hidden="true" />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                <span>
                  <strong>Ignore whitespace</strong>
                  <small>Hide whitespace-only changes in Diff</small>
                </span>
              </label>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
