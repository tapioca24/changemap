import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export async function launchCli(cwd: string, args: string[]) {
  const executable = fileURLToPath(new URL("../../dist/cli.mjs", import.meta.url));
  const child = spawn(process.execPath, [executable, ...args], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) =>
    child.once("exit", (code, signal) => resolve({ code, signal })),
  );
  child.stderr.on("data", (data) => {
    stderr += data.toString();
  });
  const url = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`CLI startup timed out: ${stdout}\n${stderr}`));
    }, 15000);
    child.stdout.on("data", (data) => {
      stdout += data.toString();
      const match = stdout.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", () => {
      clearTimeout(timer);
      reject(new Error(`CLI exited before listening: ${stderr}`));
    });
  });
  return {
    url,
    async stop(signal: NodeJS.Signals = "SIGTERM") {
      child.kill(signal);
      const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
      try {
        return await exited;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
