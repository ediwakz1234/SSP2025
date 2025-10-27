import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Store, Users, MapPin, TrendingUp, Building2, Briefcase } from "lucide-react";
import { businesses, getUniqueCategories, LOCATION_INFO } from "../data/businesses";

export function DashboardPage() {
    const categories = getUniqueCategories();
    const commercialZones = businesses.filter(b => b.zone_type === "Commercial").length;
    const residentialZones = businesses.filter(b => b.zone_type === "Residential").length;

    const stats = [
        {
            title: "Total Businesses",
            value: businesses.length,
            icon: Store,
            color: "text-blue-600",
            bgColor: "bg-blue-50"
        },
        {
            title: "Business Categories",
            value: categories.length,
            icon: Briefcase,
            color: "text-green-600",
            bgColor: "bg-green-50"
        },
        {
            title: "Population",
            value: LOCATION_INFO.population.toLocaleString(),
            icon: Users,
            color: "text-purple-600",
            bgColor: "bg-purple-50"
        },
        {
            title: "Commercial Zones",
            value: commercialZones,
            icon: Building2,
            color: "text-orange-600",
            bgColor: "bg-orange-50"
        },
        {
            title: "Residential Zones",
            value: residentialZones,
            icon: MapPin,
            color: "text-pink-600",
            bgColor: "bg-pink-50"
        },
        {
            title: "Growth Potential",
            value: "High",
            icon: TrendingUp,
            color: "text-cyan-600",
            bgColor: "bg-cyan-50"
        },
    ];

    // Top categories
    const categoryCounts = categories.map(cat => ({
        category: cat,
        count: businesses.filter(b => b.category === cat).length
    })).sort((a, b) => b.count - a.count);

    return (
        <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <Card key={index}>
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">{stat.title}</p>
                                        <h3 className="text-3xl mt-2">{stat.value}</h3>
                                    </div>
                                    <div className={`${stat.bgColor} p-3 rounded-full`}>
                                        <Icon className={`w-6 h-6 ${stat.color}`} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Location Info */}
            <Card>
                <CardHeader>
                    <CardTitle>Location Information</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Barangay</p>
                            <p>{LOCATION_INFO.barangay}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Municipality</p>
                            <p>{LOCATION_INFO.municipality}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Province</p>
                            <p>{LOCATION_INFO.province}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Postal Code</p>
                            <p>{LOCATION_INFO.postal_code}</p>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-sm text-muted-foreground">Coordinates</p>
                        <p>{LOCATION_INFO.center_latitude.toFixed(4)}, {LOCATION_INFO.center_longitude.toFixed(4)}</p>
                    </div>
                </CardContent>
            </Card>

            {/* Top Categories */}
            <Card>
                <CardHeader>
                    <CardTitle>Business Distribution by Category</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {categoryCounts.slice(0, 10).map((item, index) => (
                            <div key={index} className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                    <div className="w-8 text-center text-sm text-muted-foreground">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span>{item.category}</span>
                                            <span className="text-sm text-muted-foreground">{item.count} businesses</span>
                                        </div>
                                        <div className="bg-secondary h-2 rounded-full overflow-hidden">
                                            <div
                                                className="bg-primary h-full"
                                                style={{ width: `${(item.count / businesses.length) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
                <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button
                            onClick={() => (window as any).navigateTo?.('clustering')}
                            className="p-4 border border-border rounded-lg hover:bg-accent cursor-pointer transition-colors text-left"
                        >
                            <GitBranch className="w-8 h-8 mb-2 text-primary" />
                            <h4>Run K-Means Analysis</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                                Analyze optimal business locations
                            </p>
                        </button>
                        <button
                            onClick={() => (window as any).navigateTo?.('analytics')}
                            className="p-4 border border-border rounded-lg hover:bg-accent cursor-pointer transition-colors text-left"
                        >
                            <BarChart3 className="w-8 h-8 mb-2 text-primary" />
                            <h4>View Analytics</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                                Explore detailed charts and graphs
                            </p>
                        </button>
                        <button
                            onClick={() => (window as any).navigateTo?.('map')}
                            className="p-4 border border-border rounded-lg hover:bg-accent cursor-pointer transition-colors text-left"
                        >
                            <Map className="w-8 h-8 mb-2 text-primary" />
                            <h4>Interactive Map</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                                Visualize business locations
                            </p>
                        </button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// Missing import
import { BarChart3, GitBranch, Map } from "lucide-react";
