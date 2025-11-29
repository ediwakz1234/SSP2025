import { MapContainer, TileLayer, Marker, Popup, Polygon } from "react-leaflet";
import L from "leaflet";

// Sta. Cruz Barangay Center
const STA_CRUZ_CENTER: [number, number] = [14.8373, 120.9558];

// Approximate Boundary Polygon for Brgy Sta. Cruz, Sta. Maria, Bulacan


// Default Marker Icon
const centerIcon = new L.Icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function BusinessMap() {
  return (
    <MapContainer
      center={STA_CRUZ_CENTER}
      zoom={15}
      scrollWheelZoom={true}
      style={{ height: "520px", width: "100%" }}
      className="rounded-lg"
    >
      {/* Base Map Layer */}
      <TileLayer
        attribution="© OpenStreetMap Contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />


      {/* Center Marker */}
      <Marker position={STA_CRUZ_CENTER} icon={centerIcon}>
        <Popup>
          <div style={{ color: "black", fontWeight: "bold" }}>
            Barangay Sta. Cruz Center
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
}
