import math
from typing import List, Dict, Tuple

EARTH_RADIUS_KM = 6371  # Earth's radius in kilometers

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the Haversine distance between two geographical points
    Returns distance in kilometers
    """
    # Convert to radians
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    # Haversine formula
    a = (math.sin(delta_lat / 2) ** 2 +
         math.cos(lat1_rad) * math.cos(lat2_rad) *
         math.sin(delta_lon / 2) ** 2)
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = EARTH_RADIUS_KM * c
    
    return distance

def calculate_geographic_centroid(points: List[Dict[str, float]]) -> Dict[str, float]:
    """
    Calculate the geographic centroid of multiple points
    Uses spherical geometry for accuracy
    """
    if not points:
        raise ValueError("Cannot calculate centroid of empty array")
    
    if len(points) == 1:
        return {"latitude": points[0]["latitude"], "longitude": points[0]["longitude"]}
    
    # Convert to Cartesian coordinates
    x, y, z = 0, 0, 0
    
    for point in points:
        lat_rad = math.radians(point["latitude"])
        lon_rad = math.radians(point["longitude"])
        
        x += math.cos(lat_rad) * math.cos(lon_rad)
        y += math.cos(lat_rad) * math.sin(lon_rad)
        z += math.sin(lat_rad)
    
    total = len(points)
    x /= total
    y /= total
    z /= total
    
    # Convert back to latitude/longitude
    central_longitude = math.atan2(y, x)
    central_square_root = math.sqrt(x * x + y * y)
    central_latitude = math.atan2(z, central_square_root)
    
    return {
        "latitude": math.degrees(central_latitude),
        "longitude": math.degrees(central_longitude)
    }

def calculate_density_within_radius(
    center: Dict[str, float],
    points: List[Dict[str, float]],
    radius_km: float
) -> int:
    """
    Calculate the number of points within a given radius
    """
    count = 0
    for point in points:
        distance = haversine_distance(
            center["latitude"],
            center["longitude"],
            point["latitude"],
            point["longitude"]
        )
        if distance <= radius_km:
            count += 1
    return count

def find_nearest_point(
    location: Dict[str, float],
    points: List[Dict[str, float]]
) -> Tuple[Dict[str, float], float]:
    """
    Find the nearest point to a given location
    Returns (nearest_point, distance_km)
    """
    if not points:
        return None, float('inf')
    
    nearest_point = points[0]
    min_distance = haversine_distance(
        location["latitude"],
        location["longitude"],
        points[0]["latitude"],
        points[0]["longitude"]
    )
    
    for point in points[1:]:
        distance = haversine_distance(
            location["latitude"],
            location["longitude"],
            point["latitude"],
            point["longitude"]
        )
        if distance < min_distance:
            min_distance = distance
            nearest_point = point
    
    return nearest_point, min_distance

def get_points_within_radius(
    center: Dict[str, float],
    points: List[Dict[str, float]],
    radius_km: float
) -> List[Tuple[Dict[str, float], float]]:
    """
    Get all points within a radius sorted by distance
    Returns list of (point, distance) tuples
    """
    result = []
    for point in points:
        distance = haversine_distance(
            center["latitude"],
            center["longitude"],
            point["latitude"],
            point["longitude"]
        )
        if distance <= radius_km:
            result.append((point, distance))
    
    # Sort by distance
    result.sort(key=lambda x: x[1])
    return result
