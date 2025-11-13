"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  initMqttClient,
  sendCmd,
  relayHandlers,
  handleAutoRelay3,
  handleAutoRelay2Off,
} from "@/utils/mqttUtils";

// 🚀 Lazy load komponen MapView (hindari SSR error)
const MapView = dynamic(() => import("./gps/MapView"), { ssr: false });

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

  const sendOnInterval = useRef(null);

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

  // 🔄 SEND_ON loop & SEND_OFF saat halaman close
  useEffect(() => {
    if (!client) return;

    // Kirim SEND_ON saat pertama kali load
    publish("SEND_ON");

    // Loop SEND_ON setiap 20 detik
    sendOnInterval.current = setInterval(() => {
      publish("SEND_ON");
    }, 20000);

    const handleUnload = () => {
      if (sendOnInterval.current) clearInterval(sendOnInterval.current);
      publish("SEND_OFF");
    };

    window.addEventListener("beforeunload", handleUnload);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") handleUnload();
    });

    return () => {
      if (sendOnInterval.current) clearInterval(sendOnInterval.current);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [client]);

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

      {/* Relay Controls */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg mb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        {/* Relay buttons */}
        {[
          {
            labelOn: "🔴 Matikan R1 (Kontak)",
            labelOff: "🟢 Nyalakan R1 (Kontak)",
            loadingKey: "r1",
            state: relay.r1,
            colorOn: "bg-red-600 hover:bg-red-700",
            colorOff: "bg-green-600 hover:bg-green-700",
            onClick: async () => {
              setLoading((prev) => ({ ...prev, r1: true }));
              await relayHandlers.handleRelay1(relay, (cmd) => publish(cmd));
              setLoading((prev) => ({ ...prev, r1: false }));
            },
          },
          {
            labelOn: "🔴 Matikan Starter",
            labelOff: "🟢 Starter Motor",
            loadingKey: "r2",
            state: relay.r2,
            colorOn: "bg-red-600 hover:bg-red-700",
            colorOff: "bg-green-600 hover:bg-green-700",
            disabled: relay.r1 === 0 || isStarting,
            onClick: async () => {
              setLoading((prev) => ({ ...prev, r2: true }));
              await relayHandlers.handleRelay2(
                relay,
                isStarting,
                setIsStarting,
                (cmd) => publish(cmd)
              );
              setLoading((prev) => ({ ...prev, r2: false }));
            },
          },
          {
            labelOn: "🔴 Matikan Hazard",
            labelOff: "🟡 Nyalakan Hazard",
            loadingKey: "r4",
            state: relay.r4,
            colorOn: "bg-red-600 hover:bg-red-700",
            colorOff: "bg-yellow-600 hover:bg-yellow-700",
            onClick: async () => {
              setLoading((prev) => ({ ...prev, r4: true }));
              await relayHandlers.handleRelay4(relay, (cmd) => publish(cmd));
              setLoading((prev) => ({ ...prev, r4: false }));
            },
          },
        ].map((btn, idx) => (
          <motion.button
            key={idx}
            onClick={btn.onClick}
            disabled={btn.disabled || loading[btn.loadingKey]}
            whileTap={{ scale: 0.95 }}
            className={`px-6 py-3 rounded-xl font-semibold transition duration-300 ${btn.state ? btn.colorOn : btn.colorOff
              } ${loading[btn.loadingKey] ? "opacity-50 cursor-not-allowed" : ""} ${btn.disabled ? "bg-gray-600 cursor-not-allowed" : ""
              }`}
          >
            {loading[btn.loadingKey]
              ? "⏳ Memproses..."
              : btn.state
                ? btn.labelOn
                : btn.labelOff}
          </motion.button>
        ))}

        {/* Relay3 Auto */}
        <motion.button
          onClick={() => relayHandlers.handleRelay3()}
          className="px-6 py-3 rounded-xl bg-gray-700 text-gray-300 cursor-not-allowed"
        >
          🧠 Relay3 (Otomatis)
        </motion.button>
      </motion.div>

      {/* Security */}
      <motion.div
        className="text-center mb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <button
          onClick={async () => {
            setLoading((prev) => ({ ...prev, security: true }));
            await relayHandlers.handleSecurity(security, (cmd) => publish(cmd));
            setLoading((prev) => ({ ...prev, security: false }));
          }}
          disabled={loading.security}
          className={`px-6 py-3 rounded-xl font-semibold transition duration-300 ${security ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
            } ${loading.security ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {loading.security
            ? "⏳ Memproses..."
            : security
              ? "🔒 Matikan Security"
              : "🔓 Aktifkan Security"}
        </button>

        <p className="mt-3 text-sm text-gray-400">
          Status Security:{" "}
          <span className={`font-bold ${security ? "text-green-400" : "text-red-400"}`}>
            {security ? "AKTIF" : "NONAKTIF"}
          </span>
        </p>
      </motion.div>

      {/* Reset */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
        <button
          onClick={async () => {
            setLoading((prev) => ({ ...prev, reset: true }));
            await relayHandlers.handleReset((cmd) => publish(cmd), setRelay, setSecurity);
            setLoading((prev) => ({ ...prev, reset: false }));
          }}
          disabled={loading.reset}
          className={`px-6 py-3 rounded-xl font-semibold bg-gray-700 hover:bg-gray-600 transition duration-300 ${loading.reset ? "opacity-50 cursor-not-allowed" : ""
            }`}
        >
          {loading.reset ? "⏳ Memproses..." : "🔄 Reset Setelan Awal"}
        </button>
      </motion.div>
    </main>
  );
}
