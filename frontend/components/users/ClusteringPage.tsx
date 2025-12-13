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
  FileDown,
  FileText,
  FileSpreadsheet,
  TrendingUp,
  Sparkles,
  AlertTriangle,
  ThumbsUp,
  Lightbulb,
  Store,
  Shield,
  TrendingDown,
  Zap,
  XCircle,
  AlertOctagon,
  ChevronRight,
  DollarSign,
  Users,
  Building2,
} from "lucide-react";
import { Progress } from "../ui/progress";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { LOCATION_INFO } from "../../data/businesses";
import {
  findOptimalLocation,
  ClusteringResult,
  Business,
} from "../../utils/kmeans";
import { haversineDistance } from "../../utils/haversine";
import { useActivity, logActivity } from "../../utils/activity";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { useNavigate } from "react-router-dom";
import { useKMeansStore } from "../../lib/stores/kmeansStore";
import { generateBusinessIdeaFromClustering } from "../../utils/businessIdeaGenerator";





// ---------------------------------------------------------
// TYPES & CONSTANTS (moved outside component)
// ---------------------------------------------------------
interface GridPoint {
  latitude: number;
  longitude: number;
}

type ExtendedResult = ClusteringResult & {
  gridPoints?: GridPoint[];
};

// Your new general category set — make sure DB categories match these strings
const CATEGORY_OPTIONS = [
  {
    value: "Retail",
    label: "Retail",
  },
  {
    value: "Services",
    label: "Services",
  },
  {
    value: "Restaurant",
    label: "Restaurant",
  },
  {
    value: "Food & Beverages",
    label: "Food & Beverages",
  },
  {
    value: "Merchandise / Trading",
    label: "Merchandise / Trading",
  },
  {
    value: "Entertainment / Leisure",
    label: "Entertainment / Leisure",
  },
];

// ---------------------------------------------------------------------------
// AI RECOMMENDATION TYPES (New Detailed Format)
// ---------------------------------------------------------------------------
interface TopBusiness {
  name: string;
  score: number;
  fitPercentage: number;
  opportunityLevel: string;
  shortDescription: string;
  fullDetails: string;
  preferredLocation: string;
  startupBudget: string;
  competitorPresence: string;
  businessDensityInsight: string;
}

interface ClusterSummaryItem {
  clusterId: number;
  zoneType: string; // "Commercial Zone" | "Residential Zone" | "Mixed Zone"
  friendlyName?: string; // deprecated, use zoneType
  businessCount: number;
  competitionLevel: string;
}

interface AIBusinessRecommendations {
  bestCluster: {
    clusterId: number;
    friendlyName: string;
    reason: string;
    confidence: number;
    confidenceLabel: string;
    confidenceColor: string;
  };
  topBusinesses: TopBusiness[];
  clusterSummary: ClusterSummaryItem[];
  finalSuggestion: string;
}

// ---------------------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------------------
export function ClusteringPage() {
  useActivity();

  // Zustand store for K-Means session persistence
  const kmeansStore = useKMeansStore();

  // -----------------------
  // NEW: AI business idea + category states
  // -----------------------
  const [businessIdea, setBusinessIdea] = useState<string>("");
  const [aiCategory, setAiCategory] = useState<string | null>(null);
  const [aiCategoryExplanation, setAiCategoryExplanation] = useState<
    string | null
  >(null);
  const [aiCategoryLoading, setAiCategoryLoading] = useState<boolean>(false);
  const [allowedCategories, setAllowedCategories] = useState<string[]>([]); // NEW: track valid categories
  const [categoryLockedByUser, setCategoryLockedByUser] =
    useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Selected general category (drives clustering)
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ExtendedResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [map, setMap] = useState<L.Map | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const [_aiRecommendation, setAiRecommendation] = useState<string | null>(null);
  const [_aiLoading, setAiLoading] = useState<boolean>(false);

  // NEW: AI Business Recommendations state
  const [aiBusinessRecommendations, setAiBusinessRecommendations] = useState<AIBusinessRecommendations | null>(null);
  const [aiRecommendationsLoading, setAiRecommendationsLoading] = useState<boolean>(false);

  // BUSINESS DATA
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoadingBusinesses, setIsLoadingBusinesses] =
    useState<boolean>(false);

  // ===== NEW: BUSINESS VALIDATION STATE =====
  const [businessValidation, setBusinessValidation] = useState<{
    valid: boolean;
    errorType: "none" | "prohibited" | "nonsense" | "unrecognized" | "empty";
    message: string;
  } | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);

  // ===== NEW: LIVE ANALYTICS STATE (computed from recommended location) =====
  interface LiveAnalytics {
    businessPresence: { r50: number; r100: number; r200: number };
    competitorPressure: { r50: number; r100: number; r200: number };
    competitorSummary: { total: number; within500: number; within1000: number; within2000: number };
    interpretation: string[];
  }
  const [liveAnalytics, setLiveAnalytics] = useState<LiveAnalytics | null>(null);

  // ===== NEW: COMPUTE LIVE ANALYTICS FROM RECOMMENDED LOCATION =====
  function computeLiveAnalytics(
    recommendedLocation: { latitude: number; longitude: number },
    allBusinesses: Business[],
    category: string
  ): LiveAnalytics {
    const normalizedCategory = category.trim().toLowerCase();

    // Filter competitors (same category)
    const competitors = allBusinesses.filter(
      b => b.general_category.trim().toLowerCase() === normalizedCategory
    );

    // Helper to count businesses within radius (in km)
    const countWithinRadius = (items: Business[], radiusKm: number) =>
      items.filter(b =>
        haversineDistance(recommendedLocation, { latitude: b.latitude, longitude: b.longitude }) <= radiusKm
      ).length;

    // Business Presence (all businesses near the location)
    const businessPresence = {
      r50: countWithinRadius(allBusinesses, 0.05),   // 50m
      r100: countWithinRadius(allBusinesses, 0.1),  // 100m
      r200: countWithinRadius(allBusinesses, 0.2),  // 200m
    };

    // Competitor Pressure (same category only)
    const competitorPressure = {
      r50: countWithinRadius(competitors, 0.05),
      r100: countWithinRadius(competitors, 0.1),
      r200: countWithinRadius(competitors, 0.2),
    };

    // Competitor Summary (larger radii)
    const competitorSummary = {
      total: competitors.length,
      within500: countWithinRadius(competitors, 0.5),
      within1000: countWithinRadius(competitors, 1.0),
      within2000: countWithinRadius(competitors, 2.0),
    };

    // Generate data-driven interpretation
    const interpretation = generateInterpretation(businessPresence, competitorPressure, competitorSummary);

    return { businessPresence, competitorPressure, competitorSummary, interpretation };
  }

  // ===== NEW: GENERATE AI INTERPRETATION FROM DATA =====
  function generateInterpretation(
    bp: { r50: number; r100: number; r200: number },
    cp: { r50: number; r100: number; r200: number },
    cs: { total: number; within500: number; within1000: number; within2000: number }
  ): string[] {
    const insights: string[] = [];

    // Competitor analysis
    if (cp.r50 === 0 && cp.r200 < 3) {
      insights.push("✅ Low competitive pressure — minimal direct competitors nearby.");
    } else if (cp.r50 >= 3) {
      insights.push("⚠️ High competition within 50m — differentiation is critical.");
    } else if (cp.r100 >= 5) {
      insights.push("⚠️ Moderate competition in immediate area — focus on unique value proposition.");
    }

    // Business presence analysis
    if (bp.r100 >= 10) {
      insights.push("✅ Strong commercial activity — high foot traffic expected.");
    } else if (bp.r100 >= 5) {
      insights.push("📊 Moderate business density — established commercial area.");
    } else if (bp.r100 < 3) {
      insights.push("📍 Low business density — may indicate emerging or underserved area.");
    }

    // Opportunity assessment
    if (cp.r50 === 0 && bp.r100 >= 5) {
      insights.push("🎯 Good opportunity — existing foot traffic with no direct competition.");
    } else if (cs.within500 >= 10) {
      insights.push("🔴 Saturated market within 500m — consider alternative locations.");
    }

    // Road proximity (inferred from business presence)
    if (bp.r50 >= 3) {
      insights.push("🛣️ Located near main commercial corridor.");
    }

    return insights.length > 0 ? insights : ["📊 Standard market conditions — proceed with due diligence."];
  }

  // VALIDATION (for new general categories)
  const validateCategory = (value: string) => {
    const v = value.trim();
    if (!v) return "Category cannot be empty.";
    if (v.length < 2) return "Category is too short.";
    return null;
  };




  function normalizeOpportunity(raw: string):
    "High" | "Moderate" | "Low" | "Very Low" {

    const r = raw.toLowerCase();

    if (
      r.includes("strong") ||
      r.includes("excellent") ||
      r.includes("very high") ||
      r.includes("high potential")
    )
      return "High";

    if (
      r.includes("good") ||
      r.includes("moderate") ||
      r.includes("medium")
    )
      return "Moderate";

    if (
      r.includes("low") ||
      r.includes("weak")
    )
      return "Low";

    return "Very Low";
  }


  // ---------------------------------------------------------------------------
  // LOAD BUSINESSES FROM SUPABASE
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const loadBusinesses = async () => {

      setIsLoadingBusinesses(true);
      try {
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
          .ilike("status", "active"); // ✅ FIXED

        if (error) {
          console.error(error);
          toast.error("Failed to load businesses from database.");
        } else {
          setBusinesses(data || []); // ⭐ MUST SET THE DATA
        }
      } catch (err) {
        console.error(err);
        toast.error("Unexpected error loading businesses.");
      }

      setIsLoadingBusinesses(false);
    };

    loadBusinesses();
  }, []); // ⭐ RUN ONCE, NOT PER CATEGORY

  // ===== RESTORE FROM ZUSTAND STORE ON MOUNT =====
  useEffect(() => {
    // Only restore if store has results (user navigated back)
    if (kmeansStore.hasResults && kmeansStore.recommendedLocation && kmeansStore.clusters.length > 0) {
      // Restore inputs
      if (kmeansStore.businessIdea) {
        setBusinessIdea(kmeansStore.businessIdea);
      }
      if (kmeansStore.detectedCategory) {
        setSelectedCategory(kmeansStore.detectedCategory);
        setAiCategory(kmeansStore.detectedCategory);
        if (kmeansStore.categoryReason) {
          setAiCategoryExplanation(kmeansStore.categoryReason);
        }
      }

      // Restore AI recommendations if available
      if (kmeansStore.aiRecommendations) {
        setAiBusinessRecommendations(kmeansStore.aiRecommendations);
      }

      // ===== RESTORE FULL CLUSTERING RESULTS =====
      // Reconstruct the ExtendedResult object from store data
      const restoredResult: ExtendedResult = {
        recommendedLocation: kmeansStore.recommendedLocation,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clusters: kmeansStore.clusters as any,
        zoneType: kmeansStore.zoneType,
        analysis: kmeansStore.analysis || {
          confidence: 0,
          opportunity: "Unknown",
          opportunity_score: 0,
          competitorCount: 0,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        competitorAnalysis: (kmeansStore.competitorAnalysis || {
          competitorCount: 0,
          nearestCompetitor: null,
          distanceToNearest: 0,
          competitorsWithin500m: 0,
          competitorsWithin1km: 0,
          competitorsWithin2km: 0,
          marketSaturation: 0,
          recommendedStrategy: "",
        }) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nearbyBusinesses: kmeansStore.nearbyBusinesses as any,
        gridPoints: [], // Grid points are not stored, will be empty
      };

      setResult(restoredResult);

      // Compute live analytics from restored result
      if (kmeansStore.detectedCategory) {
        const analytics = computeLiveAnalytics(
          restoredResult.recommendedLocation,
          businesses,
          kmeansStore.detectedCategory
        );
        setLiveAnalytics(analytics);
      }

      toast.success("Your previous recommendations are ready!", {
        description: "Your clustering results are ready to view.",
      });
    }
  }, [businesses.length]); // Re-run when businesses are loaded

  // Auto-switch between local dev and production
  const API_BASE = "";

  // ===== BUSINESS VALIDATION EFFECT + AUTO-CATEGORY DETECTION =====
  useEffect(() => {
    const trimmedIdea = businessIdea.trim();
    if (!trimmedIdea) {
      setBusinessValidation(null);
      setIsValidating(false);
      setAiCategory(null);
      setAiCategoryExplanation(null);
      setAllowedCategories([]);
      setSelectedCategory(""); // Reset category when idea is cleared
      return;
    }

    // ⚡ INSTANT CLIENT-SIDE SECURITY CHECK
    const PROHIBITED_KEYWORDS = [
      "spakol", "prostitution", "escort", "sexual", "trafficking",
      "drugs", "narcotics", "cannabis", "weed", "marijuana",
      "gambling", "casino", "betting", "lottery",
      "weapon", "firearm", "explosive", "bomb",
      "scam", "fraud", "cybercrime", "piracy", "fake id"
    ];

    const lowerIdea = trimmedIdea.toLowerCase();
    if (PROHIBITED_KEYWORDS.some(word => lowerIdea.includes(word))) {
      setBusinessValidation({
        valid: false,
        errorType: "prohibited",
        message: "This business idea involves restricted or illegal activities."
      });
      setIsValidating(false);
      setAiCategory(null);
      setSelectedCategory("");
      return; // 🛑 STOP HERE - Do not call API
    }

    setIsValidating(true);

    const controller = new AbortController();
    let isCurrent = true;

    const timeoutId = setTimeout(async () => {
      try {
        // First: Validate the business idea
        const validateResponse = await fetch(`${API_BASE}/api/ai/validate-business`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessIdea: trimmedIdea }),
          signal: controller.signal
        });

        if (!isCurrent) return;

        if (validateResponse.ok) {
          const validateData = await validateResponse.json();
          if (isCurrent) {
            setBusinessValidation({
              valid: validateData.valid,
              errorType: validateData.errorType || "none",
              message: validateData.message || "",
            });

            // If validation failed, don't proceed to category detection
            if (!validateData.valid) {
              setAiCategory(null);
              setSelectedCategory("");
              return;
            }
          }
        }

        // Second: Auto-detect the category using AI
        if (isCurrent) {
          const categoryResponse = await fetch(`${API_BASE}/api/ai/categories`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ businessIdea: trimmedIdea }),
            signal: controller.signal
          });

          if (!isCurrent) return;

          if (categoryResponse.ok) {
            const categoryData = await categoryResponse.json();
            if (isCurrent) {
              const detected = categoryData.primaryCategory || categoryData.category;
              const explanation = categoryData.explanation || "";
              const allowed = categoryData.allowedCategories || [];

              if (detected && detected !== "prohibited" && detected !== "no_category") {
                setAiCategory(detected);
                setAiCategoryExplanation(explanation);
                setAllowedCategories(allowed);
                setSelectedCategory(detected); // AUTO-SET the category
              } else if (detected === "prohibited") {
                setBusinessValidation({
                  valid: false,
                  errorType: "prohibited",
                  message: explanation || "This business idea is prohibited."
                });
                setAiCategory(null);
                setSelectedCategory("");
              } else if (detected === "no_category") {
                setBusinessValidation({
                  valid: false,
                  errorType: "nonsense",
                  message: explanation || "Not a recognizable business idea."
                });
                setAiCategory(null);
                setSelectedCategory("");
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError" && isCurrent) {
          // On error, be lenient
          setBusinessValidation({ valid: true, errorType: "none", message: "" });
        }
      } finally {
        if (isCurrent) setIsValidating(false);
      }
    }, 600); // Slightly longer debounce for both calls

    return () => {
      isCurrent = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [businessIdea]);

  // Manual AI category suggestion (triggered via button)
  const requestAiCategory = async () => {
    const idea = businessIdea.trim();

    if (!idea) {
      toast.error("Enter a business idea first.");
      return;
    }

    if (isValidating) {
      toast.error("Finish validation before asking AI.");
      return;
    }

    if (businessValidation && !businessValidation.valid) {
      toast.error(businessValidation.message || "Business idea is invalid.");
      return;
    }

    setAiCategoryLoading(true);
    setAiCategory(null);
    setAiCategoryExplanation(null);

    try {
      const response = await fetch(`${API_BASE}/api/ai/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessIdea: idea }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI API Error:", errorText);
        throw new Error("Failed to detect category");
      }

      const data = await response.json();
      // NEW: Use structured response format
      const detected = data.primaryCategory || data.category?.trim() || "";
      const explanation = data.explanation || "";
      const validCategories = data.allowedCategories || [];

      // 🔍 VALIDATION: Handle Prohibited
      if (detected === "prohibited") {
        setBusinessValidation({
          valid: false,
          errorType: "prohibited",
          message: explanation || "This business idea is prohibited."
        });
        setAiCategory(null);
        setAiCategoryExplanation(null);
        setAllowedCategories([]);
        toast.error("Business idea is prohibited.");
        return;
      }

      // 🔍 VALIDATION: Handle No Category
      if (detected === "no_category") {
        setBusinessValidation({
          valid: false,
          errorType: "nonsense",
          message: explanation || "This does not appear to be a valid business idea."
        });
        setAiCategory(null);
        setAiCategoryExplanation(null);
        setAllowedCategories([]);
        toast.error("Could not categorize this business idea.");
        return;
      }

      if (detected) {
        setAiCategory(detected);
        setAiCategoryExplanation(explanation);
        setAllowedCategories(validCategories); // NEW: store allowed categories

        // Clear any previous validation errors since we got a good result
        setBusinessValidation({ valid: true, errorType: "none", message: "" });

        if (!categoryLockedByUser) {
          setSelectedCategory(detected);
        }
      } else {
        toast.error("AI could not suggest a category.");
      }
    } catch (err) {
      console.error("AI Category Error:", err);
      toast.error("Failed to fetch AI category.");
    } finally {
      setAiCategoryLoading(false);
    }
  };

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const BRGY_BOUNDS = {
    minLat: 14.8338,   // South boundary
    maxLat: 14.8413,   // North boundary
    minLng: 120.9518,  // West boundary
    maxLng: 120.9608,  // East boundary
  };

  function clampToStaCruz(lat: number, lng: number) {
    return {
      latitude: Math.min(Math.max(lat, BRGY_BOUNDS.minLat), BRGY_BOUNDS.maxLat),
      longitude: Math.min(Math.max(lng, BRGY_BOUNDS.minLng), BRGY_BOUNDS.maxLng),
    };
  }


  const createMap = () => {
    if (!result || !mapRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // ⭐ Cluster Centroids + Business Points
    result.clusters.forEach((cluster) => {
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

      // ⭐ Clamp centroid ONLY FOR UI
      const safeCentroid = clampToStaCruz(
        cluster.centroid.latitude,
        cluster.centroid.longitude
      );

      // ⭐ Draw centroid inside Sta. Cruz bounds
      L.marker([safeCentroid.latitude, safeCentroid.longitude], {
        icon: clusterIcon,
      })
        .addTo(newMap)
        .bindPopup(`
      <div style="font-family:system-ui;">
        <strong style="color:${cluster.color};">
          Cluster ${cluster.id + 1} Centroid
        </strong><br/>
        <small>Businesses: ${cluster.points.length}</small><br/>
        <small>Lat: ${safeCentroid.latitude.toFixed(6)}</small><br/>
        <small>Lon: ${safeCentroid.longitude.toFixed(6)}</small>
      </div>
    `);

      // ⭐ Clamp each business point for UI
      cluster.points.forEach((point) => {
        const safePoint = clampToStaCruz(point.latitude, point.longitude);

        L.circleMarker([safePoint.latitude, safePoint.longitude], {
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
          <span style="color:${cluster.color};">
            ${point.business.general_category}
          </span><br/>
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

    // VALIDATION: If business idea is provided, validate category match
    if (businessIdea.trim()) {
      // If AI was already used and allowedCategories populated
      if (allowedCategories.length > 0) {
        if (!allowedCategories.includes(categoryToAnalyze)) {
          const primaryCat = aiCategory || allowedCategories[0];
          toast.error(`Incorrect Category: "${businessIdea}" belongs to "${primaryCat}". You selected "${categoryToAnalyze}" which is not allowed.`);
          setBusinessValidation({
            valid: false,
            errorType: "unrecognized",
            message: `This business idea should be in "${primaryCat}", not "${categoryToAnalyze}".`
          });
          return;
        }
      } else {
        // AI wasn't used yet - call API to validate before proceeding
        try {
          setIsProcessing(true);
          setProgress(5);

          const response = await fetch(`${API_BASE}/api/ai/categories`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              businessIdea: businessIdea.trim(),
              selectedCategory: categoryToAnalyze
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const allowed = data.allowedCategories || [];
            const primaryCat = data.primaryCategory || data.category;

            // Check if prohibited or no_category
            if (primaryCat === "prohibited") {
              setIsProcessing(false);
              toast.error("This business idea is prohibited.");
              setBusinessValidation({
                valid: false,
                errorType: "prohibited",
                message: data.explanation || "This business idea is prohibited."
              });
              return;
            }

            if (primaryCat === "no_category") {
              setIsProcessing(false);
              toast.error("Could not recognize this business idea.");
              setBusinessValidation({
                valid: false,
                errorType: "nonsense",
                message: data.explanation || "Not a valid business idea."
              });
              return;
            }

            // Store for future reference
            setAllowedCategories(allowed);
            setAiCategory(primaryCat);

            // Validate selected category
            if (allowed.length > 0 && !allowed.includes(categoryToAnalyze)) {
              setIsProcessing(false);
              toast.error(`Incorrect Category: "${businessIdea}" belongs to "${primaryCat}". You selected "${categoryToAnalyze}" which is not allowed.`);
              setBusinessValidation({
                valid: false,
                errorType: "unrecognized",
                message: `This business idea should be in "${primaryCat}", not "${categoryToAnalyze}".`
              });
              return;
            }
          }
        } catch (err) {
          console.error("Category validation error:", err);
          // Continue with clustering if validation API fails
        }
      }
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
      await new Promise((r) => setTimeout(r, step.delay));
      setProgress(step.progress);
    }



    try {


      const clusteringResult = findOptimalLocation(
        businesses as Business[],
        categoryToAnalyze
      );

      // ✅ Inject grid points so map can render them
      const clusteringResultWithGrid = clusteringResult as unknown as Record<string, unknown>;
      const enhancedResult: ExtendedResult = {
        ...clusteringResult,
        gridPoints:
          (clusteringResultWithGrid.grid as GridPoint[]) ||
          (clusteringResultWithGrid.gridPoints as GridPoint[]) ||
          []


      };




      setResult(enhancedResult);

      // ===== SAVE TO ZUSTAND STORE FOR CROSS-PAGE PERSISTENCE =====
      kmeansStore.setBusinessIdea(businessIdea);
      kmeansStore.setDetectedCategory(selectedCategory, aiCategoryExplanation || "");
      kmeansStore.setClusteringResults({
        recommendedLocation: enhancedResult.recommendedLocation,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clusters: enhancedResult.clusters as any,
        zoneType: enhancedResult.zoneType,
        analysis: {
          opportunity: enhancedResult.analysis.opportunity,
          opportunity_score: enhancedResult.analysis.opportunity_score ?? 0,
          confidence: enhancedResult.analysis.confidence,
          competitorCount: enhancedResult.competitorAnalysis?.competitorsWithin500m || 0,
        },
        competitorAnalysis: enhancedResult.competitorAnalysis || {
          competitorsWithin500m: 0,
          competitorsWithin1km: 0,
          competitorsWithin2km: 0,
          nearestCompetitor: null,
          distanceToNearest: 0,
          marketSaturation: 0,
          recommendedStrategy: "",
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nearbyBusinesses: enhancedResult.nearbyBusinesses as any,
      });

      // ===== NEW: COMPUTE LIVE ANALYTICS FROM RECOMMENDED LOCATION =====
      const analytics = computeLiveAnalytics(
        enhancedResult.recommendedLocation,
        businesses,
        categoryToAnalyze
      );
      setLiveAnalytics(analytics);

      await supabase.from("clustering_opportunities").insert({
        // ✔ must match DB column: business_category
        business_category: categoryToAnalyze,

        // ✔ created_at column already has default = now()
        //   (optional, but allowed)
        created_at: new Date().toISOString(),

        // ✔ recommended business location
        recommended_lat: enhancedResult.recommendedLocation.latitude,
        recommended_lng: enhancedResult.recommendedLocation.longitude,

        // ✔ correct zone column
        zone_type: enhancedResult.zoneType,

        // ✔ your computed scores
        opportunity: enhancedResult.analysis.opportunity, // only if this exists
        opportunity_score: enhancedResult.analysis.opportunity_score,
        confidence: enhancedResult.analysis.confidence,

        // ✔ new columns (your schema supports these)
        num_clusters: enhancedResult.clusters.length,
        locations: enhancedResult.clusters.flatMap((cluster) =>
          cluster.points.map((p) => ({
            street: p.business.street,
            general_category: p.business.general_category,
            business_density_200m: p.business.business_density_200m,
            competitor_density_200m: p.business.competitor_density_200m,
            zone_type: p.business.zone_type,
            latitude: p.business.latitude,
            longitude: p.business.longitude,
            cluster: cluster.id + 1,
            score: enhancedResult.analysis.opportunity_score,
          }))
        ),
      });


      logActivity("Ran Clustering", { page: "clustering" });

      // ✅ Increment analyses_count in user's profile
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Get current count first
          const { data: profile } = await supabase
            .from("profiles")
            .select("analyses_count")
            .eq("id", user.id)
            .single();

          const currentCount = profile?.analyses_count || 0;

          // Increment the count
          await supabase
            .from("profiles")
            .update({ analyses_count: currentCount + 1 })
            .eq("id", user.id);
        }
      } catch (err) {
        console.error("Error updating analyses count:", err);
        // Don't fail clustering if this fails
      }

      // ========================================
      // 🤖 FETCH AI BUSINESS RECOMMENDATIONS
      // ========================================
      setAiRecommendationsLoading(true);
      setAiBusinessRecommendations(null);

      try {
        // Get competitors from nearby businesses
        const nearbyCompetitors = enhancedResult.nearbyBusinesses.filter(
          (nb) => nb.business.general_category === categoryToAnalyze
        );

        // Calculate density metrics from the recommended location's nearest businesses
        const businessDensity = {
          density_50m: enhancedResult.nearbyBusinesses.filter(nb => nb.distance <= 0.05).length,
          density_100m: enhancedResult.nearbyBusinesses.filter(nb => nb.distance <= 0.1).length,
          density_200m: enhancedResult.nearbyBusinesses.filter(nb => nb.distance <= 0.2).length,
        };

        const competitorDensity = {
          competitor_50m: nearbyCompetitors.filter(nb => nb.distance <= 0.05).length,
          competitor_100m: nearbyCompetitors.filter(nb => nb.distance <= 0.1).length,
          competitor_200m: nearbyCompetitors.filter(nb => nb.distance <= 0.2).length,
        };

        // Determine dominant category in the cluster
        const categoryCounts: Record<string, number> = {};
        enhancedResult.nearbyBusinesses.forEach(nb => {
          const cat = nb.business.general_category;
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });
        const dominantCategory = Object.entries(categoryCounts)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || categoryToAnalyze;

        const aiResponse = await fetch("/api/ai/business-recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessIdea: businessIdea || null,
            coordinates: {
              latitude: enhancedResult.recommendedLocation.latitude,
              longitude: enhancedResult.recommendedLocation.longitude,
            },
            zoneType: enhancedResult.zoneType,
            generalCategory: categoryToAnalyze,
            businessDensity,
            competitorDensity,
            clusterAnalytics: {
              clusterProfile: `${enhancedResult.clusters.length} clusters identified`,
              dominantCategory,
              totalBusinesses: enhancedResult.nearbyBusinesses.length,
            },
            nearbyBusinesses: enhancedResult.nearbyBusinesses.slice(0, 15),
            nearbyCompetitors: nearbyCompetitors.slice(0, 10),
            confidence: enhancedResult.analysis.confidence,
            opportunity: enhancedResult.analysis.opportunity,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          console.log("AI Response:", aiData); // Debug log
          if (aiData.success && aiData.recommendations) {
            setAiBusinessRecommendations(aiData.recommendations);
            // Save to Zustand store for cross-page persistence
            kmeansStore.setAIRecommendations(aiData.recommendations);
          } else {
            console.error("AI response missing data:", aiData);
            toast.error("AI recommendations unavailable", {
              description: aiData.error || "Response format issue",
            });
          }
        } else {
          const errorText = await aiResponse.text();
          console.error("AI API failed:", aiResponse.status, errorText);
          toast.error("AI recommendations failed", {
            description: `Status ${aiResponse.status}`,
          });
        }
      } catch (aiErr) {
        console.error("AI Recommendations Error:", aiErr);
        toast.error("Failed to get AI recommendations");
        // Non-blocking - clustering still succeeded
      } finally {
        setAiRecommendationsLoading(false);
      }


    } catch (err) {
      console.error(err);
      toast.error("Failed to run clustering.");

    } finally {
      setIsProcessing(false);
      toast.success("Clustering Completed Successfully! 🎉", {
        description: "You can now view the summarized business opportunities.",
      });
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


  async function _generateAIRecommendation(result: ExtendedResult) {
    setAiLoading(true);

    const prompt = `
    You are an AI business strategist.
    Provide simple recommendations for opening a business in this area.

    Zone Type: ${result.zoneType}
    Opportunity: ${result.analysis.opportunity}
    Confidence: ${(result.analysis.confidence * 100).toFixed(0)}%

    Nearby Businesses:
    ${result.nearbyBusinesses.slice(0, 10).map((b) =>
      `- ${b.business.business_name} (${b.business.general_category})`
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

  // ---------------------------------------------
  // EXPORT FUNCTIONS
  // ---------------------------------------------

  const exportPDF = async () => {
    if (!result) {
      toast.error("No clustering results to export");
      return;
    }

    toast.message("Generating PDF report...");

    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPos = margin;
      let pageNum = 1;

      const addFooter = () => {
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Page ${pageNum}`, pageWidth / 2, pageHeight - 8, { align: "center" });
        pdf.text("Generated by Strategic Store Placement System", pageWidth / 2, pageHeight - 4, { align: "center" });
      };

      const checkNewPage = (requiredSpace: number = 30) => {
        if (yPos > pageHeight - requiredSpace) {
          addFooter();
          pdf.addPage();
          pageNum++;
          yPos = margin;
        }
      };

      // ===== TITLE =====
      pdf.setFontSize(22);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(59, 130, 246);
      pdf.text("Clustering Report", pageWidth / 2, yPos, { align: "center" });
      yPos += 8;

      pdf.setFontSize(11);
      pdf.setTextColor(100, 100, 100);
      pdf.text("Strategic Store Placement System", pageWidth / 2, yPos, { align: "center" });
      yPos += 12;

      // ===== HEADER INFO =====
      pdf.setFillColor(245, 247, 250);
      pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 28, 3, 3, "F");
      yPos += 7;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(60, 60, 60);
      const timestamp = new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
      pdf.text(`Date Generated: ${timestamp}`, margin + 5, yPos);
      yPos += 6;
      pdf.text(`Business Idea: ${businessIdea || "Not specified"}`, margin + 5, yPos);
      yPos += 6;
      pdf.text(`Category: ${selectedCategory || "Not specified"}`, margin + 5, yPos);
      yPos += 15;

      // ===== SECTION 1: Recommended Location =====
      pdf.setFillColor(59, 130, 246);
      pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 10, 2, 2, "F");
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text("SECTION 1: Recommended Location", margin + 5, yPos + 7);
      yPos += 18;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(40, 40, 40);
      const locationData = [
        `Latitude: ${result.recommendedLocation.latitude.toFixed(6)}`,
        `Longitude: ${result.recommendedLocation.longitude.toFixed(6)}`,
        `Zone Type: ${result.zoneType}`,
        `Confidence: ${((result.analysis.confidence ?? 0) * 100).toFixed(0)}%`,
        `Opportunity Level: ${result.analysis.opportunity}`,
      ];
      locationData.forEach(line => {
        pdf.text(`• ${line}`, margin + 5, yPos);
        yPos += 6;
      });
      yPos += 8;

      // ===== SECTION 2: Competitor Analysis =====
      checkNewPage(60);
      pdf.setFillColor(139, 92, 246);
      pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 10, 2, 2, "F");
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text("SECTION 2: Competitor Analysis", margin + 5, yPos + 7);
      yPos += 18;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(40, 40, 40);
      const competitorData = [
        `Total Competitors: ${result.analysis.competitorCount}`,
        `Within 500m: ${result.competitorAnalysis.competitorsWithin500m}`,
        `Within 1km: ${result.competitorAnalysis.competitorsWithin1km}`,
        `Within 2km: ${result.competitorAnalysis.competitorsWithin2km}`,
      ];
      competitorData.forEach(line => {
        pdf.text(`• ${line}`, margin + 5, yPos);
        yPos += 6;
      });
      yPos += 4;

      const strategy = result.competitorAnalysis.recommendedStrategy || "No strategy available";
      pdf.setFontSize(9);
      const strategyLines = pdf.splitTextToSize(`Strategy: ${strategy}`, pageWidth - margin * 2 - 10);
      strategyLines.forEach((line: string) => {
        checkNewPage(10);
        pdf.text(line, margin + 5, yPos);
        yPos += 5;
      });
      yPos += 8;

      // ===== SECTION 3: Cluster Summary =====
      checkNewPage(80);
      pdf.setFillColor(16, 185, 129);
      pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 10, 2, 2, "F");
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text("SECTION 3: Cluster Summary (Zone Distribution)", margin + 5, yPos + 7);
      yPos += 18;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(40, 40, 40);

      if (aiBusinessRecommendations?.clusterSummary?.length) {
        aiBusinessRecommendations.clusterSummary.forEach(cluster => {
          checkNewPage(12);
          const zoneLabel = cluster.zoneType || `Cluster ${cluster.clusterId}`;
          pdf.text(`• ${zoneLabel}: ${cluster.businessCount} businesses (${cluster.competitionLevel} competition)`, margin + 5, yPos);
          yPos += 7;
        });
      } else {
        pdf.text("• No cluster summary available", margin + 5, yPos);
        yPos += 7;
      }
      yPos += 8;

      // ===== SECTION 4: AI Business Recommendations =====
      checkNewPage(100);
      pdf.setFillColor(245, 158, 11);
      pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 10, 2, 2, "F");
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text("SECTION 4: AI Business Recommendations", margin + 5, yPos + 7);
      yPos += 18;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(40, 40, 40);

      if (aiBusinessRecommendations?.topBusinesses?.length) {
        aiBusinessRecommendations.topBusinesses.forEach((biz, idx) => {
          checkNewPage(35);
          pdf.setFont("helvetica", "bold");
          pdf.text(`${idx + 1}. ${biz.name}`, margin + 5, yPos);
          yPos += 6;

          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
          pdf.text(`Score: ${biz.score}/100 | Fit: ${biz.fitPercentage}% | ${biz.opportunityLevel}`, margin + 10, yPos);
          yPos += 5;

          const descLines = pdf.splitTextToSize(biz.shortDescription || "", pageWidth - margin * 2 - 15);
          descLines.forEach((line: string) => {
            checkNewPage(8);
            pdf.text(line, margin + 10, yPos);
            yPos += 4;
          });

          pdf.text(`Budget: ${biz.startupBudget || "N/A"}`, margin + 10, yPos);
          yPos += 10;
          pdf.setFontSize(10);
        });
      } else {
        pdf.text("• No AI recommendations available. Run clustering first.", margin + 5, yPos);
        yPos += 7;
      }
      yPos += 5;

      // ===== SECTION 5: Final Suggestion =====
      if (aiBusinessRecommendations?.finalSuggestion) {
        checkNewPage(50);
        pdf.setFillColor(99, 102, 241);
        pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 10, 2, 2, "F");
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(255, 255, 255);
        pdf.text("SECTION 5: Final Suggestion", margin + 5, yPos + 7);
        yPos += 18;

        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(40, 40, 40);
        const suggestionLines = pdf.splitTextToSize(aiBusinessRecommendations.finalSuggestion, pageWidth - margin * 2 - 10);
        suggestionLines.forEach((line: string) => {
          checkNewPage(8);
          pdf.text(line, margin + 5, yPos);
          yPos += 5;
        });
      }

      addFooter();
      const fileName = `Clustering_Report_${selectedCategory?.replace(/\s+/g, "_") || "analysis"}_${new Date().toISOString().split("T")[0]}.pdf`;
      pdf.save(fileName);
      toast.success("PDF report exported successfully!");
      logActivity("Exported Clustering PDF", { pages: pageNum });
    } catch (error) {
      console.error("PDF Export Error:", error);
      toast.error("Failed to generate PDF.");
    }
  };

  const exportCSV = () => {
    const rows = [
      ["Field", "Value"],
      ["Latitude", result?.recommendedLocation.latitude],
      ["Longitude", result?.recommendedLocation.longitude],
      ["Zone Type", result?.zoneType],
      ["Confidence", ((result?.analysis.confidence ?? 0) * 100).toFixed(0) + "%"],
      ["Opportunity", result?.analysis.opportunity],
      ["Total Competitors", result?.analysis.competitorCount],
      ["Within 500m", result?.competitorAnalysis.competitorsWithin500m],
      ["Within 1km", result?.competitorAnalysis.competitorsWithin1km],
      ["Within 2km", result?.competitorAnalysis.competitorsWithin2km],
    ];

    const csv = rows.map((r) => r.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "business-location-report.csv";
    a.click();
  };

  const exportExcel = async () => {
    if (!result) {
      toast.error("No clustering results to export");
      return;
    }

    const workbook = XLSX.utils.book_new();

    // Calculate density metrics from nearby businesses
    const biz50m = result.nearbyBusinesses.filter(nb => nb.distance <= 0.05).length;
    const biz100m = result.nearbyBusinesses.filter(nb => nb.distance <= 0.1).length;
    const biz200m = result.nearbyBusinesses.filter(nb => nb.distance <= 0.2).length;

    // Calculate competitor metrics
    const comp50m = result.competitorAnalysis.competitorsWithin500m || 0;
    const comp100m = result.competitorAnalysis.competitorsWithin1km || 0;
    const comp200m = result.competitorAnalysis.competitorsWithin2km || 0;

    // ===== SHEET 1: Report =====
    const reportData = [
      ["CLUSTERING REPORT"],
      ["Strategic Store Placement System"],
      [""],
      ["Generated", new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })],
      ["Business Idea", businessIdea || "Not specified"],
      ["Category", selectedCategory || "Not specified"],
      [""],
      ["LOCATION DATA"],
      ["Latitude", result.recommendedLocation.latitude.toFixed(6)],
      ["Longitude", result.recommendedLocation.longitude.toFixed(6)],
      ["Zone Type", result.zoneType],
      ["Confidence", ((result.analysis.confidence ?? 0) * 100).toFixed(0) + "%"],
      ["Opportunity", result.analysis.opportunity],
      [""],
      ["BUSINESS PRESENCE"],
      ["Within 50m", `${biz50m} businesses`],
      ["Within 100m", `${biz100m} businesses`],
      ["Within 200m", `${biz200m} businesses`],
      [""],
      ["COMPETITOR PRESSURE"],
      ["Within 500m", `${comp50m} competitors`],
      ["Within 1km", `${comp100m} competitors`],
      ["Within 2km", `${comp200m} competitors`],
      [""],
      ["STRATEGY"],
      [result.competitorAnalysis.recommendedStrategy || "No strategy available"],
    ];
    const reportSheet = XLSX.utils.aoa_to_sheet(reportData);
    reportSheet["!cols"] = [{ wch: 20 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(workbook, reportSheet, "Report");

    // ===== SHEET 2: AI Business Recommendation =====
    const aiRecData = [
      ["AI BUSINESS RECOMMENDATION"],
      [""],
      ["Business Idea", businessIdea || "Not specified"],
      ["Zone Type", result.zoneType],
      [""],
    ];

    if (aiBusinessRecommendations?.bestCluster) {
      const bc = aiBusinessRecommendations.bestCluster;
      aiRecData.push(
        ["BEST CLUSTER ANALYSIS"],
        ["Zone", bc.friendlyName || "N/A"],
        ["Confidence", `${bc.confidence}%`],
        ["Rating", bc.confidenceLabel],
        ["Reason", bc.reason],
        [""]
      );
    }

    if (aiBusinessRecommendations?.finalSuggestion) {
      aiRecData.push(
        ["FINAL RECOMMENDATION"],
        [aiBusinessRecommendations.finalSuggestion],
        [""]
      );
    }

    // Add cluster summary
    if (aiBusinessRecommendations?.clusterSummary?.length) {
      aiRecData.push(["ZONE DISTRIBUTION"]);
      aiBusinessRecommendations.clusterSummary.forEach(cluster => {
        aiRecData.push([
          cluster.zoneType || `Cluster ${cluster.clusterId}`,
          `${cluster.businessCount} businesses, ${cluster.competitionLevel} competition`
        ]);
      });
    }

    const aiRecSheet = XLSX.utils.aoa_to_sheet(aiRecData);
    aiRecSheet["!cols"] = [{ wch: 25 }, { wch: 70 }];
    XLSX.utils.book_append_sheet(workbook, aiRecSheet, "AI Business Recommendation");

    // ===== SHEET 3: Top 3 Recommended Businesses =====
    const top3Data = [
      ["TOP 3 RECOMMENDED BUSINESSES"],
      ["Based on clustering analysis and AI evaluation"],
      [""],
      ["Rank", "Business Type", "Reason", "Success Potential", "Score", "Startup Budget"],
    ];

    if (aiBusinessRecommendations?.topBusinesses?.length) {
      aiBusinessRecommendations.topBusinesses.forEach((biz, idx) => {
        // Map opportunity level to success potential
        const successPotential = biz.opportunityLevel?.includes("Excellent") ? "High" :
          biz.opportunityLevel?.includes("Strong") ? "High" :
            biz.opportunityLevel?.includes("Moderate") ? "Medium" : "Low";

        top3Data.push([
          `Business #${idx + 1}`,
          biz.name,
          biz.shortDescription || biz.fullDetails || "N/A",
          successPotential,
          `${biz.score}/100`,
          biz.startupBudget || "N/A"
        ]);
      });
    } else {
      top3Data.push(["", "No AI recommendations available", "Run clustering first", "", "", ""]);
    }

    top3Data.push(
      [""],
      ["KEY FACTORS SUMMARY"],
      ["Demand", biz200m > 10 ? "High foot traffic area" : biz200m > 5 ? "Moderate activity" : "Low density area"],
      ["Competition", comp50m === 0 ? "No direct competitors - excellent opportunity" : comp50m <= 3 ? "Manageable competition" : "High competition - differentiation needed"],
      ["Foot Traffic", biz100m > 8 ? "High" : biz100m > 3 ? "Medium" : "Low"],
      ["Zone Fit", result.zoneType]
    );

    const top3Sheet = XLSX.utils.aoa_to_sheet(top3Data);
    top3Sheet["!cols"] = [{ wch: 12 }, { wch: 25 }, { wch: 50 }, { wch: 18 }, { wch: 10 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(workbook, top3Sheet, "Top 3 Businesses");

    XLSX.writeFile(workbook, `Clustering_Report_${selectedCategory?.replace(/\s+/g, "_") || "analysis"}_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Excel report exported (3 sheets)!");
    logActivity("Exported Clustering Excel", { sheets: 3 });
  };


  if (isLoadingBusinesses) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto animate-pulse">
              <Target className="w-8 h-8 text-white" />
            </div>
            <div className="absolute inset-0 w-16 h-16 mx-auto rounded-full border-4 border-emerald-200 border-t-emerald-500 animate-spin" />
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-900">Loading Clustering Engine</p>
            <p className="text-sm text-gray-500">Preparing business data for analysis...</p>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="page-wrapper space-y-8">

      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-emerald-600 via-teal-600 to-cyan-700 p-8 text-white shadow-xl">
        <div className="absolute inset-0 bg-white/5 mask-[radial-gradient(ellipse_at_center,black_50%,transparent_100%)]" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Target className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Business Recommendation</h1>
              <p className="text-emerald-100">Find the best business idea and location based on your input</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-6">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg backdrop-blur-sm">
              <MapPin className="w-4 h-4" />
              <span className="text-sm font-medium">{businesses.length} Active Businesses</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg backdrop-blur-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">Smart Location Analysis</span>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      </div>

      {/* ---------------------------------------------- */}
      {/* CONFIG CARD */}
      {/* ---------------------------------------------- */}
      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
        <CardHeader className="bg-linear-to-r from-gray-50 to-slate-50 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-linear-to-br from-emerald-500 to-teal-600 rounded-xl text-white shadow-lg shadow-emerald-200">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Your Business Idea</CardTitle>
              <CardDescription className="text-gray-600">
                Tell us the business you want, or let us suggest one for you
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">

          {/* ---------------------------------------------- */}
          {/* PREMIUM AI BUSINESS INPUT BLOCK */}
          {/* ---------------------------------------------- */}
          <div className="space-y-5 bg-linear-to-br from-emerald-50/50 via-white to-teal-50/50 p-6 rounded-2xl border border-emerald-100 shadow-sm">

            {/* BUSINESS IDEA INPUT */}
            <div className="space-y-3">
              <Label htmlFor="businessIdea" className="flex items-center gap-2 font-semibold text-gray-800">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold">1</span>
                Your Business Idea
              </Label>

              <div className="relative">
                <Input
                  id="businessIdea"
                  type="text"
                  placeholder='e.g. "Milk Tea Shop", "Laundry Hub", "Grocery Store"'
                  value={businessIdea}
                  onChange={(e) => {
                    setBusinessIdea(e.target.value);
                    setCategoryLockedByUser(false);
                    setAiCategory(null);
                    setAiCategoryExplanation(null);
                  }}
                  className={`h-12 pl-4 pr-12 bg-white border-gray-200 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 rounded-xl shadow-sm text-base ${businessValidation && !businessValidation.valid
                    ? 'border-red-400 focus-visible:ring-red-400 focus-visible:border-red-400'
                    : ''
                    }`}
                />
                {/* Validation Status Icon */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isValidating ? (
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  ) : businessIdea && businessValidation?.valid ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : businessIdea && businessValidation && !businessValidation.valid ? (
                    <XCircle className="w-5 h-5 text-red-500" />
                  ) : null}
                </div>
              </div>

              {/* Validation Error Messages */}
              {businessValidation && !businessValidation.valid && (
                <div className={`flex items-start gap-2 p-3 rounded-lg border ${businessValidation.errorType === 'prohibited'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : businessValidation.errorType === 'nonsense'
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-orange-50 border-orange-200 text-orange-700'
                  }`}>
                  <AlertOctagon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{businessValidation.message}</p>
                </div>
              )}

              {/* Success hint */}
              {(!businessValidation || businessValidation.valid) && (
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Need help? Click "Suggest with AI" to get a category for your idea.
                </p>
              )}
            </div>

            {/* CATEGORY - AUTO-DETECTED BY AI */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2 font-semibold text-gray-800">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold">2</span>
                Suggested Business Type
              </Label>

              <p className="text-xs text-gray-500 mb-2">
                Based on your idea, we identify the most suitable business type for you.
              </p>

              {/* Show loading state while validating/detecting */}
              {isValidating ? (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                  </div>
                  <span className="text-sm font-medium text-emerald-700">Finding the best business type for you...</span>
                </div>
              ) : aiCategory && selectedCategory ? (
                /* Show detected category */
                <div className="p-4 rounded-xl border bg-linear-to-r from-emerald-50 to-teal-50 border-emerald-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                      <span className="font-semibold text-emerald-800">AI Detected Category</span>
                    </div>

                    <Badge className="bg-linear-to-r from-emerald-500 to-teal-500 text-white border-0 px-4 py-1.5 text-sm shadow-md">
                      {selectedCategory}
                    </Badge>
                  </div>

                  {/* WHY THIS CATEGORY (EXPANDABLE) */}
                  {aiCategoryExplanation && (
                    <details className="mt-3 text-gray-700">
                      <summary className="cursor-pointer text-sm font-medium text-emerald-700 hover:text-emerald-800 transition-colors">
                        ✨ Why this category?
                      </summary>
                      <p className="text-sm mt-2 text-gray-600 bg-white/60 p-3 rounded-lg">
                        {aiCategoryExplanation}
                      </p>
                    </details>
                  )}

                  {/* Show allowed categories if multiple */}
                  {allowedCategories.length > 1 && (
                    <div className="mt-3 pt-3 border-t border-emerald-200">
                      <p className="text-xs text-gray-500">
                        Also valid for this idea: {allowedCategories.filter(c => c !== selectedCategory).join(", ")}
                      </p>
                    </div>
                  )}
                </div>
              ) : businessValidation && !businessValidation.valid ? (
                /* Show error state */
                <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                    <XCircle className="w-4 h-4 text-red-600" />
                  </div>
                  <span className="text-sm font-medium text-red-700">{businessValidation.message}</span>
                </div>
              ) : (
                /* Prompt to enter business idea */
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-gray-500" />
                  </div>
                  <span className="text-sm text-gray-500">Enter your business idea above to auto-detect the category.</span>
                </div>
              )}
            </div>
          </div>

          {/* AUTO CLUSTERING NOTICE */}
          <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="p-2 bg-slate-200 rounded-lg">
              <Target className="w-4 h-4 text-slate-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">Automatic Clustering Mode</div>
              <div className="text-sm text-gray-500">
                The system automatically determines the optimal number of clusters for maximum accuracy.
              </div>
            </div>
          </div>

          {/* RUN BUTTON */}
          {(() => {
            const isInvalid = !!(businessValidation && !businessValidation.valid);
            const isDisabled = isProcessing || isValidating || !selectedCategory || selectedCategory.trim() === "" || isInvalid;
            return (
              <Button
                onClick={handleRunClustering}
                disabled={isDisabled}
                className={`w-full h-14 text-lg font-semibold rounded-xl transition-all duration-300 ${isInvalid
                  ? 'bg-gray-400 cursor-not-allowed opacity-60'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
                  }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Finding the best business options for you...
                  </>
                ) : isValidating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Checking your business idea...
                  </>
                ) : isInvalid ? (
                  <>
                    <XCircle className="w-5 h-5 mr-2" /> Invalid Business Idea
                  </>
                ) : (
                  <>
                    <Target className="w-5 h-5 mr-2" /> Find the Best Business for Your Idea
                  </>
                )}
              </Button>
            );
          })()}

          {/* PROGRESS BAR */}
          {isProcessing && (
            <div className="space-y-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-emerald-700">Finding the best business options for you...</span>
                <span className="font-bold text-emerald-600">{progress}%</span>
              </div>
              <Progress value={progress} className="h-3 bg-emerald-100" />
              <p className="text-xs text-gray-500">Analyzing locations and opportunities for your business</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------------------------------------------- */}
      {/* RESULT SECTION */}
      {/* ---------------------------------------------- */}
      {result && (
        <>
          {/* Success Alert */}
          <div className={`relative overflow-hidden rounded-2xl p-6 shadow-lg ${getConfidenceBg(result.analysis.confidence)} border`}>
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${result.analysis.confidence >= 0.8 ? 'bg-emerald-500' : result.analysis.confidence >= 0.6 ? 'bg-amber-500' : 'bg-red-500'} text-white shadow-lg`}>
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className={`text-xl font-bold mb-1 ${getConfidenceColor(result.analysis.confidence)}`}>
                  Analysis Complete — {(result.analysis.confidence * 100).toFixed(0)}% Confidence
                </h3>
                <p className="text-gray-600">{result.analysis.opportunity}</p>
              </div>
              <Badge className={`${result.analysis.confidence >= 0.8 ? 'bg-emerald-500' : result.analysis.confidence >= 0.6 ? 'bg-amber-500' : 'bg-red-500'} text-white border-0 px-4 py-2 text-lg`}>
                {normalizeOpportunity(result.analysis.opportunity)}
              </Badge>
            </div>
          </div>

          {/* ---------------------------------------------- */}
          {/* MAP VISUALIZATION */}
          {/* ---------------------------------------------- */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-linear-to-r from-slate-50 to-gray-50 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-linear-to-br from-blue-500 to-indigo-600 rounded-xl text-white shadow-lg shadow-blue-200">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-xl">Recommended Business Location</CardTitle>
                  <CardDescription>
                    Interactive map showing clusters and the AI-optimized location
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div
                ref={mapRef}
                className="w-full h-[500px] rounded-xl border-2 border-gray-100 mb-6 shadow-inner"
                style={{ zIndex: 0 }}
              />


              {/* Coordinate Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="flex items-center gap-2 font-semibold text-gray-800 text-lg">
                    <Navigation className="w-5 h-5 text-blue-500" />
                    Location Coordinates
                  </h4>

                  <div className="bg-linear-to-br from-slate-50 to-gray-50 p-5 rounded-xl border shadow-sm">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-white rounded-lg border">
                        <span className="text-gray-500 font-medium">Latitude</span>
                        <span className="font-mono font-semibold text-gray-900">{result.recommendedLocation.latitude.toFixed(6)}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white rounded-lg border">
                        <span className="text-gray-500 font-medium">Longitude</span>
                        <span className="font-mono font-semibold text-gray-900">{result.recommendedLocation.longitude.toFixed(6)}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white rounded-lg border">
                        <span className="text-gray-500 font-medium">Zone Type</span>
                        <Badge variant="outline" className="font-semibold">{result.zoneType}</Badge>
                      </div>
                    </div>
                  </div>


                  <Button
                    variant="outline"
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border-blue-200 hover:border-blue-300 text-blue-700 transition-all"
                    onClick={() =>
                      window.open(
                        `https://www.google.com/maps/@${result.recommendedLocation.latitude},${result.recommendedLocation.longitude},20z/data=!3m1!1e3`,
                        "_blank"
                      )
                    }
                  >
                    <MapPin className="w-4 h-4 mr-2" />
                    Open in Google Maps (Satellite View)
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full h-12 rounded-xl hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-all"
                    onClick={() => setIsExportModalOpen(true)}
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    Export Reports
                  </Button>


                  <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
                    <DialogContent className="max-w-md rounded-2xl">
                      <DialogHeader>
                        <DialogTitle className="text-xl">Export Analysis Report</DialogTitle>
                      </DialogHeader>

                      <div className="space-y-3 mt-4">
                        <Button
                          className="w-full h-12 bg-linear-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-xl shadow-lg shadow-red-200 transition-all hover:scale-[1.02]"
                          onClick={() => {
                            exportPDF();
                            setIsExportModalOpen(false);
                          }}
                        >
                          <FileText className="w-5 h-5 mr-2" />
                          Export as PDF
                        </Button>

                        <Button
                          className="w-full h-12 bg-linear-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl shadow-lg shadow-emerald-200 transition-all hover:scale-[1.02]"
                          onClick={() => {
                            exportExcel();
                            setIsExportModalOpen(false);
                          }}
                        >
                          <FileSpreadsheet className="w-5 h-5 mr-2" />
                          Export as Excel
                        </Button>
                      </div>

                      <DialogFooter className="mt-4">
                        <Button variant="ghost" onClick={() => setIsExportModalOpen(false)} className="rounded-xl">
                          Cancel
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>


                </div>
                {/* Right — Map Legend */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-800 text-lg">Map Legend</h4>

                  <div className="bg-linear-to-br from-slate-50 to-gray-50 p-5 rounded-xl border shadow-sm space-y-4">

                    {/* Recommended Location */}
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border hover:border-emerald-200 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-linear-to-br from-emerald-400 to-green-500 flex items-center justify-center text-white text-sm shadow-lg shadow-emerald-200">
                        ★
                      </div>
                      <span className="text-gray-700 font-medium">Recommended Location</span>
                    </div>

                    {/* Barangay Center */}
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border hover:border-red-200 transition-colors">
                      <div className="w-6 h-6 rounded-full bg-linear-to-br from-red-400 to-rose-500 border-2 border-white shadow-lg shadow-red-200" />
                      <span className="text-gray-700 font-medium">Barangay Center</span>
                    </div>

                    {/* Cluster Centroids */}
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border hover:border-blue-200 transition-colors">
                      <div className="w-7 h-7 rounded-full bg-linear-to-br from-blue-400 to-indigo-500 text-white flex items-center justify-center text-[10px] font-bold shadow-lg shadow-blue-200">
                        C
                      </div>
                      <span className="text-gray-700 font-medium">Cluster Centroids</span>
                    </div>

                    {/* Business Locations */}
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border hover:border-purple-200 transition-colors">
                      <div className="w-5 h-5 rounded-full bg-linear-to-br from-purple-400 to-violet-500 border-2 border-white shadow-lg shadow-purple-200" />
                      <span className="text-gray-700 font-medium">Business Locations</span>
                    </div>

                    <Button
                      className="mt-4 w-full h-12 bg-linear-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-blue-200 transition-all hover:scale-[1.02]"
                      onClick={() => navigate("/user/opportunities", {
                        state: {
                          fromClustering: true,
                          selectedCategory: selectedCategory,
                          businessIdea: businessIdea,
                          clusterCount: result?.clusters.length || 0,
                          zoneType: result?.zoneType || "Unknown"
                        }
                      })}
                    >
                      <TrendingUp className="w-4 h-4 mr-2" />
                      View Opportunities
                    </Button>

                  </div>
                </div>

              </div>
            </CardContent>
          </Card>



          {/* ---------------------------------------------- */}
          {/* WHY THIS LOCATION */}
          {/* ---------------------------------------------- */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-linear-to-r from-amber-50 to-orange-50 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-linear-to-br from-amber-500 to-orange-600 rounded-xl text-white shadow-lg shadow-amber-200">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
                </div>
                <div>
                  <CardTitle className="text-xl">Why This Location?</CardTitle>
                  <CardDescription>
                    Key factors influencing the AI recommendation
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              {(() => {
                const anchor = getAnchorBusiness();
                if (!anchor || !liveAnalytics)
                  return (
                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                      <div className="p-2 bg-gray-200 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                      </div>
                      <p className="text-gray-600">Unable to compute explanation — no anchor business found.</p>
                    </div>
                  );

                // NEW: Use liveAnalytics instead of anchor's pre-stored values
                const bd50 = liveAnalytics.businessPresence.r50;
                const bd100 = liveAnalytics.businessPresence.r100;
                const bd200 = liveAnalytics.businessPresence.r200;
                const cd50 = liveAnalytics.competitorPressure.r50;
                const cd100 = liveAnalytics.competitorPressure.r100;
                const cd200 = liveAnalytics.competitorPressure.r200;

                return (
                  <div className="space-y-6">
                    <div className="p-5 bg-linear-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-100">
                      <p className="text-gray-700 leading-relaxed">
                        This location is near{" "}
                        <span className="font-semibold text-amber-700">{anchor.business_name}</span>{" "}
                        on <span className="font-semibold text-amber-700">{anchor.street}</span>, inside{" "}
                        {describeZone(anchor.zone_type)}. The system evaluated business
                        density, competitor strength, demand pockets, and cluster
                        centroids.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Business Presence */}
                      <div className="bg-linear-to-br from-emerald-50 to-green-50 border border-emerald-200 p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-2 bg-emerald-500 rounded-lg text-white">
                            <TrendingUp className="w-4 h-4" />
                          </div>
                          <p className="text-emerald-900 font-semibold">Business Presence</p>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between items-center p-2 bg-white/70 rounded-lg">
                            <span className="text-emerald-700">50m radius</span>
                            <Badge className="bg-emerald-100 text-emerald-700 border-0">{bd50} ({describeLevel(bd50)})</Badge>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-white/70 rounded-lg">
                            <span className="text-emerald-700">100m radius</span>
                            <Badge className="bg-emerald-100 text-emerald-700 border-0">{bd100} ({describeLevel(bd100)})</Badge>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-white/70 rounded-lg">
                            <span className="text-emerald-700">200m radius</span>
                            <Badge className="bg-emerald-100 text-emerald-700 border-0">{bd200} ({describeLevel(bd200)})</Badge>
                          </div>
                        </div>
                      </div>

                      {/* Competitor Pressure */}
                      <div className="bg-linear-to-br from-rose-50 to-red-50 border border-rose-200 p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-2 bg-rose-500 rounded-lg text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg>
                          </div>
                          <p className="text-rose-900 font-semibold">Competitor Pressure</p>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between items-center p-2 bg-white/70 rounded-lg">
                            <span className="text-rose-700">50m radius</span>
                            <Badge className="bg-rose-100 text-rose-700 border-0">{cd50} ({describeLevel(cd50)})</Badge>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-white/70 rounded-lg">
                            <span className="text-rose-700">100m radius</span>
                            <Badge className="bg-rose-100 text-rose-700 border-0">{cd100} ({describeLevel(cd100)})</Badge>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-white/70 rounded-lg">
                            <span className="text-rose-700">200m radius</span>
                            <Badge className="bg-rose-100 text-rose-700 border-0">{cd200} ({describeLevel(cd200)})</Badge>
                          </div>
                        </div>
                      </div>

                      {/* Interpretation */}
                      <div className="bg-linear-to-br from-sky-50 to-blue-50 border border-sky-200 p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-2 bg-sky-500 rounded-lg text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" /><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" /><path d="M12 2v2" /><path d="M12 22v-2" /><path d="m17 20.66-1-1.73" /><path d="M11 10.27 7 3.34" /><path d="m20.66 17-1.73-1" /><path d="m3.34 7 1.73 1" /><path d="M14 12h8" /><path d="M2 12h2" /><path d="m20.66 7-1.73 1" /><path d="m3.34 17 1.73-1" /><path d="m17 3.34-1 1.73" /><path d="m11 13.73-4 6.93" /></svg>
                          </div>
                          <p className="text-sky-900 font-semibold">AI Interpretation</p>
                        </div>
                        <div className="space-y-2 text-sm">
                          {/* NEW: Dynamic interpretation from liveAnalytics */}
                          {liveAnalytics.interpretation.map((insight, idx) => (
                            <div key={idx} className="p-2 bg-white/70 rounded-lg text-sky-800 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                              <span>{insight}</span>
                            </div>
                          ))}
                        </div>
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
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#1e3a5f] rounded-xl text-white shadow-lg shadow-slate-200">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                </div>
                <div>
                  <CardTitle className="text-xl">Competitor Analysis</CardTitle>
                  <CardDescription>Market competition overview and strategic insights</CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-5">

              {/* Competitor Summary */}
              <div className="bg-linear-to-br from-blue-50 to-indigo-50 p-5 rounded-xl border border-blue-200 shadow-sm">
                <h4 className="text-blue-900 mb-4 font-semibold flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></svg>
                  Competitor Summary
                </h4>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white/80 p-4 rounded-xl text-center shadow-sm">
                    <p className="text-2xl font-bold text-blue-700">{result.analysis.competitorCount}</p>
                    <p className="text-xs text-gray-500 mt-1">Total</p>
                  </div>
                  <div className="bg-white/80 p-4 rounded-xl text-center shadow-sm">
                    <p className="text-2xl font-bold text-green-600">{result.competitorAnalysis.competitorsWithin500m}</p>
                    <p className="text-xs text-gray-500 mt-1">Within 500m</p>
                  </div>
                  <div className="bg-white/80 p-4 rounded-xl text-center shadow-sm">
                    <p className="text-2xl font-bold text-amber-600">{result.competitorAnalysis.competitorsWithin1km}</p>
                    <p className="text-xs text-gray-500 mt-1">Within 1km</p>
                  </div>
                  <div className="bg-white/80 p-4 rounded-xl text-center shadow-sm">
                    <p className="text-2xl font-bold text-rose-600">{result.competitorAnalysis.competitorsWithin2km}</p>
                    <p className="text-xs text-gray-500 mt-1">Within 2km</p>
                  </div>
                </div>
              </div>

              {/* Nearest Competitor */}
              {result.competitorAnalysis.nearestCompetitor ? (
                <div className="bg-linear-to-br from-orange-50 to-amber-50 p-5 rounded-xl border border-orange-200 shadow-sm">
                  <h4 className="text-orange-900 mb-3 font-semibold flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Nearest Competitor
                  </h4>
                  <div className="bg-white/80 p-4 rounded-xl">
                    <p className="font-semibold text-gray-900 text-lg">
                      {result.competitorAnalysis.nearestCompetitor.business_name}
                    </p>
                    <p className="text-gray-600 mt-1">{result.competitorAnalysis.nearestCompetitor.street}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge className="bg-orange-100 text-orange-700 border-0">
                        {(result.competitorAnalysis.distanceToNearest * 1000).toFixed(0)}m away
                      </Badge>
                      <span className="text-xs text-gray-500">
                        ({result.competitorAnalysis.distanceToNearest.toFixed(2)} km)
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-linear-to-br from-green-50 to-emerald-50 p-5 rounded-xl border border-green-200">
                  <h4 className="text-green-900 mb-2 font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    No Direct Competitors
                  </h4>
                  <p className="text-green-700">Great news! No direct competitors found nearby.</p>
                </div>
              )}

              {/* Market Saturation */}
              <div className="bg-linear-to-br from-indigo-50 to-violet-50 p-5 rounded-xl border border-indigo-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-indigo-900 font-semibold flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></svg>
                    Market Saturation
                  </h4>
                  <Badge className={`text-lg px-3 py-1 ${result.competitorAnalysis.marketSaturation < 0.3 ? 'bg-green-500' : result.competitorAnalysis.marketSaturation < 0.6 ? 'bg-amber-500' : 'bg-red-500'} text-white border-0`}>
                    {(result.competitorAnalysis.marketSaturation * 100).toFixed(0)}%
                  </Badge>
                </div>

                <Progress
                  value={result.competitorAnalysis.marketSaturation * 100}
                  className="h-3 mb-4"
                />

                <div className="bg-white/80 p-4 rounded-xl">
                  <p className="text-gray-700">
                    {result.competitorAnalysis.recommendedStrategy}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ---------------------------------------------- */}
          {/* NEARBY BUSINESSES */}
          {/* ---------------------------------------------- */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-linear-to-r from-cyan-50 to-teal-50 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-linear-to-br from-cyan-500 to-teal-600 rounded-xl text-white shadow-lg shadow-cyan-200">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                </div>
                <div>
                  <CardTitle className="text-xl">Nearby Businesses</CardTitle>
                  <CardDescription>
                    Top 10 closest businesses based on Haversine distance
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              <div className="space-y-3">
                {result.nearbyBusinesses.map((nb, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-linear-to-r from-gray-50 to-slate-50 rounded-xl border hover:border-cyan-200 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-linear-to-br from-cyan-500 to-teal-600 text-white font-bold shadow-lg shadow-cyan-200">
                        {index + 1}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 group-hover:text-cyan-700 transition-colors">
                          {nb.business.business_name}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {nb.business.general_category} • {nb.business.street}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-medium">
                        {nb.business.zone_type}
                      </Badge>
                      <Badge className="bg-linear-to-r from-cyan-500 to-teal-500 text-white border-0 px-3 py-1.5 shadow-md">
                        {(nb.distance * 1000).toFixed(0)}m
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ---------------------------------------------- */}
          {/* CLUSTER DETAILS */}
          {/* ---------------------------------------------- */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-linear-to-r from-violet-50 to-purple-50 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-linear-to-br from-violet-500 to-purple-600 rounded-xl text-white shadow-lg shadow-violet-200">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><circle cx="19" cy="5" r="2" /><circle cx="5" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" /><line x1="12" y1="9" x2="12" y2="5" /><line x1="6.4" y1="6.5" x2="9.5" y2="9.5" /><line x1="17.5" y1="6.5" x2="14.5" y2="9.5" /><line x1="6.5" y1="17.5" x2="9.5" y2="14.5" /><line x1="17.5" y1="17.5" x2="14.5" y2="14.5" /></svg>
                </div>
                <div>
                  <CardTitle className="text-xl">Cluster Analysis Details</CardTitle>
                  <CardDescription>
                    Distribution of businesses across identified clusters
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {result.clusters.map((cluster) => (
                  <div
                    key={cluster.id}
                    className="border-2 rounded-2xl p-5 bg-white shadow-sm hover:shadow-lg transition-all hover:scale-[1.02]"
                    style={{ borderColor: cluster.color + '40' }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-lg"
                          style={{ backgroundColor: cluster.color }}
                        >
                          {cluster.id + 1}
                        </div>
                        <h4 className="font-bold text-lg text-gray-900">Cluster {cluster.id + 1}</h4>
                      </div>
                      <Badge
                        className="px-4 py-2 text-sm font-semibold border-0 text-white"
                        style={{ backgroundColor: cluster.color }}
                      >
                        {cluster.points.length} businesses
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded-xl">
                        <p className="text-gray-500 text-xs mb-1">Centroid Latitude</p>
                        <p className="font-mono font-semibold text-gray-900">{cluster.centroid.latitude.toFixed(6)}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-xl">
                        <p className="text-gray-500 text-xs mb-1">Centroid Longitude</p>
                        <p className="font-mono font-semibold text-gray-900">{cluster.centroid.longitude.toFixed(6)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ---------------------------------------------- */}
          {/* 🤖 AI BUSINESS RECOMMENDATIONS */}
          {/* ---------------------------------------------- */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl text-white shadow-lg shadow-amber-200">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    AI Business Recommendations
                    {aiRecommendationsLoading && (
                      <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
                    )}
                  </CardTitle>
                  <CardDescription>
                    Smart, data-driven recommendations based on location analysis
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              {aiRecommendationsLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center animate-pulse">
                      <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-amber-200 border-t-amber-500 animate-spin" />
                  </div>
                  <p className="mt-4 text-gray-600 font-medium">AI is analyzing your location...</p>
                  <p className="text-sm text-gray-400">Generating smart recommendations</p>
                </div>
              ) : aiBusinessRecommendations ? (
                <div className="space-y-6">

                  {/* Best Cluster Banner */}
                  <div className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                        <Target className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold mb-1">
                          {aiBusinessRecommendations.bestCluster?.friendlyName || "Best Cluster"}
                        </h3>
                        <p className="text-white/90">
                          {aiBusinessRecommendations.bestCluster?.reason || "Recommended based on analysis"}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold">{aiBusinessRecommendations.bestCluster?.confidence || 80}%</div>
                        <div className={`text-sm font-semibold px-2 py-0.5 rounded ${aiBusinessRecommendations.bestCluster?.confidenceLabel === "Best Choice"
                          ? "bg-white/30 text-white"
                          : aiBusinessRecommendations.bestCluster?.confidenceLabel === "Good Choice"
                            ? "bg-white/20 text-white/90"
                            : "bg-white/10 text-white/80"
                          }`}>
                          {aiBusinessRecommendations.bestCluster?.confidenceLabel || "Good Choice"}
                        </div>
                      </div>
                    </div>
                    <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
                  </div>

                  {/* Top 3 Recommended Businesses */}
                  <div>
                    <h4 className="font-semibold text-gray-900 flex items-center gap-2 mb-4 text-lg">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                      Top 3 Recommended Businesses
                    </h4>

                    <div className="space-y-4">
                      {(aiBusinessRecommendations.topBusinesses || []).map((biz: TopBusiness, index: number) => (
                        <div
                          key={index}
                          className="bg-white rounded-2xl border-2 border-gray-100 p-5 hover:border-amber-300 hover:shadow-lg transition-all group"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                {index + 1}
                              </div>
                              <div>
                                <h5 className="font-bold text-gray-900 text-lg group-hover:text-amber-700 transition-colors">
                                  {biz.name}
                                </h5>
                                <p className="text-gray-500 text-sm">{biz.shortDescription}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-center">
                                <div className="text-2xl font-bold text-amber-600">{biz.score}</div>
                                <div className="text-xs text-gray-500">Score</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">{biz.fitPercentage}%</div>
                                <div className="text-xs text-gray-500">Fit</div>
                              </div>
                              <Badge className={`border-0 px-3 py-1 ${biz.opportunityLevel?.includes("High")
                                ? "bg-green-500 text-white"
                                : biz.opportunityLevel?.includes("Medium")
                                  ? "bg-amber-500 text-white"
                                  : "bg-gray-500 text-white"
                                }`}>
                                {biz.opportunityLevel || "Medium"}
                              </Badge>
                            </div>
                          </div>
                          {/* Expandable View More Details Button */}
                          <details className="mt-3 group/details">
                            <summary className="cursor-pointer flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium text-sm transition-colors">
                              <ChevronRight className="w-4 h-4 group-open/details:rotate-90 transition-transform" />
                              View More Details
                            </summary>
                            <div className="bg-gradient-to-br from-gray-50 to-slate-50 p-5 rounded-xl mt-3 space-y-4 border border-gray-100">
                              {/* Preferred Location */}
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                  <MapPin className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                  <h6 className="font-semibold text-gray-800 text-sm">Preferred Location</h6>
                                  <p className="text-gray-600 text-sm">{biz.preferredLocation || "Near main road for visibility"}</p>
                                </div>
                              </div>

                              {/* Startup Budget */}
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-green-100 rounded-lg">
                                  <DollarSign className="w-4 h-4 text-green-600" />
                                </div>
                                <div>
                                  <h6 className="font-semibold text-gray-800 text-sm">Startup Budget</h6>
                                  <p className="text-gray-600 text-sm">{biz.startupBudget || "₱50,000–₱150,000"}</p>
                                </div>
                              </div>

                              {/* Competitor Presence */}
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-amber-100 rounded-lg">
                                  <Users className="w-4 h-4 text-amber-600" />
                                </div>
                                <div>
                                  <h6 className="font-semibold text-gray-800 text-sm">Competitor Presence</h6>
                                  <p className="text-gray-600 text-sm">{biz.competitorPresence || "Low competition in area"}</p>
                                </div>
                              </div>

                              {/* Business Density Insight */}
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-purple-100 rounded-lg">
                                  <Building2 className="w-4 h-4 text-purple-600" />
                                </div>
                                <div>
                                  <h6 className="font-semibold text-gray-800 text-sm">Business Density</h6>
                                  <p className="text-gray-600 text-sm">{biz.businessDensityInsight || "Moderate activity area"}</p>
                                </div>
                              </div>

                              {/* Full Details */}
                              <div className="pt-3 border-t border-gray-200">
                                <h6 className="font-semibold text-gray-800 text-sm mb-2">Why This Business Fits</h6>
                                <p className="text-gray-700 text-sm leading-relaxed">{biz.fullDetails}</p>
                              </div>
                            </div>
                          </details>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cluster Summary */}
                  <div className="bg-gradient-to-br from-slate-50 to-gray-50 p-5 rounded-xl border border-gray-200">
                    <h4 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
                      <Store className="w-5 h-5" />
                      Cluster Summary
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {(aiBusinessRecommendations.clusterSummary || []).map((cluster: ClusterSummaryItem, index: number) => (
                        <div key={index} className="bg-white p-4 rounded-xl border">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-800">
                              {cluster.zoneType || cluster.friendlyName || `Cluster ${cluster.clusterId}`}
                            </span>
                            <Badge className={`border-0 ${cluster.competitionLevel === "Low"
                              ? "bg-green-100 text-green-700"
                              : cluster.competitionLevel === "Medium"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-700"
                              }`}>
                              {cluster.competitionLevel}
                            </Badge>
                          </div>
                          <p className="text-2xl font-bold text-gray-900 mt-2">
                            {cluster.businessCount}
                            <span className="text-sm font-normal text-gray-500 ml-1">businesses</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Final Suggestion */}
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-5 rounded-xl border border-indigo-200">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-indigo-500 rounded-lg text-white">
                        <Lightbulb className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-indigo-900 mb-1">Final Suggestion</h4>
                        <p className="text-gray-700">
                          {aiBusinessRecommendations.finalSuggestion || "Proceed with your business plan."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>AI recommendations will appear after clustering analysis</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );

}

