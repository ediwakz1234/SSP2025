import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/card";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Input } from "../ui/input";
import {
  Loader2,
  MapPin,
  CheckCircle2,
  Navigation,
  Target,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Progress } from "../ui/progress";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { LOCATION_INFO } from "../../data/businesses";
import {
  findOptimalLocation,
  ClusteringResult,
  Business,
} from "../../utils/kmeans";
import { haversineDistance } from "../../utils/haversine";

// ---------------------------------------------------------
// TYPES & CONSTANTS (moved outside component)
// ---------------------------------------------------------

type ExtendedResult = ClusteringResult & {
  gridPoints?: Array<{ latitude: number; longitude: number }>;
};

// Your new general category set — make sure DB categories match these strings
const CATEGORY_OPTIONS = [
  {
    value: "Food & Beverage",
    label: "Food & Beverage",
  },
  {
    value: "Retail",
    label: "Retail",
  },
  {
    value: "Services",
    label: "Services",
  },
  {
    value: "Hardware / Construction",
    label: "Hardware / Construction",
  },
  {
    value: "Entertainment / Tech",
    label: "Entertainment / Tech",
  },
  {
    value: "Miscellaneous",
    label: "Miscellaneous",
  },
];

// ---------------------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------------------
export function ClusteringPage() {
  // -----------------------
  // NEW: AI business idea + category states
  // -----------------------
  const [businessIdea, setBusinessIdea] = useState<string>("");
  const [aiCategory, setAiCategory] = useState<string | null>(null);
  const [aiCategoryExplanation, setAiCategoryExplanation] = useState<
    string | null
  >(null);
  const [aiCategoryLoading, setAiCategoryLoading] = useState<boolean>(false);
  const [categoryLockedByUser, setCategoryLockedByUser] =
    useState<boolean>(false);

  // Selected general category (drives clustering)
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ExtendedResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [map, setMap] = useState<any>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const [aiRecommendation, setAiRecommendation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  // BUSINESS DATA
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoadingBusinesses, setIsLoadingBusinesses] =
    useState<boolean>(false);

  // VALIDATION (for new general categories)
  const validateCategory = (value: string) => {
    const v = value.trim();
    if (!v) return "Category cannot be empty.";
    if (v.length < 2) return "Category is too short.";
    return null;
  };

  // ---------------------------------------------------------------------------
  // LOAD BUSINESSES FROM SUPABASE
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const loadBusinesses = async () => {
      setIsLoadingBusinesses(true);

      const { data, error } = await supabase
        .from("businesses")
        .select(`
          business_id,
          business_name,
          general_category,
          latitude,
          longitude,
          street,
          zone_type,
          business_density_50m,
          business_density_100m,
          business_density_200m,
          competitor_density_50m,
          competitor_density_100m,
          competitor_density_200m,
          zone_encoded,
          status
        `)
        .eq("status", "active");

      if (error) {
        console.error(error);
        toast.error("Failed to load businesses from Supabase.");
      } else {
        setBusinesses(data as Business[]);
      }

      setIsLoadingBusinesses(false);
    };

    loadBusinesses();
  }, []);

// Auto-switch between local dev and production
const API_BASE = "";


useEffect(() => {
  if (!businessIdea.trim()) {
    setAiCategory(null);
    setAiCategoryExplanation(null);
    setAiCategoryLoading(false);
    setCategoryLockedByUser(false);
    return;
  }

  setAiCategoryLoading(true);

  const controller = new AbortController();

  const timeoutId = setTimeout(async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/ai/categories`,   // ✅ Auto-switching endpoint
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessIdea }),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        throw new Error("Failed to detect category");
      }

      const data = await response.json();

      const detected = data.category?.trim() || "";
      const explanation = data.explanation || null;

      if (detected) {
        setAiCategory(detected);
        setAiCategoryExplanation(explanation);

        if (!categoryLockedByUser) {
          setSelectedCategory(detected);
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("AI Category Error:", err);
      }
    } finally {
      setAiCategoryLoading(false);
    }
  }, 600);

  return () => {
    clearTimeout(timeoutId);
    controller.abort();
  };
}, [businessIdea, categoryLockedByUser]);


  // ---------------------------------------------------------------------------
  // MAP INITIALIZATION
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (result && mapRef.current && !map) {
      initializeMap();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const initializeMap = () => {
    if (!mapRef.current || !result) return;

    if (!(window as any).L) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);

      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => createMap();
      document.body.appendChild(script);
    } else {
      createMap();
    }
  };

  const createMap = () => {
    if (!result || !mapRef.current) return;

    const L = (window as any).L;

    // Remove old map
    if (map) {
      map.remove();
    }

    const newMap = L.map(mapRef.current).setView(
      [
        result.recommendedLocation.latitude,
        result.recommendedLocation.longitude,
      ],
      14
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(newMap);

    // OPTIONAL — Show grid candidate points
    if (result.gridPoints) {
      result.gridPoints.forEach((p) => {
        L.circleMarker([p.latitude, p.longitude], {
          radius: 2,
          color: "#6EE7B7",
          fillColor: "#6EE7B7",
          fillOpacity: 0.5,
        }).addTo(newMap);
      });
    }

    // ⭐ Recommended Location Marker
    const recommendedIcon = L.divIcon({
      className: "custom-div-icon",
      html: `
        <div style="position: relative;">
          <div style="
            background-color:#10b981;
            width:40px;height:40px;
            border-radius:50%;
            border:4px solid white;
            box-shadow:0 4px 8px rgba(0,0,0,0.4);
            display:flex;align-items:center;justify-content:center;
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
                 viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14
                               18.18 21.02 12 17.77 5.82 21.02
                               7 14.14 2 9.27 8.91 8.26 12 2"
              ></polygon>
            </svg>
          </div>

          <div style="
            position:absolute;top:45px;left:50%;
            transform:translateX(-50%);
            background:white;padding:4px 8px;
            border-radius:4px;font-size:12px;
            font-weight:600;color:#10b981;
            white-space:nowrap;
            box-shadow:0 2px 4px rgba(0,0,0,0.2);
          ">
            RECOMMENDED
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    L.marker(
      [
        result.recommendedLocation.latitude,
        result.recommendedLocation.longitude,
      ],
      { icon: recommendedIcon }
    )
      .addTo(newMap)
      .bindPopup(`
        <div style="
          font-family: system-ui, sans-serif;
          min-width: 280px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          overflow: hidden;
        ">
          <div style="
            background: #059669;
            color: white;
            padding: 12px 16px;
            display: flex;
            align-items: center;
            font-size: 16px;
            font-weight: 700;
            gap: 8px;
          ">
            <span style="font-size: 20px;">📍</span>
            RECOMMENDED LOCATION
          </div>

          <div style="padding: 14px 16px; font-size: 14px; color: #333;">
            
            <div style="margin-bottom: 10px;">
              <strong>Coordinates:</strong><br/>
              ${result.recommendedLocation.latitude.toFixed(6)}, 
              ${result.recommendedLocation.longitude.toFixed(6)}
            </div>

            <div style="margin-bottom: 10px;">
              <strong>Zone Type:</strong> ${result.zoneType}<br/>
              <strong>Confidence:</strong> ${(result.analysis.confidence * 100).toFixed(
                0
              )}%
            </div>

            <div>
              <strong>Opportunity:</strong><br/>
              <span style="color: #059669; font-weight: 600;">
                ${result.analysis.opportunity}
              </span>
            </div>

          </div>
        </div>
      `)
      .openPopup();

    //⭐ Cluster Centroids + Business Points
    result.clusters.forEach((cluster) => {
      // ⛔ Skip clusters that have no points
      if (!cluster.points || cluster.points.length === 0) return;

      const clusterIcon = L.divIcon({
        className: "custom-div-icon",
        html: `
          <div style="
            background:${cluster.color};
            width:24px;height:24px;
            border-radius:50%;
            border:3px solid white;
            box-shadow:0 2px 4px rgba(0,0,0,0.3);
            display:flex;align-items:center;justify-content:center;
            color:white;font-size:12px;font-weight:bold;
          ">
            ${cluster.id + 1}
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      // Centroid
      L.marker(
        [cluster.centroid.latitude, cluster.centroid.longitude],
        {
          icon: clusterIcon,
        }
      )
        .addTo(newMap)
        .bindPopup(`
          <div style="font-family:system-ui;">
            <strong style="color:${cluster.color};">Cluster ${
          cluster.id + 1
        } Centroid</strong><br/>
            <small>Businesses: ${cluster.points.length}</small><br/>
            <small>Lat: ${cluster.centroid.latitude.toFixed(6)}</small><br/>
            <small>Lon: ${cluster.centroid.longitude.toFixed(6)}</small>
          </div>
        `);

      // Points inside the cluster
      cluster.points.forEach((point) => {
        if (!point.business) return;

        L.circleMarker([point.latitude, point.longitude], {
          radius: 5,
          fillColor: cluster.color,
          color: "#fff",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.7,
        })
          .addTo(newMap)
          .bindPopup(`
            <div style="font-family:system-ui;">
              <strong>${point.business.business_name}</strong><br/>
              <span style="color:${cluster.color};">${point.business.general_category}</span><br/>
              <small>${point.business.street}</small>
            </div>
          `);
      });
    });

    // ⭐ Barangay Center
    L.marker(
      [LOCATION_INFO.center_latitude, LOCATION_INFO.center_longitude],
      {
        icon: L.divIcon({
          className: "custom-div-icon",
          html: `<div style="background-color: #ef4444; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      }
    ).addTo(newMap)
      .bindPopup(`
        <div style="font-family: system-ui, -apple-system, sans-serif;">
          <strong>Brgy. Center</strong><br/>
          <small>${LOCATION_INFO.barangay}</small>
        </div>
      `);

    setMap(newMap);
  };

  // ---------------------------------------------------------------------------
  // RUN CLUSTERING
  // ---------------------------------------------------------------------------
  const handleRunClustering = async () => {
    const categoryToAnalyze = selectedCategory;

    const validationError = validateCategory(categoryToAnalyze);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (!businesses.length) {
      toast.error("No business data available.");
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResult(null);
    if (map) {
      map.remove();
      setMap(null);
    }

    const steps = [
      { progress: 20, delay: 250 },
      { progress: 40, delay: 250 },
      { progress: 60, delay: 250 },
      { progress: 80, delay: 250 },
      { progress: 100, delay: 200 },
    ];

    for (const step of steps) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, step.delay));
      setProgress(step.progress);
    }

    try {
      const clusteringResult = findOptimalLocation(
        businesses as Business[],
        categoryToAnalyze
      );

      setResult(clusteringResult);
    } catch (err) {
      console.error(err);
      toast.error("Failed to run clustering.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getConfidenceColor = (c: number) =>
    c >= 0.8 ? "text-green-600" : c >= 0.6 ? "text-yellow-600" : "text-red-600";
  const getConfidenceBg = (c: number) =>
    c >= 0.8 ? "bg-green-50" : c >= 0.6 ? "bg-yellow-50" : "bg-red-50";

  // helper for explanation module
  const describeLevel = (value: number | undefined) => {
    if (value === undefined) return "N/A";
    if (value >= 12) return "very high";
    if (value >= 8) return "high";
    if (value >= 4) return "moderate";
    if (value > 0) return "low";
    return "none";
  };

  const describeZone = (zone: string) => {
    const z = (zone || "").toLowerCase();
    if (z.includes("commercial"))
      return "a commercial area with good business exposure";
    if (z.includes("residential"))
      return "a residential area with local customer base";
    return "this zone type";
  };

  const getAnchorBusiness = (): Business | null => {
    if (!result || !businesses.length) return null;

    const { latitude, longitude } = result.recommendedLocation;
    let best: Business | null = null;
    let bestDist = Infinity;

    for (const b of businesses) {
      const dist = haversineDistance(
        { latitude, longitude },
        { latitude: b.latitude, longitude: b.longitude }
      );
      if (dist < bestDist) {
        bestDist = dist;
        best = b;
      }
    }

    return best;
  };


  async function generateAIRecommendation(result: any) {
  setAiLoading(true);

  const prompt = `
    You are an AI business strategist.
    Provide simple recommendations for opening a business in this area.

    Zone Type: ${result.zoneType}
    Opportunity: ${result.analysis.opportunity}
    Confidence: ${(result.analysis.confidence * 100).toFixed(0)}%

    Nearby Businesses:
    ${result.nearbyBusinesses.slice(0, 10).map((b: any) =>
      `- ${b.business.business_name} (${b.business.category})`
    ).join("\n")}

    Please provide:
    1. Top 3 recommended business types
    2. Why each business fits the location
    3. Risk level (Low, Medium, High)
    4. Short conclusion
  `;

  try {
    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_URL}/api/ai-businesses`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      }
    );

    const data = await response.json();
    setAiRecommendation(data.text);
  } catch (err) {
    console.error(err);
    setAiRecommendation("AI service is unavailable.");
  }

  setAiLoading(false);
}


 return (
  <div className="space-y-6">

    {/* ---------------------------------------------- */}
    {/* CONFIG CARD */}
    {/* ---------------------------------------------- */}
    <Card>
      <CardHeader>
        <CardTitle>K-Means Clustering Configuration</CardTitle>
        <CardDescription>
          Enter your business idea — AI will categorize it and optimize your recommended location.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">

        {/* ---------------------------------------------- */}
        {/* PREMIUM AI BUSINESS INPUT BLOCK */}
        {/* ---------------------------------------------- */}
        <div className="space-y-4 bg-gradient-to-br from-gray-50 to-white p-5 rounded-xl border border-gray-200 shadow-sm">

          {/* BUSINESS IDEA INPUT */}
          <div className="space-y-2">
            <Label htmlFor="businessIdea" className="font-semibold text-gray-700">
              Your Business Idea
            </Label>

            <Input
              id="businessIdea"
              type="text"
              placeholder='e.g. "Milk Tea Shop", "Laundry Hub", "Grocery Store"'
              value={businessIdea}
              onChange={(e) => {
                setBusinessIdea(e.target.value);
                setCategoryLockedByUser(false);
              }}
              className="bg-white border-gray-300 focus-visible:ring-green-500"
            />

            <p className="text-xs text-gray-500">
              AI will automatically determine the most suitable business category.
            </p>
          </div>

          {/* CATEGORY SELECT */}
          <div className="space-y-2">
            <Label className="font-semibold text-gray-700">
              AI-Detected Category (You can override it)
            </Label>

            <Select
              value={selectedCategory}
              onValueChange={(v) => {
                setSelectedCategory(v);
                setCategoryLockedByUser(true);
              }}
            >
              <SelectTrigger className="bg-white border-gray-300 focus:ring-green-500">
                <SelectValue placeholder="Select or let AI decide" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* AI STATUS + RESULT */}
            <div className="mt-2 text-sm">
              {aiCategoryLoading ? (
                <div className="flex items-center gap-2 text-green-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>AI is analyzing your idea…</span>
                </div>
              ) : aiCategory ? (
                <div className="p-3 rounded-lg border bg-green-50 border-green-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-green-700">
                      AI Suggestion:
                    </span>

                    <Badge className="bg-green-600 text-white">
                      {aiCategory}
                    </Badge>
                  </div>

                  {/* WHY THIS CATEGORY (EXPANDABLE) */}
                  {aiCategoryExplanation && (
                    <details className="mt-2 text-gray-700">
                      <summary className="cursor-pointer text-sm text-green-700 hover:underline">
                        Why this category?
                      </summary>
                      <p className="text-xs mt-2 text-gray-600">
                        {aiCategoryExplanation}
                      </p>
                    </details>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  AI will categorize once you type something above.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* AUTO CLUSTERING NOTICE */}
        <div className="space-y-1 mt-4">
          <div className="text-sm font-semibold text-gray-900">Clustering Mode</div>
          <div className="text-sm text-gray-500">
            The system automatically chooses the best number of clusters for optimal accuracy.
          </div>
        </div>

        {/* RUN BUTTON */}
        <Button
          onClick={handleRunClustering}
          disabled={
            isProcessing ||
            (!selectedCategory || selectedCategory.trim() === "")
          }
          className="w-full md:w-auto bg-green-600 hover:bg-green-700"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…
            </>
          ) : (
            <>
              <Target className="w-4 h-4 mr-2" /> Run K-Means Clustering
            </>
          )}
        </Button>

        {/* PROGRESS BAR */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Analyzing data…</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
      </CardContent>
    </Card>

    {/* ---------------------------------------------- */}
    {/* RESULT SECTION */}
    {/* ---------------------------------------------- */}
    {result && (
      <>
        <Alert className={getConfidenceBg(result.analysis.confidence)}>
          <CheckCircle2
            className={`h-5 w-5 ${getConfidenceColor(result.analysis.confidence)}`}
          />
          <AlertTitle>
            Analysis Complete – {(result.analysis.confidence * 100).toFixed(0)}% Confidence
          </AlertTitle>
          <AlertDescription>{result.analysis.opportunity}</AlertDescription>
        </Alert>

        {/* ---------------------------------------------- */}
        {/* MAP VISUALIZATION */}
        {/* ---------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Recommended Business Location
            </CardTitle>
            <CardDescription>
              Interactive map showing clusters and the optimized location.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              ref={mapRef}
              className="w-full h-[500px] rounded-lg border mb-4"
              style={{ zIndex: 0 }}
            />

            {/* Coordinate Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <h4 className="flex items-center gap-2 font-semibold text-gray-800">
                  <Navigation className="w-4 h-4" />
                  Coordinates
                </h4>

                <div className="bg-gray-50 p-4 rounded-lg border">
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Latitude:</span>
                      <span>{result.recommendedLocation.latitude.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Longitude:</span>
                      <span>{result.recommendedLocation.longitude.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Zone Type:</span>
                      <Badge variant="outline">{result.zoneType}</Badge>
                    </div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    window.open(
                      `https://www.google.com/maps?q=${result.recommendedLocation.latitude},${result.recommendedLocation.longitude}`,
                      "_blank"
                    )
                  }
                >
                  Open in Google Maps
                </Button>
              </div>

              {/* Map Legend */}
              <div className="space-y-2">
                <h4 className="font-semibold">Map Legend</h4>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white">
                      ★
                    </div>
                    <span>Recommended Location</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-red-500 rounded-full border-2 border-white" />
                    <span>Barangay Center</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-500 rounded-full text-white text-xs flex items-center justify-center">
                      1
                    </div>
                    <span>Cluster Centroids</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500 rounded-full border" />
                    <span>Business Locations</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ---------------------------------------------- */}
        {/* WHY THIS LOCATION */}
        {/* ---------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle>Why This Location?</CardTitle>
            <CardDescription>
              Breakdown of factors influencing the recommendation.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {(() => {
              const anchor = getAnchorBusiness();
              if (!anchor)
                return (
                  <p className="text-sm text-gray-500">
                    Unable to compute explanation — no anchor business found.
                  </p>
                );

              const bd50 = anchor.business_density_50m ?? 0;
              const bd100 = anchor.business_density_100m ?? 0;
              const bd200 = anchor.business_density_200m ?? 0;
              const cd50 = anchor.competitor_density_50m ?? 0;
              const cd100 = anchor.competitor_density_100m ?? 0;
              const cd200 = anchor.competitor_density_200m ?? 0;

              return (
                <div className="space-y-4">
                  <p className="text-sm text-gray-700">
                    This location is near{" "}
                    <span className="font-semibold">{anchor.business_name}</span>{" "}
                    on <span className="font-semibold">{anchor.street}</span>, inside{" "}
                    {describeZone(anchor.zone_type)}. The system evaluated business
                    density, competitor strength, demand pockets, and cluster
                    centroids.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    {/* Business Presence */}
                    <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg shadow-sm">
                      <p className="text-emerald-900 font-semibold mb-1">
                        📈 Business Presence
                      </p>
                      <p className="text-emerald-800">
                        50m: {bd50} ({describeLevel(bd50)})
                      </p>
                      <p className="text-emerald-800">
                        100m: {bd100} ({describeLevel(bd100)})
                      </p>
                      <p className="text-emerald-800">
                        200m: {bd200} ({describeLevel(bd200)})
                      </p>
                    </div>

                    {/* Competitor Pressure */}
                    <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg shadow-sm">
                      <p className="text-rose-900 font-semibold mb-1">
                        ⚔️ Competitor Pressure
                      </p>
                      <p className="text-rose-800">
                        50m: {cd50} ({describeLevel(cd50)})
                      </p>
                      <p className="text-rose-800">
                        100m: {cd100} ({describeLevel(cd100)})
                      </p>
                      <p className="text-rose-800">
                        200m: {cd200} ({describeLevel(cd200)})
                      </p>
                    </div>

                    {/* Interpretation */}
                    <div className="bg-sky-50 border border-sky-200 p-3 rounded-lg shadow-sm">
                      <p className="text-sky-900 font-semibold mb-1">
                        🧠 Model Interpretation
                      </p>
                      <p className="text-sky-800">• Prioritizes streets with activity.</p>
                      <p className="text-sky-800">
                        • Favors {anchor.zone_type} zones for visibility.
                      </p>
                      <p className="text-sky-800">
                        • Avoids isolated outlier points far from centroids.
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* ---------------------------------------------- */}
        {/* COMPETITOR ANALYSIS */}
        {/* ---------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle>Competitor Analysis</CardTitle>
            <CardDescription>Market competition overview.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">

            {/* Competitor Summary */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-sm">
              <h4 className="text-blue-900 mb-2 font-semibold">
                Competitor Summary
              </h4>

              <div className="text-sm text-blue-800 space-y-1">
                <p>
                  <strong>Total Competitors:</strong>{" "}
                  {result.analysis.competitorCount}
                </p>
                <p>
                  <strong>Within 500m:</strong>{" "}
                  {result.competitorAnalysis.competitorsWithin500m}
                </p>
                <p>
                  <strong>Within 1km:</strong>{" "}
                  {result.competitorAnalysis.competitorsWithin1km}
                </p>
                <p>
                  <strong>Within 2km:</strong>{" "}
                  {result.competitorAnalysis.competitorsWithin2km}
                </p>
              </div>
            </div>

            {/* Nearest Competitor */}
            {result.competitorAnalysis.nearestCompetitor ? (
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 shadow-sm">
                <h4 className="text-orange-900 mb-2 font-semibold">
                  Nearest Competitor
                </h4>
                <div className="text-sm text-orange-800 space-y-1">
                  <p className="font-semibold">
                    {result.competitorAnalysis.nearestCompetitor.business_name}
                  </p>
                  <p>{result.competitorAnalysis.nearestCompetitor.street}</p>
                  <p className="text-xs">
                    Distance:{" "}
                    {(result.competitorAnalysis.distanceToNearest * 1000).toFixed(0)}
                    m ({result.competitorAnalysis.distanceToNearest.toFixed(2)} km)
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <h4 className="text-orange-900 mb-2 font-semibold">
                  Nearest Competitor
                </h4>
                <p className="text-sm text-orange-800">No competitor found.</p>
              </div>
            )}

            {/* Market Saturation */}
            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200 shadow-sm">
              <h4 className="text-indigo-900 mb-2 font-semibold">
                Market Saturation:{" "}
                {(result.competitorAnalysis.marketSaturation * 100).toFixed(0)}%
              </h4>

              <Progress
                value={result.competitorAnalysis.marketSaturation * 100}
                className="h-2 mb-2"
              />

              <p className="text-sm text-indigo-800">
                {result.competitorAnalysis.recommendedStrategy}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ---------------------------------------------- */}
        {/* NEARBY BUSINESSES */}
        {/* ---------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle>Nearby Businesses (10 Closest)</CardTitle>
            <CardDescription>
              Based on Haversine distance from recommended location.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="space-y-2">
              {result.nearbyBusinesses.map((nb, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                >
                  <div>
                    <h4 className="text-sm font-semibold">
                      {nb.business.business_name}
                    </h4>
                    <p className="text-xs text-gray-500">
                      {nb.business.general_category} • {nb.business.street} •{" "}
                      {nb.business.zone_type}
                    </p>
                  </div>

                  <Badge variant="secondary">
                    {(nb.distance * 1000).toFixed(0)}m
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ---------------------------------------------- */}
        {/* CLUSTER DETAILS */}
        {/* ---------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle>Cluster Analysis Details</CardTitle>
            <CardDescription>
              Distribution of businesses across clusters.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.clusters.map((cluster) => (
                <div
                  key={cluster.id}
                  className="border rounded-lg p-4 bg-white shadow-sm"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm"
                        style={{ backgroundColor: cluster.color }}
                      >
                        {cluster.id + 1}
                      </div>
                      <h4 className="font-semibold">Cluster {cluster.id + 1}</h4>
                    </div>
                    <Badge>{cluster.points.length} businesses</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Centroid Latitude</p>
                      <p>{cluster.centroid.latitude.toFixed(6)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Centroid Longitude</p>
                      <p>{cluster.centroid.longitude.toFixed(6)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </>
    )}
  </div>
);

}

