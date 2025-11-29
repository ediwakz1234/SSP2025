import { useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Label } from "../ui/label";
import { MapPin, Filter, RefreshCcw } from "lucide-react";

import { supabase } from "../../lib/supabase"; // 🔁 adjust path if needed
import { LOCATION_INFO } from "../../data/businesses"; // keeps your static barangay info

// ---- Types ----
type Business = {
  id: number;
  business_name: string;
  category: string;
  zone_type: string;
  street: string | null;
  latitude: number;
  longitude: number;
};

// shared colors for map + legend
const CATEGORY_COLORS: Record<string, string> = {
  Hardware: "#3b82f6",
  Cafe: "#8b5cf6",
  Retail: "#10b981",
  Services: "#f59e0b",
  Restaurant: "#ef4444",
  Pharmacy: "#06b6d4",
  "Furniture Store": "#ec4899",
  Resort: "#84cc16",
  Bakery: "#f97316",
  "Pet Store": "#a855f7",
};

export function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const clusterLayer = useRef<any>(null);

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedZone, setSelectedZone] = useState("all");
  const [totalMarkers, setTotalMarkers] = useState(0);
  const [isLeafletReady, setIsLeafletReady] = useState(false);

  // ================================
  // 1. Load REAL DATA from Supabase
  // ================================
  useEffect(() => {
    const loadData = async () => {
      const { data, error } = await supabase.from("businesses").select("*");

      if (error) {
        console.error("Error loading businesses:", error);
        return;
      }

      const list = (data || []) as Business[];

      // keep only rows with valid coords
      const valid = list.filter(
        (b) =>
          typeof b.latitude === "number" &&
          typeof b.longitude === "number" &&
          !Number.isNaN(b.latitude) &&
          !Number.isNaN(b.longitude)
      );

      setBusinesses(valid);

      // unique categories
      const uniqueCats = Array.from(
        new Set(valid.map((b) => b.category).filter(Boolean))
      ) as string[];
      setCategories(uniqueCats);
    };

    loadData();
  }, []);

  // ============================================
  // 2. Load Leaflet + MarkerCluster (once)
  // ============================================
  useEffect(() => {
    const loadLeaflet = async () => {
      const w = window as any;

      // already loaded?
      if (w.L && w.L.markerClusterGroup) {
        setIsLeafletReady(true);
        return;
      }

      const addCSS = (href: string) => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
      };

      addCSS("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
      addCSS(
        "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"
      );
      addCSS(
        "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"
      );

      // load Leaflet js
      await new Promise<void>((resolve) => {
        const leafletScript = document.createElement("script");
        leafletScript.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        leafletScript.onload = () => resolve();
        document.head.appendChild(leafletScript);
      });

      // load markercluster js
      await new Promise<void>((resolve) => {
        const clusterScript = document.createElement("script");
        clusterScript.src =
          "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js";
        clusterScript.onload = () => resolve();
        document.head.appendChild(clusterScript);
      });

      if (w.L && w.L.markerClusterGroup) {
        setIsLeafletReady(true);
      }
    };

    loadLeaflet();
  }, []);

  // ============================================
  // 3. Init map AFTER data + leaflet ready
  // ============================================
  useEffect(() => {
    if (!isLeafletReady) return;
    if (!businesses.length) return;
    if (leafletMap.current) return; // already initialized

    initMap();
    renderClusters(businesses);
  }, [isLeafletReady, businesses]);

  const initMap = () => {
    const w = window as any;
    const L = w.L;
    if (!mapRef.current || leafletMap.current) return;

    const map = L.map(mapRef.current as HTMLElement, {
      zoomControl: true,
      attributionControl: false,
    }).setView(
      [LOCATION_INFO.center_latitude, LOCATION_INFO.center_longitude],
      15
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    // Barangay center marker
    L.marker([LOCATION_INFO.center_latitude, LOCATION_INFO.center_longitude], {
      icon: L.divIcon({
        html: `<div style="background-color:#ef4444;width:26px;height:26px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
      }),
    })
      .addTo(map)
      .bindPopup(
        `<b>Brgy. ${LOCATION_INFO.barangay}</b><br>${LOCATION_INFO.municipality}, ${LOCATION_INFO.province}<br><small>Population: ${LOCATION_INFO.population.toLocaleString()}</small>`
      );

    leafletMap.current = map;
  };

  // ============================================
  // 4. Render clusters from data
  // ============================================
  const renderClusters = (data: Business[]) => {
    const w = window as any;
    const L = w.L;
    if (!leafletMap.current) return;

    if (clusterLayer.current) {
      leafletMap.current.removeLayer(clusterLayer.current);
    }

    const clusters = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 60,
      disableClusteringAtZoom: 17,
      spiderfyDistanceMultiplier: 2,
    });

    const bounds = L.latLngBounds([]);

    data.forEach((biz) => {
      const color = CATEGORY_COLORS[biz.category] || "#6b7280";

      const marker = L.circleMarker([biz.latitude, biz.longitude], {
        radius: 8,
        fillColor: color,
        color: "#fff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
      }).bindPopup(`
        <div style="font-family: system-ui, sans-serif; min-width: 220px;">
          <strong>${biz.business_name}</strong><br/>
          <span style="color:${color};font-weight:600;">${biz.category}</span><br/>
          <small>${biz.street ?? ""}</small><br/>
          <small>Zone: ${biz.zone_type}</small><br/>
          <small style="color:#6b7280;">${biz.latitude.toFixed(
            5
          )}, ${biz.longitude.toFixed(5)}</small>
        </div>
      `);

      clusters.addLayer(marker);
      bounds.extend([biz.latitude, biz.longitude]);
    });

    leafletMap.current.addLayer(clusters);
    clusterLayer.current = clusters;

    if (bounds.isValid()) {
      leafletMap.current.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 16,
      });
    }

    setTotalMarkers(data.length);
  };

  // ============================================
  // 5. React to filter changes
  // ============================================
  useEffect(() => {
    if (!leafletMap.current) return;

    let filtered = businesses;

    if (selectedCategory !== "all") {
      filtered = filtered.filter((b) => b.category === selectedCategory);
    }
    if (selectedZone !== "all") {
      filtered = filtered.filter((b) => b.zone_type === selectedZone);
    }

    renderClusters(filtered);
  }, [selectedCategory, selectedZone, businesses]);

  // ============================================
  // 6. Reset view
  // ============================================
  const resetView = () => {
    if (!leafletMap.current) return;

    leafletMap.current.setView(
      [LOCATION_INFO.center_latitude, LOCATION_INFO.center_longitude],
      15
    );
    setSelectedCategory("all");
    setSelectedZone("all");
    renderClusters(businesses);
  };

  // ============================================
  // Render UI (same as your sample)
  // ============================================
  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="w-5 h-5" />
            Map Filters
          </CardTitle>
          <CardDescription>
            Filter businesses by category and zone type
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category Select */}
            <div className="space-y-2">
              <Label>Business Category</Label>
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger className="bg-input-background">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Zone Select */}
            <div className="space-y-2">
              <Label>Zone Type</Label>
              <Select value={selectedZone} onValueChange={setSelectedZone}>
                <SelectTrigger className="bg-input-background">
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

          {/* Reset Button + Count */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              onClick={resetView}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" /> Reset Map View
            </Button>

            <Badge variant="secondary" className="flex items-center gap-2">
              <MapPin className="w-3 h-3" />
              Showing {totalMarkers} of {businesses.length} businesses
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Map */}
      <Card>
        <CardHeader>
          <CardTitle>Interactive Business Map</CardTitle>
          <CardDescription>
            Click on markers to view business details. Red marker indicates
            barangay center.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            ref={mapRef}
            className="w-full h-[600px] rounded-lg border border-border"
            style={{ zIndex: 0 }}
          />
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Map Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {categories.map((category) => {
              const color = CATEGORY_COLORS[category] || "#6b7280";
              return (
                <div key={category} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white shadow"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm">{category}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
