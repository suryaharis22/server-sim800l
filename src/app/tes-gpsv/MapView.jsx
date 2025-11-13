"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";

// fix default icon issue with next/webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: typeof window !== "undefined" ? require("leaflet/dist/images/marker-icon-2x.png") : "",
    iconUrl: typeof window !== "undefined" ? require("leaflet/dist/images/marker-icon.png") : "",
    shadowUrl: typeof window !== "undefined" ? require("leaflet/dist/images/marker-shadow.png") : "",
});

export default function MapView({ lat = -7.981894, lng = 112.626503 }) {
    // ensure map re-renders when coords change
    useEffect(() => { }, [lat, lng]);

    return (
        <MapContainer center={[lat, lng]} zoom={15} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[lat, lng]}>
                <Popup>
                    Device location <br /> {lat.toFixed(6)}, {lng.toFixed(6)}
                </Popup>
            </Marker>
        </MapContainer>
    );
}
