#!/usr/bin/env node
import metadata from "../../package.json" with { type: "json" };

const args = process.argv.slice(2);

if (args.length === 1 && args[0] === "--help") {
  console.log(`changemap — understand code changes through file dependency maps.

Usage:
  changemap --help
  changemap --version

Options:
  --help       Show this help
  --version    Show the package version

Review commands and the local server are not implemented yet.`);
} else if (args.length === 1 && args[0] === "--version") {
  console.log(metadata.version);
} else {
  console.error(
    "changemap: review commands and other arguments are not supported yet. Use --help or --version.",
  );
  process.exitCode = 1;
}
