import net from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { assertPortsAvailable } from "./local-port-guard.mjs";

const servers = [];

async function listenOnRandomPort() {
  const server = net.createServer();

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  servers.push(server);
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected a numeric port from the test server.");
  }

  return address.port;
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        })
    )
  );
});

describe("assertPortsAvailable", () => {
  it("passes when required ports are free", async () => {
    await expect(
      assertPortsAvailable([
        {
          baseUrl: "http://127.0.0.1:65531",
          envName: "TEST_URL",
          port: 65531,
          purpose: "free test port"
        }
      ])
    ).resolves.toBeUndefined();
  });

  it("fails with a clear occupied-port diagnostic", async () => {
    const busyPort = await listenOnRandomPort();

    const error = await assertPortsAvailable(
      [
        {
          baseUrl: `http://127.0.0.1:${busyPort}`,
          envName: "TEST_URL",
          port: busyPort,
          purpose: "busy test port"
        }
      ],
      {
        contextLabel: "Port guard test"
      }
    ).catch((caughtError) => caughtError);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("Port guard test failed because required local ports are already in use.");
    expect(error.message).toContain(`Port ${busyPort} for busy test port (TEST_URL=http://127.0.0.1:${busyPort})`);
  });
});
