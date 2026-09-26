import { mkdir, copyFile } from "node:fs/promises";

const target = new URL("../dist/go-helper/", import.meta.url);
await mkdir(target, { recursive: true });
await copyFile(
  new URL("../src/analysis/go-helper/main.go", import.meta.url),
  new URL("main.go", target),
);
