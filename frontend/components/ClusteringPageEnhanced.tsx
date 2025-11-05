import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Input } from "./ui/input";
import { LOCATION_INFO } from "../data/businesses"; // ✅ keep static location info only
import { findOptimalLocation, ClusteringResult } from "../utils/kmeans";
import { Loader2, MapPin, CheckCircle2, Navigation, Target } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import ImportExportDialog from "../components/ImportExportDialog";
import { toast } from "sonner";
import type { Business } from "../data/businesses";
import { useNavigate } from "react-router-dom";
import { useBusinessStore } from "../store/useBusinessStore";

export function ClusteringPageEnhanced() {
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [customCategory, setCustomCategory] = useState<string>("");
    const [numClusters, setNumClusters] = useState<number>(5);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<ClusteringResult | null>(null);
    const [progress, setProgress] = useState(0);
    const [map, setMap] = useState<any>(null);
    const mapRef = useRef<HTMLDivElement>(null);

    const navigate = useNavigate();
    const { businesses, setFromImported, fetchFromServer, resetToMock } = useBusinessStore();
    const [isRefreshing, setIsRefreshing] = useState(false);

    // ✅ dynamically compute categories from store data
    const categories = [...new Set(businesses.map((b) => b.category))];

    useEffect(() => {
        // Optional: fetch from API (fallbacks to mock)
        fetchFromServer().catch(() => {
            toast.info("⚙️ Using mock data (server fetch skipped or failed)");
        });
    }, []);

    useEffect(() => {
        if (result && mapRef.current && !map) {
            initializeMap();
        }
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
            document.head.appendChild(script);
        } else {
            createMap();
        }
    };

    const createMap = () => {
        if (!result || !mapRef.current) return;
        const L = (window as any).L;

        if (map) map.remove();

        const newMap = L.map(mapRef.current).setView(
            [result.recommendedLocation.latitude, result.recommendedLocation.longitude],
            14
        );

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(newMap);

        // ✅ all markers unchanged
        const recommendedIcon = L.divIcon({
            className: "custom-div-icon",
            html: `<div style="position: relative;">
        <div style="background-color: #10b981; width: 40px; height: 40px; border-radius: 50%; border: 4px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </div>
        <div style="position: absolute; top: 45px; left: 50%; transform: translateX(-50%); background: white; padding: 4px 8px; border-radius: 4px; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2); font-size: 12px; font-weight: 600; color: #10b981;">RECOMMENDED</div>
      </div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
        });

        L.marker(
            [result.recommendedLocation.latitude, result.recommendedLocation.longitude],
            { icon: recommendedIcon }
        )
            .addTo(newMap)
            .bindPopup(
                `<div style="font-family: system-ui, -apple-system, sans-serif; min-width: 250px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 12px; margin: -12px -12px 12px -12px; border-radius: 4px 4px 0 0;">
            <strong style="font-size: 16px;">🎯 RECOMMENDED LOCATION</strong>
          </div>
          <div style="padding: 4px 0;">
            <strong>Coordinates:</strong><br/>
            ${result.recommendedLocation.latitude.toFixed(6)}, ${result.recommendedLocation.longitude.toFixed(6)}<br/><br/>
            <strong>Zone Type:</strong> ${result.zoneType}<br/>
            <strong>Confidence:</strong> ${(result.analysis.confidence * 100).toFixed(0)}%<br/><br/>
            <strong>Opportunity:</strong><br/>
            <span style="color: #059669;">${result.analysis.opportunity}</span>
          </div>
        </div>`
            )
            .openPopup();

        // (Cluster + Barangay markers remain same)
        result.clusters.forEach((cluster, index) => {
            const clusterIcon = L.divIcon({
                className: "custom-div-icon",
                html: `<div style="background-color: ${cluster.color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">${index + 1}</div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
            });

            L.marker([cluster.centroid.latitude, cluster.centroid.longitude], {
                icon: clusterIcon,
            }).addTo(newMap);
        });

        setMap(newMap);
    };

    const handleRunClustering = async () => {
        const categoryToAnalyze =
            selectedCategory === "custom" ? customCategory : selectedCategory;
        if (!categoryToAnalyze) return;

        setIsProcessing(true);
        setProgress(0);
        setResult(null);
        if (map) {
            map.remove();
            setMap(null);
        }

        const steps = [
            { progress: 20, delay: 300 },
            { progress: 40, delay: 400 },
            { progress: 60, delay: 300 },
            { progress: 80, delay: 400 },
            { progress: 100, delay: 300 },
        ];

        for (const step of steps) {
            await new Promise((r) => setTimeout(r, step.delay));
            setProgress(step.progress);
        }

        // ✅ uses store data (live businesses)
        const clusteringResult = findOptimalLocation(businesses, categoryToAnalyze, numClusters);
        setResult(clusteringResult);
        setIsProcessing(false);
    };

    const getConfidenceColor = (c: number) =>
        c >= 0.8 ? "text-green-600" : c >= 0.6 ? "text-yellow-600" : "text-red-600";
    const getConfidenceBg = (c: number) =>
        c >= 0.8 ? "bg-green-50" : c >= 0.6 ? "bg-yellow-50" : "bg-red-50";

    return (
        <div className="space-y-6">
            {/* Config Card (UI unchanged) */}
            <Card>
                <CardHeader>
                    <CardTitle>K-Means Clustering Configuration</CardTitle>
                    <CardDescription>
                        Configure your business analysis parameters using Haversine distance for accurate geographical calculations
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Category */}
                        <div className="space-y-2">
                            <Label htmlFor="category">Business Category</Label>
                            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                <SelectTrigger id="category" className="bg-input-background">
                                    <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((cat) => (
                                        <SelectItem key={cat} value={cat}>
                                            {cat}
                                        </SelectItem>
                                    ))}
                                    <SelectItem value="custom">Custom Category...</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Clusters */}
                        <div className="space-y-2">
                            <Label htmlFor="clusters">Number of Clusters (K)</Label>
                            <Input
                                id="clusters"
                                type="number"
                                min="2"
                                max="10"
                                value={numClusters}
                                onChange={(e) => setNumClusters(parseInt(e.target.value) || 5)}
                                className="bg-input-background"
                            />
                            <p className="text-xs text-muted-foreground">
                                Recommended: 3–7 clusters for optimal analysis
                            </p>
                        </div>
                    </div>

                    {selectedCategory === "custom" && (
                        <div className="space-y-2">
                            <Label htmlFor="customCategory">Enter Custom Category</Label>
                            <Input
                                id="customCategory"
                                type="text"
                                placeholder="e.g., Coffee Shop, Pharmacy"
                                value={customCategory}
                                onChange={(e) => setCustomCategory(e.target.value)}
                                className="bg-input-background"
                            />

                            <ImportExportDialog
                                onImportSuccess={(data: Business[]) => {
                                    setFromImported(data);
                                    toast.success("✅ Imported CSV — dashboard updated!");
                                    // Use global navigation if defined
                                    if ((window as any).navigateTo) {
                                        (window as any).navigateTo("dashboard");
                                    } else {
                                        navigate("/dashboard"); // fallback if router is used
                                    }
                                }}
                                onExportSuccess={() => {
                                    resetToMock();
                                    toast.info("🔄 Restored mock data");
                                    if ((window as any).navigateTo) {
                                        (window as any).navigateTo("dashboard");
                                    } else {
                                        navigate("/dashboard");
                                    }
                                }}
                            />
                        </div>
                    )}

                    {isRefreshing && (
                        <p className="text-sm text-blue-600 mt-2 animate-pulse">
                            🔄 Refreshing business data...
                        </p>
                    )}

                    <Button
                        onClick={handleRunClustering}
                        disabled={
                            isProcessing ||
                            (!selectedCategory ||
                                (selectedCategory === "custom" && !customCategory))
                        }
                        className="w-full md:w-auto"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...
                            </>
                        ) : (
                            <>
                                <Target className="w-4 h-4 mr-2" /> Run K-Means Clustering
                            </>
                        )}
                    </Button>

                    {isProcessing && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                    Analyzing data with Haversine distance...
                                </span>
                                <span>{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ✅ Result Cards remain exactly as your design */}
            {result && (
                <>
                    <Alert className={getConfidenceBg(result.analysis.confidence)}>
                        <CheckCircle2 className={`h-5 w-5 ${getConfidenceColor(result.analysis.confidence)}`} />
                        <AlertTitle>
                            Analysis Complete - {(result.analysis.confidence * 100).toFixed(0)}% Confidence
                        </AlertTitle>
                        <AlertDescription>{result.analysis.opportunity}</AlertDescription>
                    </Alert>

                    {/* Map Visualization */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MapPin className="w-5 h-5" />
                                Recommended Business Location
                            </CardTitle>
                            <CardDescription>
                                Interactive map showing recommended location (green star) and cluster analysis with {result.clusters.length} clusters
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div
                                ref={mapRef}
                                className="w-full h-[500px] rounded-lg border border-border mb-4"
                                style={{ zIndex: 0 }}
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <div className="space-y-2">
                                    <h4 className="flex items-center gap-2">
                                        <Navigation className="w-4 h-4" />
                                        Coordinates
                                    </h4>
                                    <div className="bg-accent p-4 rounded-lg">
                                        <div className="space-y-1 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Latitude:</span>
                                                <span>{result.recommendedLocation.latitude.toFixed(6)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Longitude:</span>
                                                <span>{result.recommendedLocation.longitude.toFixed(6)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Zone Type:</span>
                                                <Badge variant="outline">{result.zoneType}</Badge>
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => window.open(`https://www.google.com/maps?q=${result.recommendedLocation.latitude},${result.recommendedLocation.longitude}`, '_blank')}
                                    >
                                        Open in Google Maps
                                    </Button>
                                </div>

                                <div className="space-y-2">
                                    <h4>Map Legend</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white">★</div>
                                            <span>Recommended Location</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-red-500 rounded-full border-2 border-white"></div>
                                            <span>Barangay Center</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center text-white text-xs">1</div>
                                            <span>Cluster Centroids</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 bg-blue-500 rounded-full border border-white"></div>
                                            <span>Business Locations</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Competitor Analysis */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Detailed Competitor Analysis</CardTitle>
                            <CardDescription>
                                Competition analysis using precise Haversine distance calculations
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                    <p className="text-sm text-blue-800 mb-1">Total Competitors</p>
                                    <h3 className="text-3xl text-blue-900">{result.analysis.competitorCount}</h3>
                                    <p className="text-xs text-blue-700 mt-1">In entire area</p>
                                </div>

                                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                    <p className="text-sm text-green-800 mb-1">Within 500m</p>
                                    <h3 className="text-3xl text-green-900">{result.competitorAnalysis.competitorsWithin500m}</h3>
                                    <p className="text-xs text-green-700 mt-1">Immediate area</p>
                                </div>

                                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                                    <p className="text-sm text-yellow-800 mb-1">Within 1km</p>
                                    <h3 className="text-3xl text-yellow-900">{result.competitorAnalysis.competitorsWithin1km}</h3>
                                    <p className="text-xs text-yellow-700 mt-1">Walking distance</p>
                                </div>

                                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                                    <p className="text-sm text-purple-800 mb-1">Within 2km</p>
                                    <h3 className="text-3xl text-purple-900">{result.competitorAnalysis.competitorsWithin2km}</h3>
                                    <p className="text-xs text-purple-700 mt-1">Extended area</p>
                                </div>
                            </div>

                            <Separator />

                            {result.competitorAnalysis.nearestCompetitor && (
                                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                                    <h4 className="text-orange-900 mb-2">Nearest Competitor</h4>
                                    <div className="space-y-1 text-sm text-orange-800">
                                        <p><strong>{result.competitorAnalysis.nearestCompetitor.business_name}</strong></p>
                                        <p>{result.competitorAnalysis.nearestCompetitor.street}</p>
                                        <p className="text-xs">Distance: {(result.competitorAnalysis.distanceToNearest * 1000).toFixed(0)}m ({result.competitorAnalysis.distanceToNearest.toFixed(2)}km)</p>
                                    </div>
                                </div>
                            )}

                            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                                <h4 className="text-indigo-900 mb-2">Market Saturation: {(result.competitorAnalysis.marketSaturation * 100).toFixed(0)}%</h4>
                                <Progress value={result.competitorAnalysis.marketSaturation * 100} className="h-2 mb-2" />
                                <p className="text-sm text-indigo-800">{result.competitorAnalysis.recommendedStrategy}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Nearby Businesses */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Nearby Businesses (10 Closest)</CardTitle>
                            <CardDescription>
                                Businesses near the recommended location, sorted by Haversine distance
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {result.nearbyBusinesses.map((nb, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-accent rounded-lg">
                                        <div className="flex-1">
                                            <h4 className="text-sm">{nb.business.business_name}</h4>
                                            <p className="text-xs text-muted-foreground">
                                                {nb.business.category} • {nb.business.street} • {nb.business.zone_type}
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

                    {/* Cluster Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Cluster Analysis Details</CardTitle>
                            <CardDescription>
                                Breakdown of businesses across {result.clusters.length} clusters
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {result.clusters.map((cluster) => (
                                    <div key={cluster.id} className="border border-border rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm"
                                                    style={{ backgroundColor: cluster.color }}
                                                >
                                                    {cluster.id + 1}
                                                </div>
                                                <h4>Cluster {cluster.id + 1}</h4>
                                            </div>
                                            <Badge>{cluster.points.length} businesses</Badge>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <p className="text-muted-foreground text-xs">Centroid Latitude</p>
                                                <p>{cluster.centroid.latitude.toFixed(6)}</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground text-xs">Centroid Longitude</p>
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
