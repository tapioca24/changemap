import { useEffect, useRef, useState } from "react";
import type { MergedFileNode } from "../graph/model.js";
import { request } from "./api.js";

interface EditorFileState {
  available: boolean;
  path: string;
  differs: boolean;
  reason?: string;
}

export function useEditorFile(
  snapshotId: string,
  node: MergedFileNode | undefined,
  enabled = true,
) {
  const editorKey = JSON.stringify([snapshotId, node?.id]);
  const [editorFile, setEditorFile] = useState<{ key: string; value: EditorFileState } | null>(
    null,
  );
  const activeKey = useRef(editorKey);
  activeKey.current = editorKey;
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState({ key: editorKey, message: "", error: "" });
  const editorBusy = busyKey === editorKey;
  const editorMessage = feedback.key === editorKey ? feedback.message : "";
  const editorError = feedback.key === editorKey ? feedback.error : "";
  const currentEditorFile = editorFile?.key === editorKey ? editorFile.value : null;
  const editorUrl = `/api/editor?${new URLSearchParams({ snapshot: snapshotId, node: node?.id ?? "" })}`;
  useEffect(() => {
    if (!node || !enabled) return;
    let disposed = false;
    request<EditorFileState>(editorUrl)
      .then((value) => {
        if (!disposed) setEditorFile({ key: editorKey, value });
      })
      .catch((error: Error) => {
        if (!disposed)
          setEditorFile({
            key: editorKey,
            value: {
              available: false,
              path: node?.newPath ?? node?.oldPath ?? "",
              differs: false,
              reason: error.message,
            },
          });
      });
    return () => {
      disposed = true;
    };
  }, [editorKey, editorUrl, node?.newPath, node?.oldPath, enabled]);
  async function openInEditor() {
    if (!currentEditorFile?.available || editorBusy) return;
    setBusyKey(editorKey);
    setFeedback({ key: editorKey, message: "", error: "" });
    try {
      await request(editorUrl, "POST");
      if (activeKey.current !== editorKey) return;
      setFeedback({
        key: editorKey,
        error: "",
        message:
          "Opened in editor. If it uses a terminal, switch to the terminal running changemap.",
      });
    } catch (error) {
      if (activeKey.current !== editorKey) return;
      setFeedback({
        key: editorKey,
        message: "",
        error: error instanceof Error ? error.message : String(error),
      });
      try {
        const value = await request<EditorFileState>(editorUrl);
        if (activeKey.current === editorKey) setEditorFile({ key: editorKey, value });
      } catch {
        // The POST error is the useful message; another availability check can wait.
      }
    } finally {
      setBusyKey((current) => (current === editorKey ? null : current));
    }
  }
  return { currentEditorFile, editorBusy, editorMessage, editorError, openInEditor };
}

export type EditorActions = ReturnType<typeof useEditorFile>;
