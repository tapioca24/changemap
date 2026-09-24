import type { CodeLanguage } from "./code-language.js";
import type { TokenLines } from "./highlight-engine.js";

// Keeps token arrays and worker messages bounded for unusually large captured files.
export const MAX_HIGHLIGHT_CHARACTERS = 300_000;
export const MAX_HIGHLIGHT_LINES = 5_000;

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { resolve(value: TokenLines): void; reject(error: Error): void }>();

function stopWorker(error: Error) {
  worker?.terminate();
  worker = null;
  for (const request of pending.values()) request.reject(error);
  pending.clear();
}

export function highlightFile(content: string, language: CodeLanguage): Promise<TokenLines> {
  if (content.length > MAX_HIGHLIGHT_CHARACTERS)
    return Promise.reject(new Error("File is too large for syntax highlighting."));
  if (content.split("\n").length > MAX_HIGHLIGHT_LINES)
    return Promise.reject(new Error("File has too many lines for syntax highlighting."));
  if (!worker) {
    try {
      worker = new Worker(new URL("./highlight-worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (
        event: MessageEvent<{ id: number; tokens?: TokenLines; error?: string }>,
      ) => {
        const { id, tokens, error } = event.data;
        const request = pending.get(id);
        if (!request) return;
        pending.delete(id);
        if (error) request.reject(new Error(error));
        else if (tokens) request.resolve(tokens);
        else request.reject(new Error("Syntax highlighting returned no tokens."));
      };
      worker.onerror = () => stopWorker(new Error("Syntax highlighting worker failed."));
      worker.onmessageerror = () =>
        stopWorker(new Error("Syntax highlighting response was invalid."));
    } catch (error) {
      return Promise.reject(error);
    }
  }
  return new Promise<TokenLines>((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    try {
      worker!.postMessage({ id, content, language });
    } catch (error) {
      pending.delete(id);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
