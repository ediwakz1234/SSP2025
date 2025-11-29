import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { fetchBusinesses, fetchCategories, type Business } from "../../data/businesses";
import { Badge } from "../ui/badge";
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Target } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";

/**
 * Haversine distance in kilometers between two lat/lng points
 */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Map raw competition (business count) → score 0–100 + label
 */
function getCompetitionMetrics(count: number) {
  let level = "LOW";
  let score = 100;

  if (count <= 1) {
    level = "VERY LOW";
    score = 100;
  } else if (count <= 3) {
    level = "LOW";
    score = 75;
  } else if (count <= 5) {
    level = "MODERATE";
    score = 50;
  } else if (count <= 8) {
    level = "HIGH";
    score = 25;
  } else {
    level = "VERY HIGH";
    score = 0;
  }

  return { level, score };
}

/**
 * Zone advantage based on distribution of Commercial vs Residential
 * - If category exists only in one zone → high advantage (can expand to the other zone)
 * - If one zone is clearly underrepresented → moderate advantage
 * - If balanced / already everywhere → low advantage
 */
function getZoneAdvantageMetrics(categoryBusinesses: Business[]) {
  const commercialCount = categoryBusinesses.filter(
    (b) => b.zone_type === "Commercial"
  ).length;
  const residentialCount = categoryBusinesses.filter(
    (b) => b.zone_type === "Residential"
  ).length;
  const total = commercialCount + residentialCount;

  if (total === 0) {
    return {
      level: "UNKNOWN",
      score: 50,
      detail: "No zone data",
    };
  }

  // Only in one zone → big opportunity to expand to the missing zone
  if (commercialCount === 0 || residentialCount === 0) {
    return {
      level: "HIGH",
      score: 100,
      detail:
        commercialCount === 0
          ? "Only in Residential zones — potential to expand into Commercial areas"
          : "Only in Commercial zones — potential to expand into Residential areas",
    };
  }

  const minCount = Math.min(commercialCount, residentialCount);
  const maxCount = Math.max(commercialCount, residentialCount);
  const ratio = minCount / maxCount;

  if (ratio < 0.4) {
    // One zone clearly underrepresented
    return {
      level: "MODERATE",
      score: 70,
      detail: "One zone is underrepresented, offering room for expansion",
    };
  }

  return {
    level: "LOW",
    score: 40,
    detail: "Category is already present in both zones",
  };
}

/**
 * Geographic spread:
 * - Compute centroid of all businesses in the category
 * - Average distance to centroid → spread
 * - Wide spread = higher opportunity (category not locked into one hotspot)
 */
function getSpreadMetrics(categoryBusinesses: Business[]) {
  if (categoryBusinesses.length === 0) {
    return {
      avgDistanceKm: 0,
      level: "UNKNOWN",
      score: 50,
    };
  }

  const withCoords = categoryBusinesses.filter(
    (b) => typeof b.latitude === "number" && typeof b.longitude === "number"
  );
  if (withCoords.length === 0) {
    return {
      avgDistanceKm: 0,
      level: "UNKNOWN",
      score: 50,
    };
  }

  const latSum = withCoords.reduce((sum, b) => sum + b.latitude, 0);
  const lonSum = withCoords.reduce((sum, b) => sum + b.longitude, 0);
  const centroidLat = latSum / withCoords.length;
  const centroidLon = lonSum / withCoords.length;

  const distances = withCoords.map((b) =>
    haversineKm(centroidLat, centroidLon, b.latitude, b.longitude)
  );
  const avgDistanceKm = distances.reduce((sum, d) => sum + d, 0) / distances.length;

  // Thresholds are tuned for barangay-level scale
  let level = "NARROW";
  let score = 30;
  if (avgDistanceKm > 0.5) {
    level = "WIDE";
    score = 100;
  } else if (avgDistanceKm > 0.2) {
    level = "MODERATE";
    score = 70;
  } else if (avgDistanceKm > 0.1) {
    level = "LOCALIZED";
    score = 50;
  }

  return { avgDistanceKm, level, score };
}

/**
 * Score label for user-friendly interpretation
 * 0–40  => Low
 * 41–70 => Medium
 * 71–100 => High
 */
function getScoreLabel(score: number) {
  if (score <= 40) return "Low (0–40)";
  if (score <= 70) return "Medium (41–70)";
  return "High (71–100)";
}

export function OpportunitiesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load real data from Supabase
  useEffect(() => {
    const load = async () => {
      try {
        const [biz, cats] = await Promise.all([
          fetchBusinesses(),
          fetchCategories(),
        ]);
        setBusinesses(biz);
        setCategories(cats);
      } catch (err) {
        console.error("Failed to load opportunities data", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // Enhanced market analysis per category (same logic, but now uses state)
  const categoryAnalysis = useMemo(() => {
    if (!businesses.length || !categories.length) return [];

    return categories
      .map((category) => {
        const catBusinesses = businesses.filter((b) => b.category === category);
        const count = catBusinesses.length;
        const saturation = businesses.length ? count / businesses.length : 0;

        // 1) Competition metrics
        const { level: competitionLevel, score: competitionScore } =
          getCompetitionMetrics(count);

        // 2) Zone advantage metrics
        const { level: zoneLevel, score: zoneScore, detail: zoneDetail } =
          getZoneAdvantageMetrics(catBusinesses);

        // 3) Geographic spread metrics
        const { avgDistanceKm, level: spreadLevel, score: spreadScore } =
          getSpreadMetrics(catBusinesses);

        // Final opportunity score = weighted blend
        const finalScore = Math.round(
          competitionScore * 0.5 + zoneScore * 0.3 + spreadScore * 0.2
        );

        // Map opportunity label based on competition + final score
        let opportunity = "MODERATE";
        let opportunityColor = "text-yellow-600";
        let opportunityBg = "bg-yellow-50";
        let opportunityIcon = AlertCircle;

        if (count === 0) {
          opportunity = "UNTAPPED";
          opportunityColor = "text-green-600";
          opportunityBg = "bg-green-50";
          opportunityIcon = CheckCircle2;
        } else if (competitionLevel === "VERY LOW" || competitionLevel === "LOW") {
          opportunity = "HIGH";
          opportunityColor = "text-blue-600";
          opportunityBg = "bg-blue-50";
          opportunityIcon = TrendingUp;
        } else if (competitionLevel === "VERY HIGH") {
          opportunity = "SATURATED";
          opportunityColor = "text-red-600";
          opportunityBg = "bg-red-50";
          opportunityIcon = TrendingDown;
        }

        return {
          category,
          count,
          saturation: saturation * 100,
          opportunity,
          opportunityColor,
          opportunityBg,
          opportunityIcon,
          competitionLevel,
          competitionScore,
          zoneLevel,
          zoneScore,
          zoneDetail,
          spreadLevel,
          spreadScore,
          avgDistanceKm,
          score: finalScore,
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [businesses, categories]);

  const underservedCategories = categoryAnalysis.filter((c) => c.count <= 1);
  const saturatedCategories = categoryAnalysis.filter((c) => c.count >= 6);
  const moderateCategories = categoryAnalysis.filter(
    (c) => c.count >= 2 && c.count <= 5
  );

  const recommendations = [
    {
      title: "High Potential Categories",
      description:
        "Low competition, good zone advantage, and favorable geographic spread",
      categories: underservedCategories.slice(0, 5),
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Emerging Opportunities",
      description:
        "Moderate competition with room for strategic differentiation and expansion",
      categories: moderateCategories.slice(0, 5),
      icon: Target,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Saturated Markets",
      description:
        "High competition pressure — consider niche specialization or alternative categories",
      categories: saturatedCategories.slice(0, 5),
      icon: TrendingDown,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              Loading opportunity analysis...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Alert */}
      <Alert className="bg-blue-50 border-blue-200">
        <CheckCircle2 className="h-5 w-5 text-blue-600" />
        <AlertTitle>Market Opportunity Analysis</AlertTitle>
        <AlertDescription>
          Analysis based on {businesses.length} registered businesses across{" "}
          {categories.length} categories. The opportunity score combines:
          <br />
          <span className="font-medium">
            • Competition Pressure (50%) • Zone Advantage (30%) • Geographic
            Spread (20%)
          </span>
          {underservedCategories.length > 0 && (
            <>
              {" "}
              – Found {underservedCategories.length} underserved market
              opportunities.
            </>
          )}
        </AlertDescription>
      </Alert>

      {/* Key Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-green-50 p-3 rounded-full">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">High Opportunity</p>
                <h3 className="text-2xl">{underservedCategories.length}</h3>
                <p className="text-xs text-muted-foreground">Categories</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-50 p-3 rounded-full">
                <Target className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Moderate Competition
                </p>
                <h3 className="text-2xl">{moderateCategories.length}</h3>
                <p className="text-xs text-muted-foreground">Categories</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-red-50 p-3 rounded-full">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Saturated Markets</p>
                <h3 className="text-2xl">{saturatedCategories.length}</h3>
                <p className="text-xs text-muted-foreground">Categories</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {recommendations.map((rec, index) => {
        const Icon = rec.icon;
        return (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className={`${rec.bgColor} p-2 rounded-lg`}>
                  <Icon className={`w-5 h-5 ${rec.color}`} />
                </div>
                {rec.title}
              </CardTitle>
              <CardDescription>{rec.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {rec.categories.length > 0 ? (
                <div className="space-y-3">
                  {rec.categories.map((cat, i) => {
                    const OpportunityIcon = cat.opportunityIcon;
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between p-4 bg-accent rounded-lg"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`${cat.opportunityBg} p-2 rounded-full`}>
                            <OpportunityIcon
                              className={`w-4 h-4 ${cat.opportunityColor}`}
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4>{cat.category}</h4>
                              <Badge
                                variant="secondary"
                                className={`${cat.opportunityBg} ${cat.opportunityColor} border-0`}
                              >
                                {cat.opportunity}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                              <span>Current businesses: {cat.count}</span>
                              <span>•</span>
                              <span>
                                Competition: {cat.competitionLevel} (
                                {cat.competitionScore}/100)
                              </span>
                              <span>•</span>
                              <span>
                                Zone advantage: {cat.zoneLevel} ({cat.zoneScore}/100)
                              </span>
                              <span>•</span>
                              <span>
                                Spread: {cat.spreadLevel} ({cat.spreadScore}/100)
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Overall score: {cat.score}/100 – {getScoreLabel(cat.score)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No categories in this segment
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* All Categories Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Complete Market Analysis</CardTitle>
          <CardDescription>
            All business categories ranked by composite opportunity score
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {categoryAnalysis.map((cat, index) => {
              const OpportunityIcon = cat.opportunityIcon;
              return (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 hover:bg-accent rounded-lg transition-colors"
                >
                  <div className="w-8 text-center text-sm text-muted-foreground">
                    {index + 1}
                  </div>
                  <div className={`${cat.opportunityBg} p-2 rounded-full`}>
                    <OpportunityIcon
                      className={`w-4 h-4 ${cat.opportunityColor}`}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span>{cat.category}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {cat.count} businesses
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={`${cat.opportunityBg} ${cat.opportunityColor} border-0 text-xs`}
                        >
                          {cat.opportunity}
                        </Badge>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground mb-1 flex flex-wrap gap-3">
                      <span>
                        Competition: {cat.competitionLevel} (
                        {cat.competitionScore}/100)
                      </span>
                      <span>• Zone: {cat.zoneLevel} ({cat.zoneScore}/100)</span>
                      <span>
                        • Spread: {cat.spreadLevel} ({cat.spreadScore}/100)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-secondary h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            cat.score >= 75
                              ? "bg-green-500"
                              : cat.score >= 50
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${cat.score}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {cat.score}/100
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {getScoreLabel(cat.score)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Strategic Recommendations (unchanged text, now backed by metrics) */}
      <Card>
        <CardHeader>
          <CardTitle>Strategic Business Recommendations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <h4 className="text-green-900 mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Prime Opportunities
            </h4>
            <ul className="text-sm text-green-800 space-y-1 ml-7">
              <li>
                • Focus on categories with very low competition pressure and high
                zone advantage.
              </li>
              <li>
                • Use wide geographic spread as an indicator of untapped pockets
                within the barangay.
              </li>
              <li>
                • Prioritize top-ranked categories (score &gt;= 80/100) for new
                investments.
              </li>
            </ul>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="text-blue-900 mb-2 flex items-center gap-2">
              <Target className="w-5 h-5" />
              Market Entry Strategy
            </h4>
            <ul className="text-sm text-blue-800 space-y-1 ml-7">
              <li>
                • Enter categories with moderate competition but strong zone
                advantage.
              </li>
              <li>
                • Differentiate through service quality, pricing, or niche
                sub-segments.
              </li>
              <li>
                • Use clustering and map view to select locations with fewer
                nearby competitors.
              </li>
            </ul>
          </div>

          <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
            <h4 className="text-orange-900 mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Competitive Markets
            </h4>
            <ul className="text-sm text-orange-800 space-y-1 ml-7">
              <li>
                • High competition pressure (score &lt;= 25) requires strong
                differentiation.
              </li>
              <li>
                • Consider niche specialization within highly saturated
                categories.
              </li>
              <li>
                • Location becomes critical — combine this page with K-Means
                clustering results.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
