import random
from typing import List, Dict, Any
from app.services.haversine import (
    haversine_distance,
    calculate_geographic_centroid,
    calculate_density_within_radius,
    find_nearest_point,
    get_points_within_radius
)

CLUSTER_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

def perform_kmeans_clustering(
    businesses: List[Dict[str, Any]],
    business_category: str,
    num_clusters: int = 5,
    max_iterations: int = 100
) -> Dict[str, Any]:
    """
    Perform K-Means clustering analysis on businesses
    """
    # Convert businesses to points
    points = [
        {
            "latitude": b["latitude"],
            "longitude": b["longitude"],
            "business": b
        }
        for b in businesses
    ]
    
    # Initialize centroids randomly
    centroids = initialize_centroids(points, num_clusters)
    
    # Perform K-Means iterations
    clusters = []
    iterations = 0
    
    for i in range(max_iterations):
        iterations += 1
        
        # Assign points to nearest centroid
        clusters = assign_to_clusters(points, centroids, num_clusters)
        
        # Recalculate centroids
        new_centroids = recalculate_centroids(clusters)
        
        # Check for convergence
        if has_converged(centroids, new_centroids):
            break
        
        centroids = new_centroids
    
    # Update cluster centroids
    for i, cluster in enumerate(clusters):
        cluster["centroid"] = centroids[i]
    
    # Find optimal location
    result = find_optimal_location(
        businesses,
        business_category,
        clusters
    )
    
    result["iterations"] = iterations
    
    return result

def initialize_centroids(points: List[Dict], k: int) -> List[Dict[str, float]]:
    """Initialize K random centroids"""
    selected_indices = random.sample(range(len(points)), k)
    return [
        {"latitude": points[i]["latitude"], "longitude": points[i]["longitude"]}
        for i in selected_indices
    ]

def assign_to_clusters(
    points: List[Dict],
    centroids: List[Dict[str, float]],
    k: int
) -> List[Dict[str, Any]]:
    """Assign each point to the nearest centroid"""
    clusters = [
        {
            "id": i,
            "centroid": centroid.copy(),
            "points": [],
            "color": CLUSTER_COLORS[i % len(CLUSTER_COLORS)]
        }
        for i, centroid in enumerate(centroids)
    ]
    
    for point in points:
        min_distance = float('inf')
        closest_cluster = 0
        
        for i, centroid in enumerate(centroids):
            distance = haversine_distance(
                point["latitude"],
                point["longitude"],
                centroid["latitude"],
                centroid["longitude"]
            )
            if distance < min_distance:
                min_distance = distance
                closest_cluster = i
        
        clusters[closest_cluster]["points"].append(point)
    
    return clusters

def recalculate_centroids(clusters: List[Dict[str, Any]]) -> List[Dict[str, float]]:
    """Recalculate centroids based on cluster points"""
    new_centroids = []
    
    for cluster in clusters:
        if not cluster["points"]:
            new_centroids.append(cluster["centroid"])
        else:
            centroid = calculate_geographic_centroid(cluster["points"])
            new_centroids.append(centroid)
    
    return new_centroids

def has_converged(
    old_centroids: List[Dict[str, float]],
    new_centroids: List[Dict[str, float]],
    threshold_km: float = 0.01
) -> bool:
    """Check if centroids have converged"""
    for old, new in zip(old_centroids, new_centroids):
        distance = haversine_distance(
            old["latitude"],
            old["longitude"],
            new["latitude"],
            new["longitude"]
        )
        if distance >= threshold_km:
            return False
    return True

def find_optimal_location(
    businesses: List[Dict[str, Any]],
    business_category: str,
    clusters: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Find the optimal location for a new business"""
    
    # Filter competitors
    competitors = [b for b in businesses if b["category"].lower() == business_category.lower()]
    
    # Analyze each cluster
    cluster_scores = []
    
    for cluster in clusters:
        if not cluster["points"]:
            continue
        
        # Count competitors in cluster
        competitor_count = sum(
            1 for p in cluster["points"]
            if p["business"]["category"].lower() == business_category.lower()
        )
        
        # Calculate density
        if len(cluster["points"]) > 0:
            avg_distance = sum(
                haversine_distance(
                    cluster["centroid"]["latitude"],
                    cluster["centroid"]["longitude"],
                    p["latitude"],
                    p["longitude"]
                )
                for p in cluster["points"]
            ) / len(cluster["points"])
        else:
            avg_distance = 0.1
        
        density = len(cluster["points"]) / (3.14159 * max(avg_distance, 0.1) ** 2)
        competitor_density = competitor_count / max(len(cluster["points"]), 1)
        
        # Calculate commercial zone bonus
        commercial_count = sum(
            1 for p in cluster["points"]
            if p["business"]["zone_type"] == "Commercial"
        )
        commercial_bonus = commercial_count / max(len(cluster["points"]), 1)
        
        # Calculate score
        score = (1 - competitor_density) * 0.5 + density * 0.3 + commercial_bonus * 0.2
        
        cluster_scores.append({
            "cluster": cluster,
            "score": score,
            "competitor_count": competitor_count
        })
    
    # Sort by score
    cluster_scores.sort(key=lambda x: x["score"], reverse=True)
    
    if not cluster_scores:
        # Fallback to center of all businesses
        all_points = [{"latitude": b["latitude"], "longitude": b["longitude"]} for b in businesses]
        recommended_location = calculate_geographic_centroid(all_points)
    else:
        best_cluster = cluster_scores[0]
        recommended_location = best_cluster["cluster"]["centroid"]
    
    # Perform competitor analysis
    competitor_analysis = analyze_competitors(
        recommended_location,
        businesses,
        business_category
    )
    
    # Find nearby businesses
    business_points = [
        {"latitude": b["latitude"], "longitude": b["longitude"], "business": b}
        for b in businesses
    ]
    nearby = get_points_within_radius(recommended_location, business_points, 2.0)
    nearby_businesses = [
        {
            "business_id": p[0]["business"]["business_id"],
            "business_name": p[0]["business"]["business_name"],
            "category": p[0]["business"]["category"],
            "street": p[0]["business"]["street"],
            "zone_type": p[0]["business"]["zone_type"],
            "distance": p[1]
        }
        for p in nearby[:10]
    ]
    
    # Determine zone type
    commercial_count = sum(1 for nb in nearby_businesses[:5] if nb["zone_type"] == "Commercial")
    zone_type = "Commercial" if commercial_count >= 3 else "Residential"
    
    # Generate opportunity analysis
    if competitor_analysis["competitors_within_500m"] == 0:
        opportunity = "HIGH OPPORTUNITY: No direct competitors within 500m radius. Ideal location for market entry with first-mover advantage."
        confidence = 0.92
    elif competitor_analysis["competitors_within_1km"] <= 2:
        opportunity = "MODERATE-HIGH OPPORTUNITY: Low competition density within 1km. Good potential for market share with proper execution."
        confidence = 0.78
    elif competitor_analysis["competitors_within_1km"] <= 5:
        opportunity = "MODERATE OPPORTUNITY: Moderate competition present. Success depends on differentiation and service quality."
        confidence = 0.62
    else:
        opportunity = "CHALLENGING MARKET: High competition density. Requires strong differentiation strategy or consider alternative location."
        confidence = 0.45
    
    # Format clusters for response
    formatted_clusters = []
    for cluster in clusters:
        formatted_points = []
        for point in cluster["points"]:
            formatted_points.append({
                "latitude": point["latitude"],
                "longitude": point["longitude"],
                "business_id": point["business"]["business_id"],
                "business_name": point["business"]["business_name"],
                "category": point["business"]["category"]
            })
        
        formatted_clusters.append({
            "id": cluster["id"],
            "centroid": {
                "latitude": cluster["centroid"]["latitude"],
                "longitude": cluster["centroid"]["longitude"]
            },
            "points": formatted_points,
            "color": cluster["color"],
            "business_count": len(cluster["points"])
        })
    
    return {
        "clusters": formatted_clusters,
        "recommended_location": {
            "latitude": recommended_location["latitude"],
            "longitude": recommended_location["longitude"]
        },
        "zone_type": zone_type,
        "analysis": {
            "totalBusinesses": len(businesses),
            "competitorCount": len(competitors),
            "opportunity": opportunity,
            "confidence": confidence
        },
        "competitor_analysis": competitor_analysis,
        "nearby_businesses": nearby_businesses
    }

def analyze_competitors(
    location: Dict[str, float],
    businesses: List[Dict[str, Any]],
    business_category: str
) -> Dict[str, Any]:
    """Perform detailed competitor analysis"""
    
    competitors = [b for b in businesses if b["category"].lower() == business_category.lower()]
    
    if not competitors:
        return {
            "nearest_competitor": None,
            "distance_to_nearest": None,
            "competitors_within_500m": 0,
            "competitors_within_1km": 0,
            "competitors_within_2km": 0,
            "market_saturation": 0.0,
            "recommended_strategy": "FIRST MOVER: No competitors detected. Excellent opportunity to establish market presence and brand recognition."
        }
    
    # Find nearest competitor
    competitor_points = [
        {"latitude": c["latitude"], "longitude": c["longitude"], "data": c}
        for c in competitors
    ]
    nearest, distance = find_nearest_point(location, competitor_points)
    
    # Count competitors within radii
    competitors_500m = calculate_density_within_radius(location, competitor_points, 0.5)
    competitors_1km = calculate_density_within_radius(location, competitor_points, 1.0)
    competitors_2km = calculate_density_within_radius(location, competitor_points, 2.0)
    
    # Calculate market saturation
    max_expected = 10
    market_saturation = min(competitors_1km / max_expected, 1.0)
    
    # Generate strategy recommendation
    if competitors_500m == 0:
        strategy = "LOW COMPETITION: No immediate competitors. Focus on quality service and building customer loyalty."
    elif competitors_500m <= 2:
        strategy = "MODERATE COMPETITION: Differentiate through unique value proposition, better pricing, or superior service."
    elif competitors_500m <= 5:
        strategy = "HIGH COMPETITION: Require strong differentiation strategy. Consider niche specialization or unique selling points."
    else:
        strategy = "SATURATED MARKET: Very high competition. Success requires exceptional differentiation or consider alternative location."
    
    return {
        "nearest_competitor": nearest["data"] if nearest else None,
        "distance_to_nearest": distance if distance != float('inf') else None,
        "competitors_within_500m": competitors_500m,
        "competitors_within_1km": competitors_1km,
        "competitors_within_2km": competitors_2km,
        "market_saturation": market_saturation,
        "recommended_strategy": strategy
    }
