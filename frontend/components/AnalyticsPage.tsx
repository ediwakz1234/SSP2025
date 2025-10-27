import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { businesses, getUniqueCategories } from "../data/businesses";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

export function AnalyticsPage() {
    const categories = getUniqueCategories();

    // Category distribution data
    const categoryData = categories.map(cat => ({
        name: cat,
        count: businesses.filter(b => b.category === cat).length
    })).sort((a, b) => b.count - a.count);

    // Zone type distribution
    const zoneData = [
        {
            name: "Commercial",
            value: businesses.filter(b => b.zone_type === "Commercial").length
        },
        {
            name: "Residential",
            value: businesses.filter(b => b.zone_type === "Residential").length
        }
    ];

    // Top streets by business count
    const streetCounts = businesses.reduce((acc, b) => {
        acc[b.street] = (acc[b.street] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const streetData = Object.entries(streetCounts)
        .map(([street, count]) => ({ street, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    // Density analysis by area
    const areas = [
        "Centro St.", "Gulod St.", "Luwasan St.", "Pag-asa St.",
        "Bukid St.", "Provincial Road", "Housing Project"
    ];

    const densityData = areas.map(area => ({
        area,
        businesses: businesses.filter(b => b.street.includes(area.replace(" St.", "").replace(" Road", ""))).length
    }));

    const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

    return (
        <div className="space-y-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="p-6">
                        <div className="text-center">
                            <p className="text-sm text-muted-foreground">Total Businesses</p>
                            <h3 className="text-4xl mt-2">{businesses.length}</h3>
                            <p className="text-xs text-muted-foreground mt-1">Registered businesses in area</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="text-center">
                            <p className="text-sm text-muted-foreground">Business Categories</p>
                            <h3 className="text-4xl mt-2">{categories.length}</h3>
                            <p className="text-xs text-muted-foreground mt-1">Unique business types</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="text-center">
                            <p className="text-sm text-muted-foreground">Avg. per Category</p>
                            <h3 className="text-4xl mt-2">{(businesses.length / categories.length).toFixed(1)}</h3>
                            <p className="text-xs text-muted-foreground mt-1">Business density metric</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Category Distribution Bar Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Business Distribution by Category</CardTitle>
                    <CardDescription>Number of businesses in each category</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={categoryData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="name"
                                angle={-45}
                                textAnchor="end"
                                height={120}
                                tick={{ fontSize: 12 }}
                            />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="count" fill="#3b82f6" name="Number of Businesses" />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Zone Type Pie Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle>Zone Type Distribution</CardTitle>
                        <CardDescription>Commercial vs Residential zones</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={zoneData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {zoneData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="mt-4 space-y-2">
                            {zoneData.map((zone, index) => (
                                <div key={zone.name} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-4 h-4 rounded"
                                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                        />
                                        <span>{zone.name}</span>
                                    </div>
                                    <span className="text-muted-foreground">{zone.value} businesses</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Top Streets */}
                <Card>
                    <CardHeader>
                        <CardTitle>Top Business Locations</CardTitle>
                        <CardDescription>Streets with highest business concentration</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {streetData.map((item, index) => (
                                <div key={index}>
                                    <div className="flex items-center justify-between mb-1 text-sm">
                                        <span>{item.street}</span>
                                        <span className="text-muted-foreground">{item.count}</span>
                                    </div>
                                    <div className="bg-secondary h-2 rounded-full overflow-hidden">
                                        <div
                                            className="bg-primary h-full transition-all"
                                            style={{ width: `${(item.count / streetData[0].count) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Area Density Analysis */}
            <Card>
                <CardHeader>
                    <CardTitle>Business Density by Area</CardTitle>
                    <CardDescription>Concentration of businesses in major areas</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={densityData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="area"
                                angle={-45}
                                textAnchor="end"
                                height={100}
                                tick={{ fontSize: 12 }}
                            />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="businesses"
                                stroke="#10b981"
                                strokeWidth={2}
                                name="Number of Businesses"
                                dot={{ fill: '#10b981', r: 5 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Category Insights */}
            <Card>
                <CardHeader>
                    <CardTitle>Market Insights</CardTitle>
                    <CardDescription>Key findings from the data analysis</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="text-blue-900 mb-2">Top Category</h4>
                        <p className="text-sm text-blue-800">
                            <strong>{categoryData[0].name}</strong> is the most common business type with {categoryData[0].count} establishments,
                            accounting for {((categoryData[0].count / businesses.length) * 100).toFixed(1)}% of all businesses.
                        </p>
                    </div>

                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <h4 className="text-green-900 mb-2">Commercial Dominance</h4>
                        <p className="text-sm text-green-800">
                            {zoneData[0].value} businesses ({((zoneData[0].value / businesses.length) * 100).toFixed(1)}%) are located in commercial zones,
                            indicating strong commercial activity in the barangay.
                        </p>
                    </div>

                    <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <h4 className="text-orange-900 mb-2">Business Hotspot</h4>
                        <p className="text-sm text-orange-800">
                            <strong>{streetData[0].street}</strong> has the highest business density with {streetData[0].count} establishments,
                            making it a prime commercial location.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
