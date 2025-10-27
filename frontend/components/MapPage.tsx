import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { businesses, LOCATION_INFO, getUniqueCategories } from "../data/businesses";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";
import { MapPin, Filter } from "lucide-react";

export function MapPage() {
    const mapRef = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<any>(null);
    const [markers, setMarkers] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [selectedZone, setSelectedZone] = useState<string>("all");

    const categories = getUniqueCategories();

    useEffect(() => {
        // Initialize Leaflet map
        if (!mapRef.current) return;

        // Load Leaflet CSS and JS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => initMap();
        document.head.appendChild(script);

        return () => {
            if (map) {
                map.remove();
            }
        };
    }, []);

    const initMap = () => {
        // @ts-ignore - Leaflet loaded from CDN
        const L = window.L;

        const newMap = L.map(mapRef.current).setView(
            [LOCATION_INFO.center_latitude, LOCATION_INFO.center_longitude],
            15
        );

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(newMap);

        // Add barangay center marker
        L.marker([LOCATION_INFO.center_latitude, LOCATION_INFO.center_longitude], {
            icon: L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="background-color: #ef4444; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        }).addTo(newMap).bindPopup(`
      <div style="font-family: system-ui, -apple-system, sans-serif;">
        <strong>Brgy. ${LOCATION_INFO.barangay}</strong><br/>
        ${LOCATION_INFO.municipality}, ${LOCATION_INFO.province}<br/>
        <small>Population: ${LOCATION_INFO.population.toLocaleString()}</small>
      </div>
    `);

        setMap(newMap);
        updateMarkers(newMap, businesses);
    };

    const updateMarkers = (leafletMap: any, businessesToShow: typeof businesses) => {
        // @ts-ignore
        const L = window.L;

        // Clear existing markers
        markers.forEach(marker => leafletMap.removeLayer(marker));

        const categoryColors: Record<string, string> = {
            'HARDWARE': '#3b82f6',
            'Cafe': '#8b5cf6',
            'Retail': '#10b981',
            'Services': '#f59e0b',
            'Restaurant': '#ef4444',
            'Pharmacy': '#06b6d4',
            'Furniture Store': '#ec4899',
            'Resort': '#84cc16',
            'Bakery': '#f97316',
            'Pet Store': '#a855f7',
            'Hardware': '#0ea5e9'
        };

        const newMarkers = businessesToShow.map(business => {
            const color = categoryColors[business.category] || '#6b7280';

            const marker = L.circleMarker([business.latitude, business.longitude], {
                radius: 8,
                fillColor: color,
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(leafletMap);

            marker.bindPopup(`
        <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 200px;">
          <strong>${business.business_name}</strong><br/>
          <span style="color: ${color}; font-weight: 600;">${business.category}</span><br/>
          <small>${business.street}</small><br/>
          <small>Zone: ${business.zone_type}</small><br/>
          <small style="color: #6b7280;">
            ${business.latitude.toFixed(6)}, ${business.longitude.toFixed(6)}
          </small>
        </div>
      `);

            return marker;
        });

        setMarkers(newMarkers);
    };

    useEffect(() => {
        if (!map) return;

        let filteredBusinesses = businesses;

        if (selectedCategory !== "all") {
            filteredBusinesses = filteredBusinesses.filter(b => b.category === selectedCategory);
        }

        if (selectedZone !== "all") {
            filteredBusinesses = filteredBusinesses.filter(b => b.zone_type === selectedZone);
        }

        updateMarkers(map, filteredBusinesses);
    }, [selectedCategory, selectedZone, map]);

    return (
        <div className="space-y-6">
            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="w-5 h-5" />
                        Map Filters
                    </CardTitle>
                    <CardDescription>Filter businesses by category and zone type</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="map-category">Business Category</Label>
                            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                <SelectTrigger id="map-category" className="bg-input-background">
                                    <SelectValue placeholder="All Categories" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    {categories.map((cat) => (
                                        <SelectItem key={cat} value={cat}>
                                            {cat}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="map-zone">Zone Type</Label>
                            <Select value={selectedZone} onValueChange={setSelectedZone}>
                                <SelectTrigger id="map-zone" className="bg-input-background">
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

                    <div className="mt-4 flex flex-wrap gap-2">
                        <Badge variant="secondary" className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            Showing {markers.length} of {businesses.length} businesses
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Map Container */}
            <Card>
                <CardHeader>
                    <CardTitle>Interactive Business Map</CardTitle>
                    <CardDescription>
                        Click on markers to view business details. Red marker indicates barangay center.
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
                            const colors: Record<string, string> = {
                                'HARDWARE': '#3b82f6',
                                'Cafe': '#8b5cf6',
                                'Retail': '#10b981',
                                'Services': '#f59e0b',
                                'Restaurant': '#ef4444',
                                'Pharmacy': '#06b6d4',
                                'Furniture Store': '#ec4899',
                                'Resort': '#84cc16',
                                'Bakery': '#f97316',
                                'Pet Store': '#a855f7',
                                'Hardware': '#0ea5e9'
                            };
                            const color = colors[category] || '#6b7280';

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
