// components/Dashboard.jsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { initMqttClient, sendCmd } from "@/utils/mqttUtilsV3";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

export default function Dashboard() {

    // === STATE MIRROR DARI FIRMWARE ===
    const [deviceId, setDeviceId] = useState("");
    const [sendStatus, setSendStatus] = useState(false);
    const [security, setSecurity] = useState(false);

    const [relays, setRelays] = useState({ r1: 0, r2: 0, r3: 0, r4: 0 });

    const [gps, setGps] = useState({ lat: 0, lng: 0, sat: 0, spd: 0 });
    const [sys, setSys] = useState({ vbat: 0.0, rssi: 0, operator: "" });

    const [mqttConnected, setMqttConnected] = useState(false);
    const [lastRaw, setLastRaw] = useState(null);

    const clientRef = useRef(null);

    // MQTT TOPIC
    const brokerUrl = "wss://broker.hivemq.com:8884/mqtt";
    const topicPub = "eefded87a3fd15f42b2b0b33de8fd422/data-gps";
    const topicSub = "eefded87a3fd15f42b2b0b33de8fd422/cmd-control";

    // INIT MQTT
    useEffect(() => {
        const client = initMqttClient(brokerUrl, {
            onConnect: () => {
                setMqttConnected(true);
                client.subscribe(topicPub);
                toast.success("MQTT connected");
            },

            onMessage: (topic, msg) => {
                if (topic !== topicPub) return;

                try {
                    const json = JSON.parse(msg);
                    setLastRaw(json);

                    if (json.device_id) setDeviceId(json.device_id);
                    if (json.send_status !== undefined) setSendStatus(Boolean(json.send_status));
                    if (json.security !== undefined) setSecurity(Boolean(json.security));

                    if (json.gps) {
                        setGps({
                            lat: json.gps.lat ?? 0,
                            lng: json.gps.lng ?? 0,
                            sat: json.gps.sat ?? 0,
                            spd: json.gps.spd ?? 0,
                        });
                    }

                    if (json.sys) {
                        setSys({
                            vbat: json.sys.vbat ?? 0,
                            rssi: json.sys.rssi ?? 0,
                            operator: json.sys.operator ?? "",
                        });
                    }

                    if (json.relay) {
                        setRelays({
                            r1: json.relay.r1 ?? 0,
                            r2: json.relay.r2 ?? 0,
                            r3: json.relay.r3 ?? 0,
                            r4: json.relay.r4 ?? 0,
                        });
                    }

                } catch (e) {
                    console.warn("Invalid JSON:", e);
                }
            },

            onClose: () => {
                setMqttConnected(false);
                toast.error("MQTT disconnected");
            },

            onError: (err) => {
                setMqttConnected(false);
                console.error("MQTT Error:", err);
            }
        });

        clientRef.current = client;

        return () => {
            try { client.end(true); } catch { }
        };
    }, []);

    // HELPER PUBLISH
    const publishPlain = (cmd) => {
        if (!clientRef.current) return;
        sendCmd(clientRef.current, topicSub, cmd);
    };

    const publishField = (obj) => {
        if (!clientRef.current) return;
        sendCmd(clientRef.current, topicSub, obj);
    };

    // ============================================================
    // 🔥 AUTO SEND_ON SETIAP 5 DETIK KETIKA HALAMAN DIBUKA
    // ============================================================
    useEffect(() => {
        if (!mqttConnected) return;

        // kirim pertama kali
        publishPlain("SEND_ON");

        // interval 5 detik
        const intv = setInterval(() => {
            publishPlain("SEND_ON");
        }, 5000);

        return () => clearInterval(intv);
    }, [mqttConnected]);

    // ============================================================
    // 🔥 AUTO SEND_OFF KETIKA HALAMAN DITUTUP
    // ============================================================
    useEffect(() => {
        const handleClose = () => publishPlain("SEND_OFF");
        window.addEventListener("beforeunload", handleClose);
        return () => window.removeEventListener("beforeunload", handleClose);
    }, []);

    // === MANUAL RELAY ===
    const toggleRelay = (id) => {
        const current = relays[id] ? 1 : 0;
        const next = current ? 0 : 1;
        publishField({ [id]: next });
    };

    const toggleSecurity = () => {
        publishPlain(security ? "SEC_OFF" : "SEC_ON");
        setSecurity(s => !s);
    };

    const starterPulse = () => publishPlain("R2_ON");

    const humanRssi = (rssi) => (rssi === -999 ? "unknown" : rssi);

    // === UI ===
    return (
        <main className="min-h-screen bg-gray-900 text-white p-6 flex flex-col items-center gap-6">
            <Toaster position="top-center" />

            <motion.h1 initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="text-2xl font-semibold">
                Smart Tracker Dashboard (AUTO SEND_ON + AUTO SEND_OFF)
            </motion.h1>

            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* PANEL KIRI */}
                <div className="col-span-1 bg-gray-800 rounded-lg p-4">
                    <div className="text-sm text-gray-300">Device ID</div>
                    <div className="font-medium">{deviceId || "—"}</div>

                    <div className="mt-3 text-sm text-gray-300">MQTT</div>
                    <div>{mqttConnected ? "Connected" : "Disconnected"}</div>

                    <div className="mt-3 text-sm text-gray-300">System</div>
                    <div className="text-sm">
                        VBAT: <strong>{sys.vbat.toFixed ? sys.vbat.toFixed(2) : sys.vbat} V</strong><br />
                        RSSI: <strong>{humanRssi(sys.rssi)}</strong><br />
                        Operator: <strong>{sys.operator || "—"}</strong>
                    </div>

                    <div className="mt-3 text-sm text-gray-300">Flags</div>
                    <div className="flex gap-2 mt-2">
                        <button onClick={toggleSecurity} className={`px-3 py-1 rounded ${security ? "bg-yellow-500" : "bg-gray-700"}`}>
                            Security {security ? "ON" : "OFF"}
                        </button>

                        <button onClick={() => publishPlain(sendStatus ? "SEND_OFF" : "SEND_ON")} className={`px-3 py-1 rounded ${sendStatus ? "bg-blue-600" : "bg-gray-700"}`}>
                            SEND {sendStatus ? "ON" : "OFF"}
                        </button>
                    </div>
                </div>

                {/* PANEL MAP */}
                <div className="col-span-1 md:col-span-2 bg-gray-800 rounded-lg p-4">
                    <div className="mb-3 text-gray-300">GPS</div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>Lat: <strong>{gps.lat}</strong></div>
                        <div>Lng: <strong>{gps.lng}</strong></div>
                        <div>Sats: <strong>{gps.sat}</strong></div>
                        <div>Speed: <strong>{gps.spd} km/h</strong></div>
                    </div>

                    <div className="mt-4">

                    </div>
                    <div className="w-full max-w-3xl mb-6">
                        <h3 className="text-lg font-semibold mb-2">Map</h3>
                        <div className="h-72 rounded-xl overflow-hidden border border-gray-700 shadow-md">
                            <MapView lat={gps.lat} lng={gps.lng} />
                        </div>
                    </div>
                </div>

                {/* PANEL RELAY */}
                <div className="col-span-1 bg-gray-800 rounded-lg p-4">
                    <div className="text-sm text-gray-300">Relays</div>

                    <div className="grid grid-cols-2 gap-2 mt-2">

                        {/* R1 */}
                        <button
                            onClick={() => toggleRelay("r1")}
                            className={`p-3 rounded ${relays.r1 ? "bg-green-600" : "bg-red-600"}`}
                        >
                            R1 (Kontak) — {relays.r1 ? "ON" : "OFF"}
                        </button>

                        {/* R2 (Starter) */}
                        <button
                            onClick={() => starterPulse()}
                            className="p-3 rounded bg-yellow-700"
                        >
                            R2 (Starter)
                        </button>

                        {/* === MODIFIED — R3 AUTO === */}
                        <button
                            disabled
                            className={`p-3 rounded ${relays.r3 ? "bg-green-700" : "bg-gray-600"}`}
                        >
                            R3 (AUTO) — {relays.r3 ? "ON" : "OFF"}
                        </button>

                        {/* R4 */}
                        <button
                            onClick={() => toggleRelay("r4")}
                            className={`p-3 rounded ${relays.r4 ? "bg-green-600" : "bg-red-600"}`}
                        >
                            R4 — {relays.r4 ? "ON" : "OFF"}
                        </button>

                    </div>

                    {/* COMMAND MANUAL */}
                    <div className="w-full bg-gray-800 rounded-lg p-4 mt-6">
                        <h2 className="text-lg font-semibold mb-3">Semua Command Manual</h2>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <button onClick={() => publishPlain("PING")} className="bg-blue-700 p-2 rounded">PING</button>

                            <button onClick={() => publishPlain("R1_ON")} className="bg-green-700 p-2 rounded">R1 ON</button>
                            <button onClick={() => publishPlain("R1_OFF")} className="bg-red-700 p-2 rounded">R1 OFF</button>

                            <button onClick={() => publishPlain("R2_ON")} className="bg-green-700 p-2 rounded">R2 ON</button>
                            <button onClick={() => publishPlain("R2_OFF")} className="bg-red-700 p-2 rounded">R2 OFF</button>

                            {/* === R3 manual dihapus karena AUTO === */}

                            <button onClick={() => publishPlain("R4_ON")} className="bg-green-700 p-2 rounded">R4 ON</button>
                            <button onClick={() => publishPlain("R4_OFF")} className="bg-red-700 p-2 rounded">R4 OFF</button>

                            <button onClick={() => publishPlain("SEC_ON")} className="bg-purple-700 p-2 rounded">SEC ON</button>
                            <button onClick={() => publishPlain("SEC_OFF")} className="bg-gray-700 p-2 rounded">SEC OFF</button>

                            <button onClick={() => publishPlain("SEND_ON")} className="bg-blue-600 p-2 rounded">SEND ON</button>
                            <button onClick={() => publishPlain("SEND_OFF")} className="bg-gray-600 p-2 rounded">SEND OFF</button>

                            <button onClick={() => publishPlain("MODEM_RST")} className="bg-red-800 p-2 rounded">RESET MODEM</button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full max-w-4xl bg-gray-800 rounded-lg p-4 text-sm">
                <div className="text-gray-300 mb-2">Last payload (from ESP32):</div>
                <pre className="text-xs text-gray-100 whitespace-pre-wrap">
                    {lastRaw ? JSON.stringify(lastRaw, null, 2) : "No data yet"}
                </pre>
            </div>
        </main>
    );
}