"use client";

import { useEffect, useState } from "react";
import mqtt from "mqtt";

export default function Dashboard() {
  const [data, setData] = useState({});
  const [status, setStatus] = useState("🔴 Disconnected");
  const [client, setClient] = useState(null);
  const [relay, setRelay] = useState({ r1: 0, r2: 0, r3: 0, r4: 0 });
  const [security, setSecurity] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // =====================================================
  // 🔧 CONFIG (SAMAKAN DENGAN ESP32)
  // =====================================================
  const brokerUrl = "wss://broker.hivemq.com:8884/mqtt";
  const topicPubCmd = "eefded87a3fd15f42b2b0b33de8fd422/cmd-control"; // sesuai ESP
  const topicSubData = "eefded87a3fd15f42b2b0b33de8fd422/data-gps"; // sesuai ESP

  // =====================================================
  // 🔌 MQTT CONNECTION
  // =====================================================
  useEffect(() => {
    console.log("🔌 [MQTT] Connecting to:", brokerUrl);

    const mqttClient = mqtt.connect(brokerUrl, {
      reconnectPeriod: 5000,
      clean: true,
      connectTimeout: 10_000,
      clientId: "DashboardClient_" + Math.random().toString(16).substring(2, 8),
    });

    mqttClient.on("connect", () => {
      console.log("✅ [MQTT] Connected!");
      setStatus("🟢 Connected");
      mqttClient.subscribe(topicSubData, (err) => {
        if (err) console.error("❌ Subscribe error:", err);
        else console.log("📡 Subscribed to:", topicSubData);
      });
    });

    mqttClient.on("message", (topic, message) => {
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
    });

    mqttClient.on("reconnect", () => setStatus("🟡 Reconnecting..."));
    mqttClient.on("close", () => setStatus("🔴 Disconnected"));
    mqttClient.on("error", (err) => setStatus("⚠️ MQTT Error: " + err.message));

    setClient(mqttClient);

    return () => {
      mqttClient.end();
      console.log("🔌 Disconnected");
    };
  }, []);

  // =====================================================
  // 💡 SEND COMMAND
  // =====================================================
  const sendCmd = (cmd) => {
    if (!client || !client.connected) {
      console.warn("⚠️ MQTT not connected, cannot send:", cmd);
      return;
    }
    console.log(`📤 Sending "${cmd}" → ${topicPubCmd}`);
    client.publish(topicPubCmd, cmd);
  };

  // =====================================================
  // ⚙️ LOGIKA KERJA RELAY DAN SECURITY
  // =====================================================
  const handleRelay1 = () => {
    const next = relay.r1 === 1 ? "R1_OFF" : "R1_ON";
    sendCmd(next);
  };

  const handleRelay2 = () => {
    if (relay.r1 === 0) {
      alert("⚠️ Nyalakan Kunci Kontak (R1) terlebih dahulu!");
      return;
    }

    if (isStarting) {
      alert("⏳ Starter sedang berjalan...");
      return;
    }

    setIsStarting(true);
    sendCmd("R2_ON");
    console.log("🟢 Starter aktif selama 3 detik...");

    setTimeout(() => {
      sendCmd("R2_OFF");
      setIsStarting(false);
      console.log("🔴 Starter otomatis dimatikan");
    }, 3000);
  };

  const handleRelay3 = () => {
    alert("⚙️ Relay3 dikontrol otomatis oleh sistem (tidak manual).");
  };

  const handleRelay4 = () => {
    const next = relay.r4 === 1 ? "R4_OFF" : "R4_ON";
    sendCmd(next);
  };

  const handleSecurity = () => {
    const next = security ? "SEC_OFF" : "SEC_ON";
    sendCmd(next);
  };

  // =====================================================
  // 🔁 OTOMATISASI LOGIKA RELAY 3
  // =====================================================
  useEffect(() => {
    // ambil nilai tegangan dari tempat yang mungkin digunakan oleh ESP
    // (prioritaskan data.sys.vbat jika ada, fallback ke data.sensor.voltage_input)
    const rawVbat = data.sys?.vbat ?? data.sensor?.voltage_input ?? 0;
    const vbat = Number(rawVbat); // pastikan jadi number
    const r1 = relay.r1;
    const r3 = relay.r3;

    // debug: log ke console agar kita tahu nilai apa yang diterima
    console.log("[AUTO-R3] security:", security, "vbat:", vbat, "r1:", r1, "r3:", r3);

    // kondisi utama: security == true && vbat > 5 && r1 == 0 -> ON R3
    if (security && vbat > 5 && r1 === 0 && r3 === 0) {
      console.log("⚡ Kondisi terpenuhi → Mengirim R3_ON");
      sendCmd("R3_ON");
      return;
    }

    // kalau security aktif + ada input terdeteksi (fallback) -> ON R3
    // (optional; hanya jika kamu mau)
    if (security && vbat > 0 && r3 === 0) {
      console.log("🔒 Security aktif & ada tegangan → Mengirim R3_ON (fallback)");
      sendCmd("R3_ON");
      return;
    }

    // jika security nonaktif dan R3 sedang ON → matikan R3
    if (!security && r3 === 1) {
      console.log("🔓 Security nonaktif → Mengirim R3_OFF");
      sendCmd("R3_OFF");
    }
  }, [
    security,
    data.sys?.vbat,
    data.sensor?.voltage_input,
    relay.r1,
    relay.r3
  ]);

  // =====================================================
  // 🔁 OTOMATIS MEMATIKAN RELAY2 JIKA RELAY1 OFF
  // =====================================================
  useEffect(() => {
    if (relay.r1 === 0 && relay.r2 === 1) {
      console.log("🔴 R1 OFF → Mematikan R2 otomatis");
      sendCmd("R2_OFF");
    }
  }, [relay.r1, relay.r2]);

  // =====================================================
  // 🔄 RESET SETELAN AWAL
  // =====================================================
  const handleReset = () => {
    if (!confirm("Yakin ingin reset semua ke setelan awal?")) return;

    console.log("🔄 Mengembalikan semua relay & security ke kondisi awal...");
    sendCmd("R1_OFF");
    sendCmd("R2_OFF");
    sendCmd("R3_OFF");
    sendCmd("R4_OFF");
    sendCmd("SEC_OFF");

    setRelay({ r1: 0, r2: 0, r3: 0, r4: 0 });
    setSecurity(false);
  };

  // =====================================================
  // 🖥️ UI DASHBOARD
  // =====================================================
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-4">🚗 ESP32 + SIM800L + GPS Tracker</h1>
      <p className="mb-4">{status}</p>

      <div className="bg-gray-800 p-6 rounded-xl shadow-lg w-full max-w-md text-gray-200">
        <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">
          📡 Data dari Perangkat
        </h2>

        {data && Object.keys(data).length > 0 ? (
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">🆔 Device:</span>
              <span className="font-medium">{data.device_id}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-400">🕒 Timestamp:</span>
              <span>{new Date(data.timestamp * 1000).toLocaleString()}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-400">📶 RSSI:</span>
              <span>{data.signal?.rssi} dBm</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-400">📍 Latitude:</span>
              <span>{data.gps?.lat?.toFixed(6)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-400">📍 Longitude:</span>
              <span>{data.gps?.lng?.toFixed(6)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-400">🛰️ Satelit:</span>
              <span>{data.gps?.sat}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-400">⚡ Tegangan:</span>
              <span>{data.sys?.vbat?.toFixed(2)} V</span>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-400 py-8 animate-pulse">
            Menunggu data dari ESP32...
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* ⚙️ RELAY CONTROL SECTION */}
      {/* ============================================ */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <button
          onClick={handleRelay1}
          className={`px-6 py-3 rounded-lg font-semibold transition duration-300 ${relay.r1
            ? "bg-red-600 hover:bg-red-700"
            : "bg-green-600 hover:bg-green-700"
            }`}
        >
          {relay.r1 ? "🔴 Matikan R1 (Kontak)" : "🟢 Nyalakan R1 (Kontak)"}
        </button>

        <button
          onClick={handleRelay2}
          disabled={relay.r1 === 0 || isStarting}
          className={`px-6 py-3 rounded-lg font-semibold transition duration-300 ${relay.r1 === 0 || isStarting
            ? "bg-gray-600 cursor-not-allowed"
            : relay.r2
              ? "bg-red-600 hover:bg-red-700"
              : "bg-green-600 hover:bg-green-700"
            }`}
        >
          {isStarting
            ? "⏳ Starting..."
            : relay.r2
              ? "🔴 Matikan Starter"
              : "🟢 Starter Motor"}
        </button>

        <button
          onClick={handleRelay3}
          className="px-6 py-3 rounded-lg bg-gray-700 text-gray-300 cursor-not-allowed"
        >
          🧠 Relay3 (Otomatis)
        </button>

        <button
          onClick={handleRelay4}
          className={`px-6 py-3 rounded-lg font-semibold transition duration-300 ${relay.r4
            ? "bg-red-600 hover:bg-red-700"
            : "bg-yellow-600 hover:bg-yellow-700"
            }`}
        >
          {relay.r4 ? "🔴 Matikan Hazard" : "🟡 Nyalakan Hazard"}
        </button>
      </div>

      {/* ============================================ */}
      {/* 🔒 SECURITY SYSTEM */}
      {/* ============================================ */}
      <div className="mt-6 text-center">
        <button
          onClick={handleSecurity}
          className={`px-6 py-3 rounded-lg font-semibold transition duration-300 ${security
            ? "bg-red-600 hover:bg-red-700"
            : "bg-blue-600 hover:bg-blue-700"
            }`}
        >
          {security ? "🔒 Matikan Security" : "🔓 Aktifkan Security"}
        </button>

        <p className="mt-3 text-sm text-gray-400">
          Status Security:{" "}
          <span
            className={`font-bold ${security ? "text-green-400" : "text-red-400"
              }`}
          >
            {security ? "AKTIF" : "NONAKTIF"}
          </span>
        </p>
      </div>

      {/* ============================================ */}
      {/* 🔁 RESET BUTTON */}
      {/* ============================================ */}
      <div className="mt-6">
        <button
          onClick={handleReset}
          className="px-6 py-3 rounded-lg font-semibold bg-gray-700 hover:bg-gray-600 transition duration-300"
        >
          🔄 Reset Setelan Awal
        </button>
      </div>

      <footer className="mt-8 text-gray-500 text-xs">
        MQTT Debug tersedia di console browser (Ctrl+Shift+I)
      </footer>
    </main>
  );
}
