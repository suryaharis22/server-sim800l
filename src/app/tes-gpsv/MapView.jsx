"use client";

import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState } from "react";

// Fix default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl:
        typeof window !== "undefined"
            ? require("leaflet/dist/images/marker-icon-2x.png")
            : "",
    iconUrl:
        typeof window !== "undefined"
            ? require("leaflet/dist/images/marker-icon.png")
            : "",
    shadowUrl:
        typeof window !== "undefined"
            ? require("leaflet/dist/images/marker-shadow.png")
            : "",
});

// Component untuk follow marker
function FollowMarker({ lat, lng, follow }) {
    const map = useMap();

    useEffect(() => {
        if (follow) {
            map.setView([lat, lng]);
        }
    }, [lat, lng, follow, map]);

    return null;
}

export default function MapView({ lat = -7.981894, lng = 112.626503 }) {
    const [follow, setFollow] = useState(false);

    return (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>

            {/* Tombol Ikon */}
            <button
                onClick={() => setFollow(!follow)}
                style={{
                    position: "absolute",
                    zIndex: 1000,
                    top: 10,
                    right: 10,
                    width: 45,
                    height: 45,
                    background: "transparent",
                    borderRadius: "50%",
                    border: follow
                        ? "2px solid #dc2626"
                        : "2px solid #2563eb",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                }}
                title={follow ? "Unfollow" : "Follow"}
            >
                {/* Ikon SVG */}
                {follow ? (
                    // Ikon GPS Lock (FOLLOW ON)
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="#dc2626"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path d="M12 8a4 4 0 100 8 4 4 0 000-8zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19a7 7 0 110-14 7 7 0 010 14z" />
                    </svg>
                ) : (
                    // Ikon Target (FOLLOW OFF)
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        stroke="#2563eb"
                        strokeWidth="2"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 2v2" />
                        <path d="M12 20v2" />
                        <path d="M2 12h2" />
                        <path d="M20 12h2" />
                        <circle cx="12" cy="12" r="9" />
                    </svg>
                )}
            </button>

            <MapContainer
                center={[lat, lng]}
                zoom={15}
                scrollWheelZoom={false}
                style={{ height: "100%", width: "100%" }}
            >
                <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <FollowMarker lat={lat} lng={lng} follow={follow} />

                <Marker position={[lat, lng]}>
                    <Popup>
                        Device location <br />
                        {lat.toFixed(6)}, {lng.toFixed(6)}

                    </Popup>
                </Marker>
            </MapContainer>
        </div>
    );
}
