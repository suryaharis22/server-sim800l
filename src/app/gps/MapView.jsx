"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// --- Fix icon marker default ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// --- Dynamic import react-leaflet components ---
const MapContainer = dynamic(
    () => import("react-leaflet").then((mod) => mod.MapContainer),
    { ssr: false }
);
const TileLayer = dynamic(
    () => import("react-leaflet").then((mod) => mod.TileLayer),
    { ssr: false }
);
const Marker = dynamic(
    () => import("react-leaflet").then((mod) => mod.Marker),
    { ssr: false }
);
const Popup = dynamic(
    () => import("react-leaflet").then((mod) => mod.Popup),
    { ssr: false }
);

// --- Main component ---
export default function MapView({ lat, lng }) {
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const position = [lat, lng];

    // Update posisi marker dan peta
    useEffect(() => {
        if (mapRef.current && lat && lng) {
            const map = mapRef.current;
            map.setView([lat, lng], map.getZoom());

            if (markerRef.current) {
                markerRef.current.setLatLng([lat, lng]);
            }
        }
    }, [lat, lng]);

    return (
        <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-700">
            <MapContainer
                center={position}
                zoom={16}
                scrollWheelZoom={false}
                whenCreated={(mapInstance) => (mapRef.current = mapInstance)}
                style={{ height: "350px", width: "100%" }}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />

                <Marker
                    position={position}
                    ref={markerRef}
                >
                    <Popup>
                        <strong>📍 Lokasi Kendaraan</strong>
                        <br />
                        Lat: {lat.toFixed(6)} <br />
                        Lng: {lng.toFixed(6)}
                    </Popup>
                </Marker>
            </MapContainer>
        </div>
    );
}
