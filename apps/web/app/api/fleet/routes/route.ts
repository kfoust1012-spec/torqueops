import { NextResponse } from "next/server";

import { fetchTomTomRoute, type FleetTomTomWaypoint } from "../../../../lib/fleet/tomtom";
import { getTomTomApiKey } from "../../../../lib/server-env";

type FleetRouteRequestBody = {
  trafficEnabled?: boolean;
  waypoints?: FleetTomTomWaypoint[];
};

function isValidWaypoint(value: unknown): value is FleetTomTomWaypoint {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.latitude === "number" &&
    Number.isFinite(candidate.latitude) &&
    candidate.latitude >= -90 &&
    candidate.latitude <= 90 &&
    typeof candidate.longitude === "number" &&
    Number.isFinite(candidate.longitude) &&
    candidate.longitude >= -180 &&
    candidate.longitude <= 180
  );
}

export async function POST(request: Request) {
  const apiKey = getTomTomApiKey();

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "TomTom API key is not configured."
      },
      { status: 503 }
    );
  }

  const payload = (await request.json()) as FleetRouteRequestBody;
  const trafficEnabled = payload.trafficEnabled ?? true;
  const waypoints = Array.isArray(payload.waypoints) ? payload.waypoints : [];

  if (waypoints.length < 2 || waypoints.length > 25 || !waypoints.every(isValidWaypoint)) {
    return NextResponse.json(
      {
        error: "Provide between 2 and 25 valid latitude/longitude waypoints."
      },
      { status: 400 }
    );
  }

  try {
    const route = await fetchTomTomRoute({
      apiKey,
      trafficEnabled,
      waypoints
    });

    return NextResponse.json(route, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to calculate the route.";

    return NextResponse.json(
      {
        error: message
      },
      { status: 502 }
    );
  }
}
