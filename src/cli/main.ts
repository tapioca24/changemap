#!/usr/bin/env node
import metadata from "../../package.json" with { type: "json" };
import { findRepository } from "../git/input.js";
import { SnapshotSource } from "../git/snapshot.js";
import { ReviewSession } from "../review/session.js";
import { startServer, type LocalServer } from "../server/server.js";
import { openBrowser } from "./browser.js";
import { parseOptions } from "./options.js";

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.command === "help") {
    console.log(`changemap — understand code changes through file dependency maps.

Usage:
  changemap [target] [compare-with] [--no-open] [--port <number>] [--editor <command>]
  changemap . | staged | working
  changemap --help
  changemap --version

Comparisons:
  (default), @   HEAD against its first parent
  <target>       Commit or branch tip against its first parent
  <target> <compare-with>
                 Second revision (before) to first revision (after), directly
  .              HEAD to working tree, including non-ignored untracked files
  staged         HEAD to index
  working        Index to working tree, including non-ignored untracked files

Options:
  --no-open      Print the URL without opening a browser
  --port <n>     Listen on this port; default 0 selects a free port
  --editor <cmd> Open files with this editor; defaults to VISUAL, then EDITOR
  -h, --help     Show this help
  -v, --version  Show the package version

The server listens on 127.0.0.1. Press Ctrl+C to stop it.
Changes are captured until you explicitly refresh. Dependency graphs are planned.`);
    return;
  }
  if (options.command === "version") {
    console.log(metadata.version);
    return;
  }
  const repository = await findRepository(process.cwd());
  let server: LocalServer | undefined;
  let session: ReviewSession | undefined;
  let stopping = false;
  const stop = () => {
    stopping = true;
    void server?.close().catch((error: unknown) => {
      console.error(`changemap: ${String(error)}`);
      process.exitCode = 1;
    });
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    session = await ReviewSession.create(new SnapshotSource(repository, options.input));
    if (stopping) {
      await session.stop();
      return;
    }
    server = await startServer(session, { port: options.port, editor: options.editor });
    if (stopping) {
      await server.close();
      return;
    }
    console.log(
      `changemap: ${server.url}\nPress Ctrl+C to stop. Changes appear after explicit refresh.`,
    );
    if (options.open) {
      try {
        await openBrowser(server.url);
      } catch (error) {
        console.error(
          `changemap: Could not open the browser (${String(error)}). Open ${server.url} manually.`,
        );
      }
    }
  } catch (error) {
    await session?.stop();
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    throw error;
  }
}

main().catch((error: unknown) => {
  console.error(`changemap: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
