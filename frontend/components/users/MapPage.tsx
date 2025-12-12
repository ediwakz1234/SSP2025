import { useEffect, useRef, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,

} from "../ui/card";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Label } from "../ui/label";
import { MapPin, Filter, RefreshCcw, Loader2, Globe, Layers, Compass, List, ChevronRight, Building, Info } from "lucide-react";
import { useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { LOCATION_INFO } from "../../data/businesses";
import { useActivity, logActivity } from "../../utils/activity";
import { toast } from "sonner";
import type L from "leaflet";


// ---------------------------------------------------------
// TYPES
// ---------------------------------------------------------
type Business = {
  id: number;
  business_name: string;
  general_category: string;
  zone_type: string;
  street: string | null;
  latitude: number;
  longitude: number;
};

// ---------------------------------------------------------
// CATEGORY COLORS
// ---------------------------------------------------------
const CATEGORY_COLORS: Record<string, string> = {
  "Food & Beverages": "#0ea5e9",          // Sky Blue
  Retail: "#10b981",
  Services: "#f59e0b",
  "Merchandising / Trading": "#ef4444",
  "Entertainment / Leisure": "#a78bfa",
  Restaurant: "#475569",
};





// ---------------------------------------------------------
// NORMALIZATION (prevents duplicate legend entries)
// ---------------------------------------------------------
function normalizeCategory(raw?: string | null): string {
  if (!raw) return "Restaurant";

  const cleaned = raw.trim();

  const allowed = [
    "Food & Beverages",
    "Retail",
    "Services",
    "Merchandising / Trading",
    "Entertainment / Leisure",
    "Restaurant",
  ];

  if (allowed.includes(cleaned)) return cleaned;

  return "Restaurant";
}


// ---------------------------------------------------------
// BOUNDARY LIMITS (same as ClusteringPage)
// ---------------------------------------------------------
const BRGY_BOUNDS = {
  minLat: 14.8338,
  maxLat: 14.8413,
  minLng: 120.9518,
  maxLng: 120.9608,
};

// Leaflet marker cluster group type (from leaflet.markercluster plugin)
interface MarkerClusterGroup extends L.LayerGroup {
  addLayer(layer: L.Layer): this;
  clearLayers(): this;
}

// Type for Leaflet on window object
interface LeafletWindow extends Window {
  L: typeof L & {
    markerClusterGroup: (options?: {
      maxClusterRadius?: number;
      disableClusteringAtZoom?: number;
    }) => MarkerClusterGroup;
  };
}

function clampToStaCruz(lat: number, lng: number) {
  return {
    latitude: Math.min(Math.max(lat, BRGY_BOUNDS.minLat), BRGY_BOUNDS.maxLat),
    longitude: Math.min(
      Math.max(lng, BRGY_BOUNDS.minLng),
      BRGY_BOUNDS.maxLng
    ),
  };
}

// ---------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------
export function MapPage() {
  useActivity();
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const clusterLayer = useRef<MarkerClusterGroup | null>(null);
  const { state: _state } = useLocation();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedZone, setSelectedZone] = useState("all");
  const [totalMarkers, setTotalMarkers] = useState(0);
  const [isLeafletReady, setIsLeafletReady] = useState(false);

  // Business list panel state
  const [currentBatch, setCurrentBatch] = useState(1);
  const BATCH_SIZE = 10;
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);



  // ---------------------------------------------------------
  // LOAD SUPABASE DATA
  // ---------------------------------------------------------
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from("businesses").select("*");

      if (error) {
        console.error("Error loading businesses:", error);
        return;
      }

      const list = (data || []) as Business[];

      const valid = list.filter(
        (b) =>
          typeof b.latitude === "number" &&
          typeof b.longitude === "number" &&
          !isNaN(b.latitude) &&
          !isNaN(b.longitude)
      );

      setBusinesses(valid);

      const uniqueCats = Array.from(
        new Set(
          valid
            .map((b) => normalizeCategory(b.general_category))
            .filter((c) => c && c.trim() !== "")
        )
      );
      setCategories(uniqueCats);
    }

    load();
  }, []);

  // ---------------------------------------------------------
  // LOAD LEAFLET
  // ---------------------------------------------------------
  useEffect(() => {
    const loadLeaflet = async () => {
      const w = window as unknown as LeafletWindow;
      // Check if Leaflet and marker cluster plugin are loaded
      if (typeof w.L !== "undefined" && typeof w.L.markerClusterGroup === "function") {
        setIsLeafletReady(true);
        return;
      }

      const addCSS = (href: string) => {
        const l = document.createElement("link");
        l.rel = "stylesheet";
        l.href = href;
        document.head.appendChild(l);
      };

      addCSS("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
      addCSS(
        "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"
      );
      addCSS(
        "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"
      );

      await new Promise<void>((resolve) => {
        const s = document.createElement("script");
        s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        s.onload = () => resolve();
        document.body.appendChild(s);
      });

      await new Promise<void>((resolve) => {
        const s = document.createElement("script");
        s.src =
          "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js";
        s.onload = () => resolve();
        document.body.appendChild(s);
      });

      setIsLeafletReady(true);
    };

    loadLeaflet();
  }, []);

  // ---------------------------------------------------------
  // INIT MAP
  // ---------------------------------------------------------
  useEffect(() => {
    if (!isLeafletReady || !businesses.length || leafletMap.current) return;
    initMap();
    renderClusters(businesses);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLeafletReady, businesses]);

  const initMap = () => {
    const w = window as unknown as LeafletWindow;
    const Leaflet = w.L;

    const map = Leaflet.map(mapRef.current!).setView(
      [LOCATION_INFO.center_latitude, LOCATION_INFO.center_longitude],
      15
    );

    Leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(
      map
    );

    map.setMaxBounds([
      [BRGY_BOUNDS.minLat - 0.002, BRGY_BOUNDS.minLng - 0.002],
      [BRGY_BOUNDS.maxLat + 0.002, BRGY_BOUNDS.maxLng + 0.002],
    ]);

    leafletMap.current = map;
  };

  // ---------------------------------------------------------
  // RENDER BUSINESS MARKERS
  // ---------------------------------------------------------
  const renderClusters = useCallback((data: Business[]) => {
    const w = window as unknown as LeafletWindow;
    const Leaflet = w.L;

    if (!leafletMap.current) return;

    if (clusterLayer.current)
      leafletMap.current.removeLayer(clusterLayer.current);

    const clusters = Leaflet.markerClusterGroup({
      maxClusterRadius: 60,
      disableClusteringAtZoom: 17,
    });

    const bounds = Leaflet.latLngBounds([]);

    data.forEach((b) => {
      const cleanCategory = normalizeCategory(b.general_category);
      const color = CATEGORY_COLORS[cleanCategory] || "#6b7280";

      const safe = clampToStaCruz(b.latitude, b.longitude);

      const marker = Leaflet.circleMarker([safe.latitude, safe.longitude], {
        radius: 8,
        fillColor: color,
        color: "#fff",
        weight: 2,
        fillOpacity: 0.9,
      })
        // 👇 ADD THIS CLICK EVENT
        .on("click", () => {
          toast.message(`Viewing: ${b.business_name}`);

          logActivity("Viewed Business Marker", {
            business_name: b.business_name,
            category: cleanCategory,
            zone: b.zone_type,
            street: b.street,
          });
        })

        // keep your popup — no changes
        .bindPopup(`
    <strong>${b.business_name}</strong><br/>
    <span style="color:${color};font-weight:600;">${cleanCategory}</span><br/>
    <small>${b.street ?? ""}</small><br/>
    <small>Zone: ${b.zone_type}</small>
  `);


      clusters.addLayer(marker);
      bounds.extend([safe.latitude, safe.longitude]);
    });

    leafletMap.current.addLayer(clusters);
    clusterLayer.current = clusters;

    if (bounds.isValid()) {
      leafletMap.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }

    setTotalMarkers(data.length);
  }, []);

  // ---------------------------------------------------------
  // FILTERS
  // ---------------------------------------------------------
  useEffect(() => {
    if (!leafletMap.current) return;

    let filtered = businesses;

    if (selectedCategory !== "all") {
      filtered = filtered.filter(
        (b) =>
          normalizeCategory(b.general_category) === selectedCategory
      );
    }

    if (selectedZone !== "all") {
      filtered = filtered.filter((b) => b.zone_type === selectedZone);
    }

    renderClusters(filtered);
  }, [selectedCategory, selectedZone, businesses, renderClusters]);

  // ---------------------------------------------------------
  // RESET
  // ---------------------------------------------------------
  const resetView = () => {
    setSelectedCategory("all");
    setSelectedZone("all");
    renderClusters(businesses);

    toast.success("Map view reset");
    logActivity("Reset Map View");
  };




  // ---------------------------
  // MAP LOADING SCREEN
  // ---------------------------
  if (!isLeafletReady || businesses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] animate-fadeIn">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-cyan-500 to-blue-600 animate-pulse flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <div className="absolute -inset-4 bg-linear-to-br from-cyan-500/20 to-blue-600/20 rounded-3xl blur-xl animate-pulse" />
        </div>
        <p className="mt-6 text-gray-600 font-medium">Loading map...</p>
        <p className="text-sm text-gray-400 mt-1">Preparing visualization</p>
      </div>
    );
  }

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------
  return (

    <div className="page-wrapper space-y-6">
      {/* Hero Header */}
      <div className="page-content relative overflow-hidden rounded-2xl bg-[#1e3a5f] p-6 text-white">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

        <div className="relative z-10 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Globe className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Interactive Business Map</h1>
            <p className="text-white/80 text-sm mt-1">
              Explore {businesses.length} businesses across {LOCATION_INFO.barangay}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-card overflow-hidden animate-fadeInUp">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1e3a5f] flex items-center justify-center">
              <Filter className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Map Filters</CardTitle>
              <CardDescription>
                Filter businesses by category and zone type
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Category */}
            <div className="space-y-2">
              <Label className="font-medium text-gray-700">Business Category</Label>
              <Select
                value={selectedCategory}
                onValueChange={(value) => {
                  setSelectedCategory(value);
                  toast.info(
                    value === "all"
                      ? "Showing all business categories"
                      : `Filtered by category: ${value}`
                  );
                  logActivity("Filtered Map by Category", { category: value });
                }}
              >

                <SelectTrigger className="bg-white border-gray-200 hover:border-indigo-300 transition-colors">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: CATEGORY_COLORS[c] || "#6b7280" }}
                        />
                        {c}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Zone */}
            <div className="space-y-2">
              <Label className="font-medium text-gray-700">Zone Type</Label>
              <Select value={selectedZone} onValueChange={setSelectedZone}>
                <SelectTrigger className="bg-white border-gray-200 hover:border-indigo-300 transition-colors">
                  <SelectValue placeholder="All Zones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Zones</SelectItem>
                  <SelectItem value="Commercial">Commercial</SelectItem>
                  <SelectItem value="Residential">Residential</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              onClick={resetView}
              variant="outline"
              className="gap-2 hover:bg-gray-50 border-gray-200"
            >
              <RefreshCcw className="w-4 h-4" /> Reset View
            </Button>

            <div className="badge-modern badge-info">
              <MapPin className="w-3.5 h-3.5" />
              Showing {totalMarkers} of {businesses.length}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Map Container */}
      <Card className="border-0 shadow-card overflow-hidden animate-fadeInUp delay-100">
        <CardHeader className="bg-linear-to-r from-gray-50 to-white border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Business Locations</CardTitle>
              <CardDescription>
                Click markers to view business details
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div
            ref={mapRef}
            className="w-full h-[550px]"
            style={{ borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}
          />
        </CardContent>
      </Card>

      {/* Map Description */}
      <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3 animate-fadeInUp delay-150">
        <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-sm text-gray-700">
          This interactive map displays all <strong>{businesses.length} businesses</strong> in Sta. Cruz using business centroids.
          Click any business marker to view details including business name, location, and zone type.
        </p>
      </div>

      {/* Business List Panel */}
      <Card className="border-0 shadow-card overflow-hidden animate-fadeInUp delay-175">
        <CardHeader className="bg-linear-to-r from-gray-50 to-white border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <List className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Business Directory</CardTitle>
                <CardDescription>
                  Showing {Math.min(currentBatch * BATCH_SIZE, businesses.length)} of {businesses.length} businesses
                </CardDescription>
              </div>
            </div>
            <div className="badge-modern badge-info">
              Batch {currentBatch} of {Math.ceil(businesses.length / BATCH_SIZE)}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
            {businesses.slice(0, currentBatch * BATCH_SIZE).map((business) => {
              const cleanCategory = normalizeCategory(business.general_category);
              const color = CATEGORY_COLORS[cleanCategory] || "#6b7280";
              const isSelected = selectedBusinessId === business.id;

              return (
                <button
                  key={business.id}
                  onClick={() => {
                    setSelectedBusinessId(business.id);
                    if (leafletMap.current) {
                      const safe = clampToStaCruz(business.latitude, business.longitude);
                      leafletMap.current.setView([safe.latitude, safe.longitude], 17);
                    }
                    toast.info(`Viewing: ${business.business_name}`);
                    logActivity("Selected Business from List", {
                      business_name: business.business_name,
                      category: cleanCategory
                    });
                  }}
                  className={`text-left p-3 rounded-xl border transition-all duration-200 ${isSelected
                      ? "bg-indigo-50 border-indigo-300 shadow-md"
                      : "bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-3 h-3 rounded-full mt-1.5 shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate text-sm">
                        {business.business_name}
                      </p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {cleanCategory}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${business.zone_type === "Commercial"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-green-100 text-green-700"
                          }`}>
                          {business.zone_type}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Load More Button */}
          {currentBatch * BATCH_SIZE < businesses.length && (
            <div className="mt-4 text-center">
              <Button
                onClick={() => setCurrentBatch(currentBatch + 1)}
                variant="outline"
                className="gap-2"
              >
                Load More ({businesses.length - currentBatch * BATCH_SIZE} remaining)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="border-0 shadow-card overflow-hidden animate-fadeInUp delay-200">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-600 flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <CardTitle className="text-lg">Map Legend</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((category) => {
              const color = CATEGORY_COLORS[category] || "#6b7280";
              const isSelected = selectedCategory === category;

              return (
                <button
                  key={category}
                  onClick={() => {
                    setSelectedCategory(category);
                    toast.info(`Filtered by: ${category}`);
                    logActivity("Clicked Legend Category", { category });
                  }}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${isSelected
                    ? "bg-indigo-50 border-2 border-indigo-300 shadow-sm"
                    : "bg-gray-50 border-2 border-transparent hover:bg-gray-100"
                    }`}
                >
                  <div
                    className="w-4 h-4 rounded-full shadow-sm shrink-0"
                    style={{
                      backgroundColor: color,
                      boxShadow: `0 0 8px ${color}40`
                    }}
                  />
                  <span className="text-sm font-medium text-gray-700 truncate">{category}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
