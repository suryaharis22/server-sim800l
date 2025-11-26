"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { initMqttClient, sendCmd } from "@/utils/mqttUtilsV2";

const MapView = dynamic(() => import("../MapView"), { ssr: false });

export default function Dashboard() {
    const [data, setData] = useState({});
    const [status, setStatus] = useState("🔴 Disconnected");
    const [client, setClient] = useState(null);
    const [relay, setRelay] = useState({ r1: 0, r2: 0, r3: 0, r4: 0 });
    const [security, setSecurity] = useState(false);
    const [loading, setLoading] = useState({
        r1: false, r2: false, r3: false, r4: false, security: false,
    });

    const brokerUrl = "wss://broker.hivemq.com:8884/mqtt";
    const topicPubCmd = "eefded87a3fd15f42b2b0b33de8fd422/cmd-control"; // → QoS1
    const topicSubData = "eefded87a3fd15f42b2b0b33de8fd422/data-gps";

    const sendOnIntervalRef = useRef(null);

    // ==========================================================
    // INIT MQTT (SUB QoS1)
    // ==========================================================
    useEffect(() => {
        const mqttClient = initMqttClient(
            brokerUrl,
            topicSubData,
            setStatus,
            (topic, message) => {
                if (topic !== topicSubData) return;

                try {
                    const json = JSON.parse(message.toString());
                    setData(json);

                    if (json.relay) setRelay(json.relay);
                    if (typeof json.security !== "undefined") {
                        setSecurity(json.security);
                    }
                } catch (e) {
                    console.error("Invalid JSON:", e);
                }
            }
        );

        setClient(mqttClient);

        return () => {
            if (sendOnIntervalRef.current) clearInterval(sendOnIntervalRef.current);

            try {
                mqttClient?.publish(topicPubCmd, "SEND_OFF");
                mqttClient?.end(true);
            } catch { }
        };
    }, []);

    // ==========================================================
    // LOOP SEND_ON
    // ==========================================================
    useEffect(() => {
        if (!client) return;

        sendCmd(client, topicPubCmd, "SEND_ON");

        sendOnIntervalRef.current = setInterval(() => {
            sendCmd(client, topicPubCmd, "SEND_ON");
        }, 10000);

        const handleUnload = () => {
            if (sendOnIntervalRef.current) clearInterval(sendOnIntervalRef.current);

            try {
                client?.publish(topicPubCmd, "SEND_OFF", { qos: 1 });
            } catch { }
        };

        window.addEventListener("beforeunload", handleUnload);

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") handleUnload();
        });

        return () => {
            if (sendOnIntervalRef.current) clearInterval(sendOnIntervalRef.current);
            window.removeEventListener("beforeunload", handleUnload);
        };
    }, [client]);

    // ==========================================================
    // PUBLISH HELPER (FORCE QoS1)
    // ==========================================================
    const publish = (cmd, successMsg) => {
        if (!client || !client.connected) {
            toast.error("MQTT tidak terhubung!");
            return;
        }

        sendCmd(client, topicPubCmd, cmd); // -> QOS 1
        toast.success(successMsg);
    };

    // ==========================================================
    // RELAY HANDLER
    // ==========================================================
    const toggleRelay = (relayKey) => {
        if (security) {
            toast.error("Tidak bisa! Security ON 🚫");
            return;
        }

        const current = relay[relayKey];
        const cmdMap = {
            r1: current ? "R1_OFF" : "R1_ON",
            r2: current ? "R2_OFF" : "R2_ON",
            r4: current ? "R4_OFF" : "R4_ON",
        };

        const msgMap = {
            R1_ON: "Kontak ON 🔌",
            R1_OFF: "Kontak OFF ❌",
            R2_ON: "Starter aktif 🟢",
            R2_OFF: "Starter OFF 🔴",
            R4_ON: "Lampu ON 💡",
            R4_OFF: "Lampu OFF 🔦",
        };

        const cmd = cmdMap[relayKey];
        const msg = msgMap[cmd];

        setLoading((s) => ({ ...s, [relayKey]: true }));
        publish(cmd, msg);

        setTimeout(() =>
            setLoading((s) => ({ ...s, [relayKey]: false })), 800
        );
    };

    // ==========================================================
    // SECURITY HANDLER
    // ==========================================================
    const toggleSecurity = () => {
        setLoading((s) => ({ ...s, security: true }));

        if (security) {
            publish("SEC_OFF", "Security dimatikan 🔓");
            setSecurity(false);
        } else {
            publish("SEC_ON", "Security diaktifkan 🔒");
            setSecurity(true);
        }

        setTimeout(
            () => setLoading((s) => ({ ...s, security: false })),
            800
        );
    };

    // GPS fallback
    const lat = data?.gps?.lat ?? -7.981894;
    const lng = data?.gps?.lng ?? 112.626503;

    // ==========================================================
    // UI
    // ==========================================================
    return (
        <main className="min-h-screen bg-gray-900 text-white p-6 flex flex-col items-center">
            <Toaster position="top-center" />

            <motion.h1
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-3xl font-bold mb-2"
            >
                🚗 Smart Tracker Dashboard
            </motion.h1>

            <p className="text-gray-400 mb-6">{status}</p>

            <div className="w-full max-w-3xl bg-gray-800 rounded-2xl p-6 mb-6 shadow-lg">
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Device Info</h3>
                        <div className="text-sm text-gray-300 space-y-1">
                            <div>Device: {data.device_id ?? "-"}</div>
                            <div>
                                Timestamp:{" "}
                                {data.timestamp
                                    ? new Date(data.timestamp * 1000).toLocaleString()
                                    : "-"}
                            </div>
                            <div>Vbat: {data.sys?.vbat ? `${data.sys.vbat} V` : "-"}</div>
                            <div>Signal: {data.sys?.rssi ?? "-"} dBm</div>
                            <div>Operator: {data.sys?.operator ?? "-"}</div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold mb-2">Controls</h3>

                        <div className="flex gap-2 flex-wrap">
                            {[
                                { k: "r1", labelOn: "🔴 Matikan Kontak", labelOff: "🟢 Nyalakan Kontak" },
                                { k: "r2", labelOn: "🔴 Matikan Starter", labelOff: "🟢 Starter" },
                                { k: "r4", labelOn: "🔴 Matikan Lampu", labelOff: "💡 Nyalakan Lampu" },
                            ].map((b) => (
                                <button
                                    key={b.k}
                                    onClick={() => toggleRelay(b.k)}
                                    disabled={loading[b.k] || security}
                                    className={`px-4 py-2 rounded-md font-medium transition-all ${relay[b.k] ? "bg-red-600" : "bg-green-600"
                                        } ${security ? "opacity-40 cursor-not-allowed" : ""}`}
                                >
                                    {loading[b.k]
                                        ? "⏳"
                                        : relay[b.k]
                                            ? b.labelOn
                                            : b.labelOff}
                                </button>
                            ))}
                        </div>

                        <div className="mt-4">
                            <button
                                onClick={toggleSecurity}
                                disabled={loading.security}
                                className={`px-4 py-2 rounded-md font-medium transition-all ${security ? "bg-red-600" : "bg-blue-600"
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

            <div className="w-full max-w-3xl mb-6">
                <h3 className="text-lg font-semibold mb-2">Map</h3>
                <div className="h-72 rounded-xl overflow-hidden border border-gray-700 shadow-md">
                    <MapView lat={lat} lng={lng} />
                </div>
            </div>
        </main>
    );
}
