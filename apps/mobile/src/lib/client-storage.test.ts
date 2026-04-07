import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const secureStoreMock = vi.hoisted(() => ({
  deleteItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn()
}));
const platformMock = vi.hoisted(() => ({
  OS: "web"
}));

vi.mock("./native-secure-store", () => secureStoreMock);
vi.mock("./platform-os", () => ({
  platformOS: platformMock.OS
}));

describe("client storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    platformMock.OS = "web";
    vi.doMock("./native-secure-store", () => secureStoreMock);
    vi.doMock("./platform-os", () => ({
      platformOS: platformMock.OS
    }));
    delete (globalThis as { window?: unknown }).window;
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("uses browser local storage on web when available", async () => {
    const localStorage = {
      getItem: vi.fn((key: string) => (key === "token" ? "stored-token" : null)),
      removeItem: vi.fn(),
      setItem: vi.fn()
    };

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage }
    });

    const { clientStorage } = await import("./client-storage");

    await clientStorage.setItem("token", "stored-token");
    await expect(clientStorage.getItem("token")).resolves.toBe("stored-token");
    await clientStorage.removeItem("token");

    expect(localStorage.setItem).toHaveBeenCalledWith("token", "stored-token");
    expect(localStorage.getItem).toHaveBeenCalledWith("token");
    expect(localStorage.removeItem).toHaveBeenCalledWith("token");
    expect(secureStoreMock.setItemAsync).not.toHaveBeenCalled();
    expect(secureStoreMock.getItemAsync).not.toHaveBeenCalled();
    expect(secureStoreMock.deleteItemAsync).not.toHaveBeenCalled();
  });

  it("falls back to in-memory storage when web local storage is unavailable", async () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: undefined
    });

    const { clientStorage } = await import("./client-storage");

    await clientStorage.setItem("draft", "queued");
    await expect(clientStorage.getItem("draft")).resolves.toBe("queued");
    await clientStorage.removeItem("draft");
    await expect(clientStorage.getItem("draft")).resolves.toBeNull();

    expect(secureStoreMock.setItemAsync).not.toHaveBeenCalled();
    expect(secureStoreMock.getItemAsync).not.toHaveBeenCalled();
    expect(secureStoreMock.deleteItemAsync).not.toHaveBeenCalled();
  });

  it("normalizes native secure storage keys before calling SecureStore", async () => {
    platformMock.OS = "android";

    const { clientStorage } = await import("./client-storage");

    await clientStorage.setItem("mobile-stop-console-recovery:job/123", "queued");
    await clientStorage.getItem("mobile-stop-console-recovery:job/123");
    await clientStorage.removeItem("mobile-stop-console-recovery:job/123");

    expect(secureStoreMock.setItemAsync).toHaveBeenCalledWith(
      "mobile-stop-console-recovery_job_123",
      "queued"
    );
    expect(secureStoreMock.getItemAsync).toHaveBeenCalledWith(
      "mobile-stop-console-recovery_job_123"
    );
    expect(secureStoreMock.deleteItemAsync).toHaveBeenCalledWith(
      "mobile-stop-console-recovery_job_123"
    );
  });
});
