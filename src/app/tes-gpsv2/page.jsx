"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { initMqttClient, sendCmd } from "@/utils/mqttUtilsV2";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

export default function Dashboard() {
    const [data, setData] = useState({});
    const [status, setStatus] = useState("🔴 Disconnected");
    const [client, setClient] = useState(null);
    const [relay, setRelay] = useState({ r1: 0, r2: 0, r3: 0, r4: 0 });
    const [security, setSecurity] = useState(false);
    const [loading, setLoading] = useState({
        r1: false,
        r2: false,
        r3: false,
        r4: false,
        security: false,
    });

    // MQTT setup
    const brokerUrl = "wss://broker.hivemq.com:8884/mqtt";
    const topicPubCmd = "eefded87a3fd15f42b2b0b33de8fd422/cmd-control";
    const topicSubData = "eefded87a3fd15f42b2b0b33de8fd422/data-gps";

    const sendOnIntervalRef = useRef(null);

    // ========== INIT MQTT ==========
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

                        // update relay state
                        if (json.relay) setRelay(json.relay);

                        // update security logic
                        if (json.sys && typeof json.sys.sec !== "undefined") {
                            const secState = json.sys.sec;
                            setSecurity(secState);

                            // jika security OFF, relay3 otomatis off
                            if (secState === false) {
                                setRelay((prev) => ({ ...prev, r3: 0 }));
                                console.log("Security OFF → Relay3 dimatikan (manual mode).");
                            } else {
                                console.log("Security ON → Proteksi aktif (auto mode).");
                            }
                        }
                    } catch (e) {
                        console.error("Invalid JSON message:", e);
                    }
                }
            }
        );

        setClient(mqttClient);

        // cleanup on unmount
        return () => {
            if (sendOnIntervalRef.current) {
                clearInterval(sendOnIntervalRef.current);
                sendOnIntervalRef.current = null;
            }
            try {
                if (mqttClient && mqttClient.connected)
                    mqttClient.publish(topicPubCmd, "SEND_OFF");
                mqttClient.end(true);
            } catch (e) {
                console.warn("MQTT cleanup error:", e);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ========== SEND_ON Loop + OFF saat unload ==========
    useEffect(() => {
        if (!client) return;

        // kirim SEND_ON awal
        sendCmd(client, topicPubCmd, "SEND_ON");

        // interval 20 detik
        sendOnIntervalRef.current = setInterval(() => {
            sendCmd(client, topicPubCmd, "SEND_ON");
        }, 20000);

        // handle tab close
        const handleUnload = () => {
            if (sendOnIntervalRef.current) {
                clearInterval(sendOnIntervalRef.current);
                sendOnIntervalRef.current = null;
            }
            try {
                if (client && client.connected) {
                    client.publish(topicPubCmd, "SEND_OFF");
                }
            } catch (e) {
                console.warn("Error sending SEND_OFF:", e);
            }
        };

        const handleVisibility = () => {
            if (document.visibilityState === "hidden") handleUnload();
        };

        window.addEventListener("beforeunload", handleUnload);
        document.addEventListener("visibilitychange", handleVisibility);

        return () => {
            if (sendOnIntervalRef.current) {
                clearInterval(sendOnIntervalRef.current);
                sendOnIntervalRef.current = null;
            }
            window.removeEventListener("beforeunload", handleUnload);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [client]);

    // publish helper
    const publish = (cmd) => sendCmd(client, topicPubCmd, cmd);

    // ========== Relay Handler ==========
    const toggleRelay = async (relayKey) => {
        const current = relay[relayKey];
        let cmd = "";
        if (relayKey === "r1") cmd = current ? "R1_OFF" : "R1_ON";
        if (relayKey === "r2") cmd = current ? "R2_OFF" : "R2_ON";
        if (relayKey === "r3") cmd = current ? "R3_OFF" : "R3_ON";
        if (relayKey === "r4") cmd = current ? "R4_OFF" : "R4_ON";

        setLoading((s) => ({ ...s, [relayKey]: true }));
        publish(cmd);
        setTimeout(() => setLoading((s) => ({ ...s, [relayKey]: false })), 900);
    };

    // ========== Security Handler ==========
    const toggleSecurity = async () => {
        setLoading((s) => ({ ...s, security: true }));

        if (security) {
            // 🔻 Security dimatikan
            publish("SEC_OFF");
            setSecurity(false);
            setRelay((prev) => ({ ...prev, r3: 0 })); // relay3 otomatis OFF
            console.log("Security OFF dikirim, sistem manual aktif.");
        } else {
            // 🔒 Security diaktifkan
            publish("SEC_ON");
            setSecurity(true);
            console.log("Security ON dikirim, sistem proteksi aktif.");
        }

        setTimeout(() => setLoading((s) => ({ ...s, security: false })), 900);
    };

    // koordinat default
    const lat = data?.gps?.lat ?? -7.981894;
    const lng = data?.gps?.lng ?? 112.626503;

    return (
        <main className="min-h-screen bg-gray-900 text-white p-6 flex flex-col items-center">
            <motion.h1
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-3xl font-bold mb-4"
            >
                🚗 Tracker Dashboard
            </motion.h1>

            <p className="text-gray-400 mb-4">{status}</p>

            {/* Device Info */}
            <div className="w-full max-w-3xl bg-gray-800 rounded-2xl p-6 mb-6">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Device</h3>
                        <div className="text-sm text-gray-300">
                            <div>Device: {data.device_id ?? "-"}</div>
                            <div>
                                Timestamp:{" "}
                                {data.timestamp
                                    ? new Date(data.timestamp * 1000).toLocaleString()
                                    : "-"}
                            </div>
                            <div>
                                Vbat: {data.sys?.vbat ? `${data.sys.vbat} V` : "-"}
                            </div>
                        </div>
                    </div>

                    {/* Relay Control */}
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Relays</h3>
                        <div className="flex gap-2 flex-wrap">
                            {[
                                { k: "r1", labelOn: "🔴 Matikan R1", labelOff: "🟢 Nyalakan R1" },
                                {
                                    k: "r2",
                                    labelOn: "🔴 Matikan Starter",
                                    labelOff: "🟢 Starter",
                                },
                                { k: "r4", labelOn: "🔴 Matikan Hazard", labelOff: "🟡 Hazard" },
                            ].map((b) => (
                                <button
                                    key={b.k}
                                    onClick={() => toggleRelay(b.k)}
                                    disabled={loading[b.k]}
                                    className={`px-4 py-2 rounded-md font-medium ${relay[b.k] ? "bg-red-600" : "bg-green-600"
                                        }`}
                                >
                                    {loading[b.k]
                                        ? "⏳"
                                        : relay[b.k]
                                            ? b.labelOn
                                            : b.labelOff}
                                </button>
                            ))}
                        </div>

                        {/* Security Button */}
                        <div className="mt-4">
                            <button
                                onClick={toggleSecurity}
                                disabled={loading.security}
                                className={`px-4 py-2 rounded-md font-medium ${security ? "bg-red-600" : "bg-blue-600"
                                    }`}
                            >
                                {loading.security
                                    ? "⏳"
                                    : security
                                        ? "🔒 Matikan Security"
                                        : "🔓 Aktifkan Security"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Map View */}
            <div className="w-full max-w-3xl mb-6">
                <h3 className="text-lg font-semibold mb-2">Map</h3>
                <div className="h-72 rounded-xl overflow-hidden border border-gray-700">
                    <MapView lat={lat} lng={lng} />
                </div>
            </div>
        </main>
    );
}
