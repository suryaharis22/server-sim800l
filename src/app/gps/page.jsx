"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    initMqttClient,
    sendCmd,
    relayHandlers,
    handleAutoRelay3,
    handleAutoRelay2Off,
} from "@/utils/mqttUtils";

// 🚀 Lazy load komponen MapView (hindari SSR error)
const MapView = dynamic(() => import("./MapView"), { ssr: false });

export default function Dashboard() {
    const [data, setData] = useState({});
    const [status, setStatus] = useState("🔴 Disconnected");
    const [client, setClient] = useState(null);
    const [relay, setRelay] = useState({ r1: 0, r2: 0, r3: 0, r4: 0 });
    const [security, setSecurity] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [loading, setLoading] = useState({
        r1: false,
        r2: false,
        r4: false,
        security: false,
        reset: false,
    });

    // MQTT setup
    const brokerUrl = "wss://broker.hivemq.com:8884/mqtt";
    const topicPubCmd = "eefded87a3fd15f42b2b0b33de8fd422/cmd-control";
    const topicSubData = "eefded87a3fd15f42b2b0b33de8fd422/data-gps";

    // 🔗 MQTT Connection
    useEffect(() => {
        const mqttClient = initMqttClient(
            brokerUrl,
            topicSubData,
            setStatus,
            (topic, message) => {
                if (topic === topicSubData) {
                    try {
                        const json = JSON.parse(message.toString());
                        setData(json);
                        if (json.relay) setRelay(json.relay);
                        if (json.sys && typeof json.sys.sec !== "undefined")
                            setSecurity(json.sys.sec);
                    } catch (e) {
                        console.error("⚠️ Invalid JSON:", e);
                    }
                }
            }
        );
        setClient(mqttClient);
        return () => mqttClient.end();
    }, []);

    const publish = (cmd) => sendCmd(client, topicPubCmd, cmd);

    // ⚙️ Auto logic relay
    useEffect(() => {
        handleAutoRelay3({ data, relay, security, send: publish });
    }, [security, data.sys?.vbat, data.sensor?.voltage_input, relay.r1, relay.r3]);

    useEffect(() => {
        handleAutoRelay2Off({ relay, send: publish });
    }, [relay.r1, relay.r2]);

    // Default posisi Malang (jika belum ada data GPS)
    const lat = data?.gps?.lat || -7.981894;
    const lng = data?.gps?.lng || 112.626503;

    return (
        <main className="min-h-screen bg-gray-900 text-white p-6 flex flex-col items-center justify-start">
            {/* Header */}
            <motion.h1
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-4xl md:text-5xl font-bold mb-6 text-center"
            >
                🚗 ESP32 + SIM800L + GPS Tracker
            </motion.h1>

            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-gray-400 mb-6"
            >
                {status}
            </motion.p>

            {/* 📡 Data Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="bg-gray-800 p-6 rounded-2xl shadow-xl w-full max-w-lg mb-6"
            >
                <h2 className="text-2xl font-semibold mb-4 border-b border-gray-700 pb-2">
                    📡 Data dari Perangkat
                </h2>

                {data && Object.keys(data).length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                            ["🆔 Device", data.device_id],
                            ["🕒 Timestamp", new Date(data.timestamp * 1000).toLocaleString()],
                            ["📶 RSSI", `${data.signal?.rssi} dBm`],
                            ["📍 Latitude", data.gps?.lat?.toFixed(6)],
                            ["📍 Longitude", data.gps?.lng?.toFixed(6)],
                            ["🛰️ Satelit", data.gps?.sat],
                            ["⚡ Tegangan", `${data.sys?.vbat?.toFixed(2)} V`],
                        ].map(([label, value], idx) => (
                            <div key={idx} className="flex justify-between">
                                <span className="text-gray-400">{label}:</span>
                                <span className="font-medium">{value ?? "-"}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-gray-400 py-8 animate-pulse">
                        Menunggu data dari ESP32...
                    </div>
                )}
            </motion.div>

            {/* 🌍 Map View */}
            {data?.gps?.lat && data?.gps?.lng ? (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="w-full max-w-lg mb-6"
                >
                    <h2 className="text-2xl font-semibold mb-4 border-b border-gray-700 pb-2">
                        🗺️ Lokasi di Peta
                    </h2>
                    <MapView lat={lat} lng={lng} />
                </motion.div>
            ) : (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="w-full max-w-lg mb-6 text-center text-gray-400 py-6 border border-gray-700 rounded-2xl"
                >
                    🚫 Belum ada data GPS untuk ditampilkan
                </motion.div>
            )}
        </main>
    );
}
