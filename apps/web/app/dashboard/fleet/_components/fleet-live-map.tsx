"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { GeoJSONSource, LngLatBounds, type StyleSpecification } from "maplibre-gl";

import { EmptyState, cx } from "../../../../components/ui";
import { webEnv } from "../../../../lib/env";
import {
  findLiveDeviceForTechnicianId,
  getLiveDevicePoint,
  type FleetLiveDevice,
  type FleetLiveTrackPoint
} from "./fleet-live-tracking";
import {
  type FleetCrewReadinessPacket,
  formatFleetMinutes,
  getFleetOperationalStatusLabel,
  type FleetMapPoint,
  type FleetRouteMetrics,
  type FleetStopView,
  type FleetTechnicianView
} from "./fleet-types";

type FleetLiveMapProps = {
  focusNonce: number;
  liveDevices: FleetLiveDevice[];
  onRouteMetricsChange: (metrics: FleetRouteMetrics | null) => void;
  onSelectStop: (stopId: string) => void;
  onSelectTechnician: (technicianId: string) => void;
  queueJobs: FleetStopView[];
  readinessPacket: FleetCrewReadinessPacket | null;
  selectedStopId: string | null;
  selectedTechnicianId: string | null;
  technicians: FleetTechnicianView[];
  trafficEnabled: boolean;
};

type MapProvider = "osm" | "tomtom";

type RouteState = {
  coordinates: Array<[number, number]>;
  distanceMeters: number;
  source: "direct" | "tomtom";
  trafficDelaySeconds: number;
  travelTimeSeconds: number;
};

const CHICAGO_CENTER: [number, number] = [-87.6687, 41.8786];
const ALL_ROUTES_SOURCE_ID = "fleet-all-routes";
const SELECTED_ROUTE_SOURCE_ID = "fleet-selected-route";
const LIVE_TRACK_SOURCE_ID = "fleet-live-track";
const ALL_ROUTES_LAYER_ID = "fleet-all-routes-line";
const SELECTED_ROUTE_LAYER_ID = "fleet-selected-route-line";
const SELECTED_ROUTE_HALO_LAYER_ID = "fleet-selected-route-halo";
const LIVE_TRACK_LAYER_ID = "fleet-live-track-line";

function buildMapStyle({
  mapProvider,
  tomTomKey
}: {
  mapProvider: MapProvider;
  tomTomKey: string | null;
}): StyleSpecification {
  if (mapProvider === "osm") {
    return {
      version: 8 as const,
      sources: {
        "osm-base": {
          attribution: "© OpenStreetMap contributors",
          tileSize: 256,
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          type: "raster" as const
        }
      },
      layers: [
        {
          id: "osm-base",
          source: "osm-base",
          type: "raster" as const
        }
      ]
    };
  }

  return {
    version: 8 as const,
    sources: {
      "tomtom-base": {
        attribution: "© TomTom © OpenStreetMap contributors",
        tileSize: 256,
        tiles: [
          `https://api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.png?view=Unified&key=${tomTomKey}`
        ],
        type: "raster" as const
      },
      "tomtom-traffic": {
        attribution: "Traffic © TomTom",
        tileSize: 256,
        tiles: [
          `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${tomTomKey}`
        ],
        type: "raster" as const
      }
    },
    layers: [
      {
        id: "tomtom-base",
        source: "tomtom-base",
        type: "raster" as const
      },
      {
        id: "tomtom-traffic",
        layout: {
          visibility: "visible"
        },
        paint: {
          "raster-opacity": 0.78
        },
        source: "tomtom-traffic",
        type: "raster" as const
      }
    ]
  };
}

function getMapSourceId(value: unknown) {
  if (!value || typeof value !== "object" || !("sourceId" in value)) {
    return null;
  }

  return typeof value.sourceId === "string" ? value.sourceId : null;
}

function getMapErrorMessage(value: unknown) {
  if (!value || typeof value !== "object" || !("error" in value)) {
    return null;
  }

  const error = value.error;
  return error instanceof Error ? error.message : null;
}

function createEmptyFeatureCollection() {
  return {
    type: "FeatureCollection" as const,
    features: []
  };
}

function createLineFeatureCollection(
  lines: Array<{
    coordinates: Array<[number, number]>;
    properties?: Record<string, string | number | boolean | null>;
  }>
) {
  return {
    type: "FeatureCollection" as const,
    features: lines
      .filter((line) => line.coordinates.length >= 2)
      .map((line) => ({
        type: "Feature" as const,
        geometry: {
          type: "LineString" as const,
          coordinates: line.coordinates
        },
        properties: line.properties ?? {}
      }))
  };
}

function buildTrackFeature(points: FleetLiveTrackPoint[]) {
  return createLineFeatureCollection([
    {
      coordinates: points.map((point) => [point.longitude, point.latitude] as [number, number])
    }
  ]);
}

function toCoordinate(point: FleetMapPoint) {
  return [point.longitude, point.latitude] as [number, number];
}

function haversineMiles(start: FleetMapPoint, end: FleetMapPoint) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const latitudeDelta = toRadians(end.latitude - start.latitude);
  const longitudeDelta = toRadians(end.longitude - start.longitude);
  const startLatitude = toRadians(start.latitude);
  const endLatitude = toRadians(end.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(haversine));
}

function getTechnicianAnchorPoint(
  technician: FleetTechnicianView,
  liveDevices: FleetLiveDevice[]
) {
  return (
    getLiveDevicePoint(findLiveDeviceForTechnicianId(technician.id, liveDevices)) ??
    technician.currentStop?.coords ??
    technician.nextStop?.coords ??
    technician.routeStops.find((stop) => Boolean(stop.coords))?.coords ??
    null
  );
}

function getRouteWaypoints(technician: FleetTechnicianView, liveDevices: FleetLiveDevice[]) {
  const anchor = getTechnicianAnchorPoint(technician, liveDevices);
  const stopPoints = technician.routeStops
    .map((stop) => stop.coords)
    .filter((point): point is FleetMapPoint => Boolean(point));

  if (!anchor) {
    return stopPoints;
  }

  return [anchor, ...stopPoints];
}

function buildDirectRoute(points: FleetMapPoint[]): RouteState | null {
  if (points.length < 2) {
    return null;
  }

  const distanceMiles = points.slice(1).reduce((sum, point, index) => {
    return sum + haversineMiles(points[index] as FleetMapPoint, point);
  }, 0);
  const travelMinutes = Math.max(4, Math.round((distanceMiles / 28) * 60));

  return {
    coordinates: points.map(toCoordinate),
    distanceMeters: Math.round(distanceMiles * 1609.34),
    source: "direct",
    trafficDelaySeconds: 0,
    travelTimeSeconds: travelMinutes * 60
  };
}

function createTechnicianMarkerElement({
  isSelected,
  onSelect,
  technician
}: {
  isSelected: boolean;
  onSelect: () => void;
  technician: FleetTechnicianView;
}) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = cx(
    "fleet-live-map__tech-marker",
    `fleet-live-map__tech-marker--${technician.status}`,
    isSelected && "fleet-live-map__tech-marker--selected"
  );
  element.setAttribute(
    "aria-label",
    `${technician.name}, ${technician.vehicleUnit ?? "company vehicle"}, ${getFleetOperationalStatusLabel(
      technician.status
    )}`
  );
  element.innerHTML = `
    <span class="fleet-live-map__tech-core">${technician.initials}</span>
    <span class="fleet-live-map__tech-copy">
      <strong>${technician.vehicleUnit ?? "Unit"}</strong>
      <span>${technician.name}</span>
    </span>
  `;
  element.addEventListener("click", onSelect);

  return element;
}

function createStopMarkerElement({
  isSelected,
  onSelect,
  stop,
  stopIndex
}: {
  isSelected: boolean;
  onSelect: () => void;
  stop: FleetStopView;
  stopIndex: number;
}) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = cx(
    "fleet-live-map__stop-marker",
    isSelected && "fleet-live-map__stop-marker--selected"
  );
  element.setAttribute("aria-label", `${stop.customerName}, ${stop.title}`);
  element.innerHTML = `
    <span class="fleet-live-map__stop-index">${stopIndex + 1}</span>
    <span class="fleet-live-map__stop-copy">${stop.windowLabel ?? "Stop"}</span>
  `;
  element.addEventListener("click", onSelect);

  return element;
}

function createQueueMarkerElement(stop: FleetStopView, onSelect: () => void) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "fleet-live-map__queue-marker";
  element.setAttribute("aria-label", `${stop.customerName}, waiting assignment`);
  element.innerHTML = `<span class="fleet-live-map__queue-dot"></span>`;
  element.addEventListener("click", onSelect);

  return element;
}

function createLiveDeviceMarkerElement(device: FleetLiveDevice) {
  const element = document.createElement("div");
  element.className = cx(
    "fleet-live-map__live-marker",
    device.isFresh && "fleet-live-map__live-marker--fresh",
    `fleet-live-map__live-marker--${device.trackingState}`
  );
  element.setAttribute("aria-label", `${device.name}, ${device.trackingSummary}`);
  element.innerHTML = `
    <span class="fleet-live-map__live-core">${device.initials}</span>
    <span class="fleet-live-map__live-copy">
      <strong>${device.name}</strong>
      <span>${device.trackingSummary}</span>
    </span>
  `;

  return element;
}

export function FleetLiveMap({
  focusNonce,
  liveDevices,
  onRouteMetricsChange,
  onSelectStop,
  onSelectTechnician,
  queueJobs,
  readinessPacket,
  selectedStopId,
  selectedTechnicianId,
  technicians,
  trafficEnabled
}: FleetLiveMapProps) {
  const tomTomKey = webEnv.NEXT_PUBLIC_TOMTOM_API_KEY ?? null;
  const defaultMapProvider: MapProvider = tomTomKey ? "tomtom" : "osm";
  const selectedTechnician =
    technicians.find((technician) => technician.id === selectedTechnicianId) ?? null;
  const selectedLiveDevice = selectedTechnician
    ? findLiveDeviceForTechnicianId(selectedTechnician.id, liveDevices)
    : null;
  const [mapProvider, setMapProvider] = useState<MapProvider>(defaultMapProvider);
  const [mapReady, setMapReady] = useState(false);
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteState | null>(() =>
    selectedTechnician ? buildDirectRoute(getRouteWaypoints(selectedTechnician, liveDevices)) : null
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const hasFitInitiallyRef = useRef(false);
  const lastSelectedTechnicianRef = useRef<string | null>(null);
  const lastFocusNonceRef = useRef(focusNonce);

  useEffect(() => {
    setMapProvider(defaultMapProvider);

    if (!tomTomKey) {
      setMapLoadError(null);
    }
  }, [defaultMapProvider, tomTomKey]);

  useEffect(() => {
    if (!mapProvider || !containerRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      attributionControl: false,
      center: CHICAGO_CENTER,
      container: containerRef.current,
      dragRotate: false,
      style: buildMapStyle({ mapProvider, tomTomKey }),
      zoom: 10
    });

    map.scrollZoom.enable();
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }));

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });

    resizeObserver.observe(containerRef.current);

    map.on("load", () => {
      setMapLoadError(null);
      map.addSource(ALL_ROUTES_SOURCE_ID, {
        data: createEmptyFeatureCollection(),
        type: "geojson"
      });
      map.addLayer({
        id: ALL_ROUTES_LAYER_ID,
        layout: {
          "line-cap": "round",
          "line-join": "round"
        },
        paint: {
          "line-color": [
            "match",
            ["get", "status"],
            "on_job",
            "#2ca46d",
            "delayed",
            "#d28a22",
            "offline",
            "#c5504a",
            "idle",
            "#8794aa",
            "#4d86ff"
          ],
          "line-opacity": 0.24,
          "line-width": 3
        },
        source: ALL_ROUTES_SOURCE_ID,
        type: "line"
      });
      map.addSource(SELECTED_ROUTE_SOURCE_ID, {
        data: createEmptyFeatureCollection(),
        type: "geojson"
      });
      map.addLayer({
        id: SELECTED_ROUTE_HALO_LAYER_ID,
        paint: {
          "line-color": "rgba(19, 42, 70, 0.18)",
          "line-width": 10
        },
        source: SELECTED_ROUTE_SOURCE_ID,
        type: "line"
      });
      map.addLayer({
        id: SELECTED_ROUTE_LAYER_ID,
        layout: {
          "line-cap": "round",
          "line-join": "round"
        },
        paint: {
          "line-color": "#1f4ca8",
          "line-width": 5
        },
        source: SELECTED_ROUTE_SOURCE_ID,
        type: "line"
      });
      map.addSource(LIVE_TRACK_SOURCE_ID, {
        data: createEmptyFeatureCollection(),
        type: "geojson"
      });
      map.addLayer({
        id: LIVE_TRACK_LAYER_ID,
        layout: {
          "line-cap": "round",
          "line-join": "round"
        },
        paint: {
          "line-color": "rgba(15, 84, 96, 0.56)",
          "line-dasharray": [1.2, 1.6],
          "line-opacity": 0.82,
          "line-width": 3
        },
        source: LIVE_TRACK_SOURCE_ID,
        type: "line"
      });
      setMapReady(true);
    });

    const handleMapError = (event: unknown) => {
      if (mapProvider !== "tomtom") {
        return;
      }

      const sourceId = getMapSourceId(event);

      if (sourceId !== "tomtom-base" && sourceId !== "tomtom-traffic") {
        return;
      }

      const errorMessage = getMapErrorMessage(event);
      setMapLoadError(
        errorMessage?.includes("403")
          ? "TomTom rejected the live tiles. Showing the basic basemap instead."
          : "TomTom tiles could not be loaded. Showing the basic basemap instead."
      );
      setMapProvider("osm");
    };

    map.on("error", handleMapError);
    mapRef.current = map;

    return () => {
      resizeObserver.disconnect();
      map.off("error", handleMapError);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      setMapReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, [mapProvider, tomTomKey]);

  useEffect(() => {
    const nextWaypoints = selectedTechnician ? getRouteWaypoints(selectedTechnician, liveDevices) : [];
    const fallbackRoute = buildDirectRoute(nextWaypoints);
    setRouteError(null);

    if (!selectedTechnician || nextWaypoints.length < 2) {
      setSelectedRoute(fallbackRoute);
      return;
    }

    if (!tomTomKey) {
      setSelectedRoute(fallbackRoute);
      return;
    }

    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch("/api/fleet/routes", {
          body: JSON.stringify({
            trafficEnabled,
            waypoints: nextWaypoints.map((point) => ({
              latitude: point.latitude,
              longitude: point.longitude
            }))
          }),
          cache: "no-store",
          headers: {
            "Content-Type": "application/json"
          },
          method: "POST",
          signal: controller.signal
        });
        const payload = (await response.json()) as Partial<RouteState> & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "TomTom route data is unavailable right now.");
        }

        setSelectedRoute({
          coordinates: Array.isArray(payload.coordinates) ? payload.coordinates : [],
          distanceMeters: typeof payload.distanceMeters === "number" ? payload.distanceMeters : 0,
          source: "tomtom",
          trafficDelaySeconds:
            typeof payload.trafficDelaySeconds === "number" ? payload.trafficDelaySeconds : 0,
          travelTimeSeconds:
            typeof payload.travelTimeSeconds === "number" ? payload.travelTimeSeconds : 0
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setRouteError(error instanceof Error ? error.message : "Unable to load routed ETA.");
        setSelectedRoute(fallbackRoute);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [liveDevices, selectedTechnician, tomTomKey, trafficEnabled]);

  useEffect(() => {
    onRouteMetricsChange(
      selectedRoute
        ? {
            available: selectedRoute.coordinates.length >= 2,
            distanceMiles: selectedRoute.distanceMeters / 1609.34,
            source: selectedRoute.source,
            trafficDelayMinutes: Math.round(selectedRoute.trafficDelaySeconds / 60),
            travelMinutes: Math.round(selectedRoute.travelTimeSeconds / 60)
          }
        : null
    );
  }, [onRouteMetricsChange, selectedRoute]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    const routeSource = map.getSource(ALL_ROUTES_SOURCE_ID) as GeoJSONSource | undefined;

    if (!routeSource) {
      return;
    }

    routeSource.setData(
      createLineFeatureCollection(
        technicians
          .filter((technician) => technician.id !== selectedTechnicianId)
          .map((technician) => ({
            coordinates: getRouteWaypoints(technician, liveDevices).map(toCoordinate),
            properties: {
              status: technician.status
            }
          }))
      )
    );
  }, [liveDevices, mapReady, selectedTechnicianId, technicians]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    const source = map.getSource(SELECTED_ROUTE_SOURCE_ID) as GeoJSONSource | undefined;

    if (!source) {
      return;
    }

    source.setData(
      createLineFeatureCollection([
        {
          coordinates: selectedRoute?.coordinates ?? []
        }
      ])
    );
  }, [mapReady, selectedRoute]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    const source = map.getSource(LIVE_TRACK_SOURCE_ID) as GeoJSONSource | undefined;

    if (!source) {
      return;
    }

    source.setData(buildTrackFeature(selectedLiveDevice?.recentTrack ?? []));
  }, [mapReady, selectedLiveDevice]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady || mapProvider !== "tomtom" || !map.getLayer("tomtom-traffic")) {
      return;
    }

    map.setLayoutProperty("tomtom-traffic", "visibility", trafficEnabled ? "visible" : "none");
  }, [mapProvider, mapReady, trafficEnabled]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    technicians.forEach((technician) => {
      const anchor = getTechnicianAnchorPoint(technician, liveDevices);

      if (!anchor) {
        return;
      }

      const marker = new maplibregl.Marker({
        element: createTechnicianMarkerElement({
          isSelected: technician.id === selectedTechnicianId,
          onSelect: () => onSelectTechnician(technician.id),
          technician
        })
      })
        .setLngLat(toCoordinate(anchor))
        .addTo(map);

      markersRef.current.push(marker);

      if (technician.id !== selectedTechnicianId) {
        return;
      }

      technician.routeStops.forEach((stop, index) => {
        if (!stop.coords) {
          return;
        }

        const stopMarker = new maplibregl.Marker({
          element: createStopMarkerElement({
            isSelected: stop.id === selectedStopId,
            onSelect: () => onSelectStop(stop.id),
            stop,
            stopIndex: index
          })
        })
          .setLngLat(toCoordinate(stop.coords))
          .addTo(map);

        markersRef.current.push(stopMarker);
      });
    });

    queueJobs.slice(0, 6).forEach((stop) => {
      if (!stop.coords) {
        return;
      }

      const marker = new maplibregl.Marker({
        element: createQueueMarkerElement(stop, () => onSelectStop(stop.id))
      })
        .setLngLat(toCoordinate(stop.coords))
        .addTo(map);

      markersRef.current.push(marker);
    });

    const technicianIds = new Set(technicians.map((technician) => technician.id));

    liveDevices.forEach((device) => {
      if (technicianIds.has(device.userId) || device.latitude === null || device.longitude === null) {
        return;
      }

      const marker = new maplibregl.Marker({
        element: createLiveDeviceMarkerElement(device)
      })
        .setLngLat([device.longitude, device.latitude])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [
    liveDevices,
    mapReady,
    onSelectStop,
    onSelectTechnician,
    queueJobs,
    selectedStopId,
    selectedTechnicianId,
    technicians
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    const selectionChanged = lastSelectedTechnicianRef.current !== selectedTechnicianId;
    const focusChanged = lastFocusNonceRef.current !== focusNonce;

    if (!selectionChanged && !focusChanged && hasFitInitiallyRef.current) {
      return;
    }

    const bounds = new LngLatBounds();

    if (selectedTechnician) {
      getRouteWaypoints(selectedTechnician, liveDevices).forEach((point) => bounds.extend(toCoordinate(point)));
      queueJobs.slice(0, 3).forEach((stop) => {
        if (stop.coords) {
          bounds.extend(toCoordinate(stop.coords));
        }
      });
      selectedLiveDevice?.recentTrack.forEach((point) => bounds.extend([point.longitude, point.latitude]));
      selectedRoute?.coordinates.forEach((point) => bounds.extend(point));
    } else {
      technicians.forEach((technician) => {
        const anchor = getTechnicianAnchorPoint(technician, liveDevices);

        if (anchor) {
          bounds.extend(toCoordinate(anchor));
        }
      });
      queueJobs.forEach((stop) => {
        if (stop.coords) {
          bounds.extend(toCoordinate(stop.coords));
        }
      });
    }

    if (bounds.isEmpty()) {
      map.setCenter(CHICAGO_CENTER);
      map.setZoom(10);
    } else {
      map.fitBounds(bounds, {
        duration: hasFitInitiallyRef.current ? 500 : 0,
        maxZoom: selectedTechnician ? 12.7 : 11,
        padding: 64
      });
    }

    hasFitInitiallyRef.current = true;
    lastSelectedTechnicianRef.current = selectedTechnicianId;
    lastFocusNonceRef.current = focusNonce;
  }, [
    focusNonce,
    liveDevices,
    mapReady,
    queueJobs,
    selectedLiveDevice,
    selectedRoute,
    selectedTechnician,
    selectedTechnicianId,
    technicians
  ]);

  const liveDeviceCount = liveDevices.filter(
    (device) => device.latitude !== null && device.longitude !== null
  ).length;
  const hasRenderableGeometry =
    technicians.some((technician) => Boolean(getTechnicianAnchorPoint(technician, liveDevices))) ||
    queueJobs.some((stop) => Boolean(stop.coords));
  const trafficLabel =
    mapProvider === "tomtom" ? (trafficEnabled ? "Traffic on" : "Traffic off") : "Traffic unavailable";
  const routeSummary =
    selectedRoute?.travelTimeSeconds && selectedRoute.coordinates.length >= 2
      ? `${formatFleetMinutes(Math.round(selectedRoute.travelTimeSeconds / 60))} drive`
      : selectedTechnician
        ? liveDeviceCount
          ? "Route syncing"
          : "Awaiting GPS"
        : "Choose a technician";
  const trafficUnavailable = mapProvider !== "tomtom";
  const telemetryDegraded = liveDeviceCount === 0;
  const routeDegraded =
    routeSummary === "Awaiting GPS" || routeSummary === "Route syncing" || Boolean(routeError);
  const overlayTone = mapLoadError || telemetryDegraded ? "danger" : routeDegraded ? "warning" : "neutral";
  const overlayTitle = mapLoadError
    ? "Route map degraded"
    : telemetryDegraded
      ? "Live route control degraded"
      : routeDegraded
        ? "Awaiting route confidence"
        : "Live route map";
  const overlayCopy = mapLoadError
    ? "TomTom routing is unavailable, so Dispatch should work from basic map posture until live traffic returns."
    : telemetryDegraded
      ? selectedTechnician
        ? `${selectedTechnician.name} has no live GPS ping yet. Confirm the next move before inserting more work.`
        : "No visible lane is sharing live GPS. Confirm route health before committing same-day work."
      : routeDegraded
        ? "Route timing is still syncing. Keep the next move conservative until telemetry stabilizes."
        : "Live telemetry is healthy enough to trust the route surface.";

  return (
    <div className="fleet-live-map">
      <div className="fleet-live-map__canvas" ref={containerRef} />

      <div
        className={cx(
          "fleet-live-map__overlay",
          "fleet-live-map__overlay--compact",
          `fleet-live-map__overlay--${overlayTone}`
        )}
      >
        <div className={cx("fleet-live-map__status", `fleet-live-map__status--${overlayTone}`)}>
          <strong className="fleet-live-map__status-title">{overlayTitle}</strong>
          <span className="fleet-live-map__status-copy">{overlayCopy}</span>
        </div>
        <span
          className={cx(
            "fleet-live-map__badge",
            trafficUnavailable
              ? "fleet-live-map__badge--danger"
              : trafficEnabled
                ? "fleet-live-map__badge--success"
                : "fleet-live-map__badge--warning"
          )}
        >
          {trafficUnavailable ? "Basic basemap only" : trafficLabel}
        </span>
        <span
          className={cx(
            "fleet-live-map__badge",
            telemetryDegraded
              ? "fleet-live-map__badge--danger"
              : liveDeviceCount === 1
                ? "fleet-live-map__badge--warning"
                : "fleet-live-map__badge--success"
          )}
        >
          {liveDeviceCount} live device{liveDeviceCount === 1 ? "" : "s"}
        </span>
        {routeSummary !== "Choose a technician" ? (
          <span
            className={cx(
              "fleet-live-map__badge",
              routeSummary === "Awaiting GPS" || routeSummary === "Route syncing"
                ? "fleet-live-map__badge--danger"
                : "fleet-live-map__badge--warning"
            )}
          >
            {routeSummary}
          </span>
        ) : null}
        {routeError ? <span className="fleet-live-map__badge fleet-live-map__badge--danger">{routeError}</span> : null}
        {mapLoadError ? <span className="fleet-live-map__badge fleet-live-map__badge--danger">{mapLoadError}</span> : null}
      </div>

      {readinessPacket ? (
        <div className="fleet-live-map__packet" aria-live="polite">
          <div className="fleet-live-map__packet-header">
            <div>
              <p className="fleet-live-map__packet-eyebrow">Crew readiness packet</p>
              <h2 className="fleet-live-map__packet-title">{readinessPacket.technicianName}</h2>
              <p className="fleet-live-map__packet-copy">{readinessPacket.unitLabel}</p>
            </div>
            <div className="fleet-live-map__packet-action">
              <span className="fleet-live-map__packet-action-label">Next move</span>
              <strong>{readinessPacket.nextAction}</strong>
            </div>
          </div>

          <p className="fleet-live-map__packet-headline">{readinessPacket.headline}</p>

          <div className="fleet-live-map__packet-route">
            <div>
              <span className="fleet-live-map__packet-route-label">Now</span>
              <strong>{readinessPacket.currentLabel}</strong>
            </div>
            <div>
              <span className="fleet-live-map__packet-route-label">Next</span>
              <strong>{readinessPacket.nextLabel}</strong>
            </div>
          </div>

          <div className="fleet-live-map__packet-signals">
            {readinessPacket.signals.slice(0, 1).map((signal) => (
              <article
                className={cx(
                  "fleet-live-map__packet-signal",
                  `fleet-live-map__packet-signal--${signal.tone}`
                )}
                key={signal.label}
              >
                <span className="fleet-live-map__packet-signal-label">{signal.label}</span>
                <strong className="fleet-live-map__packet-signal-value">{signal.value}</strong>
                <span className="fleet-live-map__packet-signal-detail">{signal.detail}</span>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {!hasRenderableGeometry ? (
        <div className="fleet-live-map__empty-note">
          {liveDeviceCount
            ? "Visit addresses are missing geocodes. Route control is degraded until those stops can render."
            : selectedTechnician
              ? `${selectedTechnician.name} has no live GPS. Route confidence is degraded until the first device ping arrives.`
              : "No technician is sharing live GPS yet. Select a lane and recover readiness before trusting route timing."}
        </div>
      ) : null}
    </div>
  );
}
