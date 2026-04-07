import { spawn, spawnSync } from "node:child_process";

const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const baseUrl = process.env.E2E_WEB_BASE_URL ?? "http://127.0.0.1:3000";
const parsedBaseUrl = new URL(baseUrl);
const hostname = parsedBaseUrl.hostname;
const port = parsedBaseUrl.port || (parsedBaseUrl.protocol === "https:" ? "443" : "80");
const cwd = process.cwd();

function runPnpm(args) {
  return spawnSync(pnpmBin, args, {
    cwd,
    env: process.env,
    shell: process.platform === "win32",
    stdio: "inherit"
  });
}

const buildResult = runPnpm(["exec", "next", "build"]);

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

const child = spawn(pnpmBin, ["exec", "next", "start", "--hostname", hostname, "--port", port], {
  cwd,
  env: process.env,
  shell: process.platform === "win32",
  stdio: "inherit"
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
