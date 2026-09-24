import { createCssVariablesTheme, createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import type { CodeLanguage } from "./code-language.js";

export interface CodeToken {
  content: string;
  color?: string;
  fontStyle?: number;
}

export type TokenLines = CodeToken[][];

const languages = {
  typescript: () => import("@shikijs/langs/typescript"),
  tsx: () => import("@shikijs/langs/tsx"),
  javascript: () => import("@shikijs/langs/javascript"),
  jsx: () => import("@shikijs/langs/jsx"),
  json: () => import("@shikijs/langs/json"),
  css: () => import("@shikijs/langs/css"),
  html: () => import("@shikijs/langs/html"),
  markdown: () => import("@shikijs/langs/markdown"),
  python: () => import("@shikijs/langs/python"),
  go: () => import("@shikijs/langs/go"),
  rust: () => import("@shikijs/langs/rust"),
  java: () => import("@shikijs/langs/java"),
  c: () => import("@shikijs/langs/c"),
  cpp: () => import("@shikijs/langs/cpp"),
  csharp: () => import("@shikijs/langs/csharp"),
  ruby: () => import("@shikijs/langs/ruby"),
  php: () => import("@shikijs/langs/php"),
  shellscript: () => import("@shikijs/langs/shellscript"),
  sql: () => import("@shikijs/langs/sql"),
  yaml: () => import("@shikijs/langs/yaml"),
  toml: () => import("@shikijs/langs/toml"),
  xml: () => import("@shikijs/langs/xml"),
  dockerfile: () => import("@shikijs/langs/dockerfile"),
} satisfies Record<CodeLanguage, () => Promise<{ default: unknown }>>;

const theme = createCssVariablesTheme({ name: "changemap", variablePrefix: "--shiki-" });
const highlighterPromise = createHighlighterCore({
  themes: [theme],
  langs: [],
  engine: createJavaScriptRegexEngine(),
});
const loading = new Map<CodeLanguage, Promise<void>>();

export async function highlightSource(
  content: string,
  language: CodeLanguage,
): Promise<TokenLines> {
  const highlighter = await highlighterPromise;
  let languageReady = loading.get(language);
  if (!languageReady) {
    languageReady = languages[language]().then(async (grammar) => {
      await highlighter.loadLanguage(...grammar.default);
    });
    loading.set(language, languageReady);
  }
  await languageReady;
  return highlighter
    .codeToTokensBase(content, { lang: language, theme: "changemap" })
    .map((line) => line.map(({ content, color, fontStyle }) => ({ content, color, fontStyle })));
}
