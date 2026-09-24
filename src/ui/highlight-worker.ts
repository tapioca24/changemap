import { highlightSource } from "./highlight-engine.js";
import type { CodeLanguage } from "./code-language.js";

self.onmessage = async (
  event: MessageEvent<{ id: number; content: string; language: CodeLanguage }>,
) => {
  const { id, content, language } = event.data;
  try {
    self.postMessage({ id, tokens: await highlightSource(content, language) });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
