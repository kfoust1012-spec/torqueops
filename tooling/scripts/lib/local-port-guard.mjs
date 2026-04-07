import { execFileSync } from "node:child_process";
import net from "node:net";

const defaultWebBaseUrl = "http://127.0.0.1:3000";
const defaultMobileBaseUrl = "http://127.0.0.1:19006";

function parsePortFromBaseUrl(baseUrl, fallbackPort) {
  const url = new URL(baseUrl);
  return Number(url.port || fallbackPort);
}

function normalizeListenerRecords(records) {
  if (!records) {
    return [];
  }

  return Array.isArray(records) ? records : [records];
}

function getWindowsProcessInfo(pid) {
  try {
    const output = execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        [
          `$process = Get-Process -Id ${pid} -ErrorAction SilentlyContinue`,
          "if (-not $process) { return }",
          "[PSCustomObject]@{",
          "  pid = $process.Id",
          "  processName = $process.ProcessName",
          "  path = $process.Path",
          "} | ConvertTo-Json -Compress -Depth 2"
        ].join("; ")
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      }
    ).trim();

    if (!output) {
      return null;
    }

    return JSON.parse(output);
  } catch {
    return null;
  }
}

function getWindowsNetstatListeners(port) {
  const output = execFileSync("netstat", ["-ano", "-p", "tcp"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  const listeners = [];

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s*TCP\s+(\S+):(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i);

    if (!match) {
      continue;
    }

    const [, localAddress, localPortText, pidText] = match;
    const localPort = Number.parseInt(localPortText, 10);

    if (localPort !== port) {
      continue;
    }

    const pid = Number.parseInt(pidText, 10);
    const processInfo = getWindowsProcessInfo(pid);

    listeners.push({
      localAddress,
      localPort,
      path: processInfo?.path ?? null,
      pid,
      processName: processInfo?.processName ?? null
    });
  }

  return listeners;
}

function getWindowsPortListeners(port) {
  try {
    const script = [
      `$connections = Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue`,
      "if (-not $connections) { return }",
      "$connections | ForEach-Object {",
      "  $process = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue",
      "  [PSCustomObject]@{",
      "    localAddress = $_.LocalAddress",
      "    localPort = $_.LocalPort",
      "    pid = $_.OwningProcess",
      "    processName = $process.ProcessName",
      "    path = $process.Path",
      "  }",
      "} | ConvertTo-Json -Compress -Depth 3"
    ].join("; ");

    const output = execFileSync("powershell", ["-NoProfile", "-Command", script], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();

    if (output) {
      return normalizeListenerRecords(JSON.parse(output));
    }
  } catch {
    // Fall back to netstat below.
  }

  return getWindowsNetstatListeners(port);
}

function parseLsofOutput(output) {
  const listeners = [];
  let current = null;

  for (const line of output.split(/\r?\n/)) {
    if (!line) {
      continue;
    }

    const prefix = line[0];
    const value = line.slice(1);

    if (prefix === "p") {
      if (current) {
        listeners.push(current);
      }

      current = {
        pid: Number.parseInt(value, 10) || null
      };
      continue;
    }

    if (!current) {
      continue;
    }

    if (prefix === "c") {
      current.processName = value;
    } else if (prefix === "n") {
      current.endpoint = value;
    }
  }

  if (current) {
    listeners.push(current);
  }

  return listeners;
}

function parseSsOutput(output, port) {
  const listeners = [];

  for (const line of output.split(/\r?\n/)) {
    if (!line.includes(`:${port}`)) {
      continue;
    }

    const pidMatch = line.match(/pid=(\d+)/i);
    const processMatch = line.match(/users:\(\("([^"]+)"/i);
    const endpointMatch = line.match(/\s(\S+:\d+)\s+\S+\s*users:/i);

    listeners.push({
      endpoint: endpointMatch?.[1] ?? null,
      pid: pidMatch ? Number.parseInt(pidMatch[1], 10) : null,
      processName: processMatch?.[1] ?? null
    });
  }

  return listeners;
}

function getUnixPortListeners(port) {
  try {
    const lsofOutput = execFileSync("lsof", [`-nP`, `-iTCP:${port}`, "-sTCP:LISTEN", "-Fpcn"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();

    if (!lsofOutput) {
      return [];
    }

    return parseLsofOutput(lsofOutput);
  } catch (error) {
    const stderr = error?.stderr ? String(error.stderr) : "";

    if (error?.status !== 1 && !/not found|cannot find/i.test(stderr)) {
      throw error;
    }
  }

  try {
    const ssOutput = execFileSync("ss", ["-ltnp"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();

    if (!ssOutput) {
      return [];
    }

    return parseSsOutput(ssOutput, port);
  } catch (error) {
    const stderr = error?.stderr ? String(error.stderr) : "";

    if (!/not found|cannot find/i.test(stderr)) {
      throw error;
    }
  }

  return [];
}

async function canListenOnHost(port, host) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", (error) => {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error.code === "EAFNOSUPPORT" || error.code === "EADDRNOTAVAIL")
      ) {
        resolve(true);
        return;
      }

      if (error && typeof error === "object" && "code" in error && error.code === "EADDRINUSE") {
        resolve(false);
        return;
      }

      reject(error);
    });

    server.once("listening", () => {
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        resolve(true);
      });
    });

    server.listen({
      host,
      port,
      exclusive: true
    });
  });
}

async function isPortOpen(port) {
  for (const host of ["127.0.0.1", "::1"]) {
    const canListen = await canListenOnHost(port, host);

    if (!canListen) {
      return true;
    }
  }

  return false;
}

export async function inspectPort(port) {
  let listeners = [];

  try {
    if (process.platform === "win32") {
      listeners = getWindowsPortListeners(port);
    } else {
      listeners = getUnixPortListeners(port);
    }
  } catch {
    listeners = [];
  }

  if (listeners.length > 0) {
    return {
      occupied: true,
      listeners
    };
  }

  return {
    occupied: await isPortOpen(port),
    listeners: []
  };
}

export function formatListener(listener) {
  const parts = [];

  if (listener.processName) {
    parts.push(listener.processName);
  }

  if (listener.pid) {
    parts.push(`pid ${listener.pid}`);
  }

  if (listener.localAddress && listener.localPort) {
    parts.push(`${listener.localAddress}:${listener.localPort}`);
  } else if (listener.endpoint) {
    parts.push(listener.endpoint);
  } else if (listener.path) {
    parts.push(listener.path);
  }

  return parts.length > 0 ? parts.join(", ") : "occupied by another local process";
}

export function getLocalE2ePortChecks() {
  const webBaseUrl = process.env.E2E_WEB_BASE_URL ?? defaultWebBaseUrl;
  const mobileBaseUrl = process.env.E2E_MOBILE_BASE_URL ?? defaultMobileBaseUrl;

  return [
    {
      baseUrl: webBaseUrl,
      envName: "E2E_WEB_BASE_URL",
      port: parsePortFromBaseUrl(webBaseUrl, 3000),
      purpose: "office web server"
    },
    {
      baseUrl: mobileBaseUrl,
      envName: "E2E_MOBILE_BASE_URL",
      port: parsePortFromBaseUrl(mobileBaseUrl, 19006),
      purpose: "Expo web server"
    }
  ];
}

export async function inspectPortChecks(portChecks) {
  const occupied = [];

  for (const portCheck of portChecks) {
    const result = await inspectPort(portCheck.port);

    if (!result.occupied) {
      continue;
    }

    occupied.push({
      ...portCheck,
      listeners: result.listeners
    });
  }

  return occupied;
}

export async function assertPortsAvailable(portChecks, options = {}) {
  const { contextLabel = "Local e2e preflight" } = options;
  const occupied = await inspectPortChecks(portChecks);

  if (occupied.length === 0) {
    return;
  }

  const lines = [
    `${contextLabel} failed because required local ports are already in use.`,
    "Stop the listed process or change the corresponding e2e base-url env var before rerunning."
  ];

  for (const portCheck of occupied) {
    const ownerSummary =
      portCheck.listeners.length > 0
        ? portCheck.listeners.map((listener) => formatListener(listener)).join("; ")
        : "occupied by another local process";

    lines.push(
      `- Port ${portCheck.port} for ${portCheck.purpose} (${portCheck.envName}=${portCheck.baseUrl}): ${ownerSummary}`
    );
  }

  throw new Error(lines.join("\n"));
}

export async function assertLocalE2ePortsAvailable() {
  const portChecks = getLocalE2ePortChecks();
  await assertPortsAvailable(portChecks, {
    contextLabel: "Local e2e port preflight"
  });
}
