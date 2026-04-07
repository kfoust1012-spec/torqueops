import { beforeEach, describe, expect, it, vi } from "vitest";

const platformMock = vi.hoisted(() => ({
  OS: "web"
}));
const locationMock = vi.hoisted(() => ({
  Accuracy: {
    Balanced: "balanced"
  },
  ActivityType: {
    AutomotiveNavigation: "automotive"
  },
  PermissionStatus: {
    GRANTED: "granted"
  },
  getBackgroundPermissionsAsync: vi.fn(),
  getCurrentPositionAsync: vi.fn(),
  getForegroundPermissionsAsync: vi.fn(),
  hasServicesEnabledAsync: vi.fn(),
  hasStartedLocationUpdatesAsync: vi.fn(),
  requestBackgroundPermissionsAsync: vi.fn(),
  requestForegroundPermissionsAsync: vi.fn(),
  startLocationUpdatesAsync: vi.fn(),
  stopLocationUpdatesAsync: vi.fn()
}));
const clientStorageMock = vi.hoisted(() => ({
  getItem: vi.fn(),
  removeItem: vi.fn(),
  setItem: vi.fn()
}));
const loadWorkdayTrackingPolicyMock = vi.hoisted(() => vi.fn());

vi.mock("expo-location", () => locationMock);

vi.mock("../../lib/platform-os", () => ({
  platformOS: platformMock.OS
}));

vi.mock("../../lib/client-storage", () => ({
  clientStorage: clientStorageMock
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn()
    },
    from: vi.fn()
  }
}));

vi.mock("./offline-location-ping-queue", () => ({
  clearQueuedLocationPings: vi.fn(),
  enqueueLocationPing: vi.fn(),
  flushQueuedLocationPings: vi.fn()
}));

vi.mock("./workday-location-policy", () => ({
  loadWorkdayTrackingPolicy: loadWorkdayTrackingPolicyMock
}));

const mobileAppContext = {
  company: {
    timezone: "America/Chicago"
  },
  companyId: "company-1",
  membership: {},
  profile: {},
  userId: "user-1"
} as any;

describe("workday location service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    platformMock.OS = "web";
    loadWorkdayTrackingPolicyMock.mockResolvedValue({
      blockingBlock: null,
      companyTimeZone: "America/Chicago",
      localDate: "2026-03-27",
      shouldAutoStartNow: false,
      shouldStopRunningNow: false,
      shouldTrackNow: false,
      workdayEndsAt: null,
      workdayStartsAt: null
    });
  });

  it("rejects background tracking on the web preview before loading schedule policy", async () => {
    const { startWorkdayLocationTracking } = await import("./workday-location-service");

    await expect(startWorkdayLocationTracking(mobileAppContext)).rejects.toThrow(
      "Workday location tracking is not supported in the web preview."
    );
    expect(loadWorkdayTrackingPolicyMock).not.toHaveBeenCalled();
    expect(locationMock.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it("treats schedule sync as a no-op on the web preview", async () => {
    const { syncWorkdayLocationTrackingWithSchedule } = await import(
      "./workday-location-service"
    );

    await expect(syncWorkdayLocationTrackingWithSchedule(mobileAppContext)).resolves.toEqual({
      action: "unchanged",
      policy: {
        blockingBlock: null,
        companyTimeZone: "America/Chicago",
        localDate: "2026-03-27",
        shouldAutoStartNow: false,
        shouldStopRunningNow: false,
        shouldTrackNow: false,
        workdayEndsAt: null,
        workdayStartsAt: null
      }
    });
    expect(loadWorkdayTrackingPolicyMock).toHaveBeenCalledWith(mobileAppContext);
    expect(locationMock.hasStartedLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(locationMock.stopLocationUpdatesAsync).not.toHaveBeenCalled();
  });
});
