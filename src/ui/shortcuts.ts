import { useEffect } from "react";

export const shortcutGroups = [
  {
    title: "Graph",
    shortcuts: [
      ["−", "Zoom out"],
      ["+ / =", "Zoom in"],
      ["F / 0", "Fit graph"],
      ["R", "Refresh comparison"],
      ["Esc", "Close code pane"],
    ],
  },
  {
    title: "Selected file",
    shortcuts: [
      ["E", "Open in editor"],
      ["C", "Copy path"],
    ],
  },
  { title: "Help", shortcuts: [["?", "Show keyboard shortcuts"]] },
];

export function useShortcuts(handle: (key: string, event: KeyboardEvent) => boolean | void) {
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
        )
      )
        return;
      // Let dialogs and popovers own their keys, including Escape.
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      if (handle(event.key.toLowerCase(), event)) event.preventDefault();
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [handle]);
}
