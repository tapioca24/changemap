import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL("./src/ui/", import.meta.url)),
  worker: { format: "es" },
  build: {
    outDir: fileURLToPath(new URL("./dist/ui/", import.meta.url)),
    emptyOutDir: true,
    license: true,
  },
});
