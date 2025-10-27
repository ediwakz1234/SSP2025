import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { businesses, getUniqueCategories, getBusinessesByCategory } from "../data/businesses";
import { Badge } from "./ui/badge";
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Target } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

export function OpportunitiesPage() {
    const categories = getUniqueCategories();

    // Analyze market saturation for each category
    const categoryAnalysis = categories.map(category => {
        const count = getBusinessesByCategory(category).length;
        const saturation = count / businesses.length;

        let opportunity = "MODERATE";
        let opportunityColor = "text-yellow-600";
        let opportunityBg = "bg-yellow-50";
        let opportunityIcon = AlertCircle;

        if (count === 0) {
            opportunity = "UNTAPPED";
            opportunityColor = "text-green-600";
            opportunityBg = "bg-green-50";
            opportunityIcon = CheckCircle2;
        } else if (count === 1) {
            opportunity = "HIGH";
            opportunityColor = "text-blue-600";
            opportunityBg = "bg-blue-50";
            opportunityIcon = TrendingUp;
        } else if (count >= 5) {
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
            score: count === 0 ? 100 : Math.max(0, 100 - (count * 10))
        };
    }).sort((a, b) => b.score - a.score);

    // Find underserved areas
    const underservedCategories = categoryAnalysis.filter(c => c.count <= 1);
    const saturatedCategories = categoryAnalysis.filter(c => c.count >= 5);

    // Generate recommendations
    const recommendations = [
        {
            title: "High Potential Categories",
            description: "These business types have low competition and high opportunity",
            categories: underservedCategories.slice(0, 5),
            icon: TrendingUp,
            color: "text-green-600",
            bgColor: "bg-green-50"
        },
        {
            title: "Emerging Opportunities",
            description: "Categories with moderate presence but room for growth",
            categories: categoryAnalysis.filter(c => c.count >= 2 && c.count <= 4).slice(0, 5),
            icon: Target,
            color: "text-blue-600",
            bgColor: "bg-blue-50"
        },
        {
            title: "Saturated Markets",
            description: "High competition - consider differentiation strategies",
            categories: saturatedCategories.slice(0, 5),
            icon: TrendingDown,
            color: "text-red-600",
            bgColor: "bg-red-50"
        }
    ];

    return (
        <div className="space-y-6">
            {/* Overview Alert */}
            <Alert className="bg-blue-50 border-blue-200">
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
                <AlertTitle>Market Opportunity Analysis</AlertTitle>
                <AlertDescription>
                    Analysis based on {businesses.length} registered businesses across {categories.length} categories.
                    {underservedCategories.length > 0 && (
                        <> Found {underservedCategories.length} underserved market opportunities.</>
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
                                <p className="text-sm text-muted-foreground">Moderate Competition</p>
                                <h3 className="text-2xl">{categoryAnalysis.filter(c => c.count >= 2 && c.count <= 4).length}</h3>
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
                                            <div key={i} className="flex items-center justify-between p-4 bg-accent rounded-lg">
                                                <div className="flex items-center gap-3 flex-1">
                                                    <div className={`${cat.opportunityBg} p-2 rounded-full`}>
                                                        <OpportunityIcon className={`w-4 h-4 ${cat.opportunityColor}`} />
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
                                                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                                            <span>Current businesses: {cat.count}</span>
                                                            <span>•</span>
                                                            <span>Market share: {cat.saturation.toFixed(1)}%</span>
                                                            <span>•</span>
                                                            <span>Opportunity score: {cat.score}/100</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No categories in this segment</p>
                            )}
                        </CardContent>
                    </Card>
                );
            })}

            {/* All Categories Analysis */}
            <Card>
                <CardHeader>
                    <CardTitle>Complete Market Analysis</CardTitle>
                    <CardDescription>All business categories ranked by opportunity score</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {categoryAnalysis.map((cat, index) => {
                            const OpportunityIcon = cat.opportunityIcon;
                            return (
                                <div key={index} className="flex items-center gap-3 p-3 hover:bg-accent rounded-lg transition-colors">
                                    <div className="w-8 text-center text-sm text-muted-foreground">
                                        {index + 1}
                                    </div>
                                    <div className={`${cat.opportunityBg} p-2 rounded-full`}>
                                        <OpportunityIcon className={`w-4 h-4 ${cat.opportunityColor}`} />
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
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-secondary h-2 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${cat.score >= 75 ? 'bg-green-500' : cat.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                    style={{ width: `${cat.score}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-muted-foreground w-12 text-right">
                                                {cat.score}/100
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Strategic Recommendations */}
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
                            <li>• Consider entering underserved categories with no current competition</li>
                            <li>• Low initial competition allows for market leadership and brand establishment</li>
                            <li>• Higher profit margins due to limited alternatives for consumers</li>
                        </ul>
                    </div>

                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="text-blue-900 mb-2 flex items-center gap-2">
                            <Target className="w-5 h-5" />
                            Market Entry Strategy
                        </h4>
                        <ul className="text-sm text-blue-800 space-y-1 ml-7">
                            <li>• Focus on categories with 1-2 competitors for manageable competition</li>
                            <li>• Implement differentiation strategies (quality, pricing, service)</li>
                            <li>• Target underserved residential areas for local market capture</li>
                        </ul>
                    </div>

                    <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <h4 className="text-orange-900 mb-2 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" />
                            Competitive Markets
                        </h4>
                        <ul className="text-sm text-orange-800 space-y-1 ml-7">
                            <li>• Saturated categories require strong unique value propositions</li>
                            <li>• Consider niche specialization within broader categories</li>
                            <li>• Location becomes critical - use K-Means analysis to find optimal spots</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
