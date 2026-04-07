export type FleetTomTomWaypoint = {
  latitude: number;
  longitude: number;
};

export type FleetTomTomGeocodeInput = {
  city: string;
  country?: string | null;
  line1: string;
  line2?: string | null;
  postalCode: string;
  state: string;
};

export type FleetTomTomGeocodeResult = {
  latitude: number;
  longitude: number;
};

export type FleetTomTomRoute = {
  coordinates: Array<[number, number]>;
  distanceMeters: number;
  trafficDelaySeconds: number;
  travelTimeSeconds: number;
};

type TomTomRouteApiResponse = {
  routes?: Array<{
    legs?: Array<{
      points?: Array<{
        latitude: number;
        longitude: number;
      }>;
    }>;
    summary?: {
      lengthInMeters?: number;
      trafficDelayInSeconds?: number;
      travelTimeInSeconds?: number;
    };
  }>;
};

type TomTomGeocodeApiResponse = {
  results?: Array<{
    position?: {
      lat?: number;
      lon?: number;
    };
  }>;
};

function buildRoutePath(waypoints: FleetTomTomWaypoint[]) {
  return waypoints
    .map((waypoint) => `${waypoint.longitude},${waypoint.latitude}`)
    .join(":");
}

function buildAddressQuery(input: FleetTomTomGeocodeInput) {
  return [input.line1, input.line2, `${input.city}, ${input.state} ${input.postalCode}`, input.country]
    .filter(Boolean)
    .join(", ");
}

function dedupeCoordinates(coordinates: Array<[number, number]>) {
  return coordinates.filter((coordinate, index) => {
    if (index === 0) {
      return true;
    }

    const previous = coordinates[index - 1];
    return previous?.[0] !== coordinate[0] || previous?.[1] !== coordinate[1];
  });
}

async function fetchTomTomJson<T>(input: { timeoutMs: number; url: string }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await fetch(input.url, {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`TomTom request failed with status ${response.status}.`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("TomTom request timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchTomTomRoute({
  apiKey,
  trafficEnabled,
  waypoints
}: {
  apiKey: string;
  trafficEnabled: boolean;
  waypoints: FleetTomTomWaypoint[];
}): Promise<FleetTomTomRoute> {
  if (waypoints.length < 2) {
    throw new Error("At least two waypoints are required to calculate a route.");
  }

  const routePath = buildRoutePath(waypoints);
  const searchParams = new URLSearchParams({
    computeTravelTimeFor: "all",
    key: apiKey,
    routeRepresentation: "polyline",
    routeType: "fastest",
    sectionType: "traffic",
    traffic: trafficEnabled ? "true" : "false",
    travelMode: "car"
  });

  const payload = await fetchTomTomJson<TomTomRouteApiResponse>({
    timeoutMs: 6000,
    url: `https://api.tomtom.com/routing/1/calculateRoute/${routePath}/json?${searchParams.toString()}`
  });
  const route = payload.routes?.[0];

  if (!route?.legs?.length) {
    throw new Error("TomTom route response did not include any route legs.");
  }

  const coordinates = dedupeCoordinates(
    route.legs.flatMap((leg) =>
      (leg.points ?? []).map((point) => [point.longitude, point.latitude] as [number, number])
    )
  );

  return {
    coordinates,
    distanceMeters: route.summary?.lengthInMeters ?? 0,
    trafficDelaySeconds: route.summary?.trafficDelayInSeconds ?? 0,
    travelTimeSeconds: route.summary?.travelTimeInSeconds ?? 0
  };
}

export async function geocodeTomTomAddress({
  address,
  apiKey
}: {
  address: FleetTomTomGeocodeInput;
  apiKey: string;
}): Promise<FleetTomTomGeocodeResult | null> {
  const query = encodeURIComponent(buildAddressQuery(address));
  const searchParams = new URLSearchParams({
    countrySet: "US",
    key: apiKey,
    limit: "1"
  });
  const payload = await fetchTomTomJson<TomTomGeocodeApiResponse>({
    timeoutMs: 2500,
    url: `https://api.tomtom.com/search/2/geocode/${query}.json?${searchParams.toString()}`
  });
  const position = payload.results?.[0]?.position;

  if (
    !position ||
    typeof position.lat !== "number" ||
    !Number.isFinite(position.lat) ||
    typeof position.lon !== "number" ||
    !Number.isFinite(position.lon)
  ) {
    return null;
  }

  return {
    latitude: position.lat,
    longitude: position.lon
  };
}
