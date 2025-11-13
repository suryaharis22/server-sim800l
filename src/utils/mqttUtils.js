// utils/mqttUtils.js
import mqtt from "mqtt";

// =====================================================
// 🔌 INIT MQTT CLIENT
// =====================================================
export function initMqttClient(brokerUrl, topicSubData, setStatus, onMessage) {
    console.log("🔌 [MQTT] Connecting to:", brokerUrl);

    const client = mqtt.connect(brokerUrl, {
        reconnectPeriod: 5000,
        clean: true,
        connectTimeout: 10_000,
        clientId: "DashboardClient_" + Math.random().toString(16).substring(2, 8),
    });

    client.on("connect", () => {
        console.log("✅ [MQTT] Connected!");
        setStatus("🟢 Connected");
        client.subscribe(topicSubData, (err) => {
            if (err) console.error("❌ Subscribe error:", err);
            else console.log("📡 Subscribed to:", topicSubData);
        });
    });

    client.on("reconnect", () => setStatus("🟡 Reconnecting..."));
    client.on("close", () => setStatus("🔴 Disconnected"));
    client.on("error", (err) => setStatus("⚠️ MQTT Error: " + err.message));

    client.on("message", onMessage);

    return client;
}

// =====================================================
// 📤 PUBLISH COMMAND
// =====================================================
export function sendCmd(client, topic, cmd) {
    if (!client || !client.connected) {
        console.warn("⚠️ MQTT not connected, cannot send:", cmd);
        return;
    }
    console.log(`📤 Sending "${cmd}" → ${topic}`);
    client.publish(topic, cmd);
}

// =====================================================
// ⚙️ HANDLER UNTUK RELAY DAN SECURITY
// =====================================================
export const relayHandlers = {
    handleRelay1: (relay, send) => {
        const next = relay.r1 === 1 ? "R1_OFF" : "R1_ON";
        send(next);
    },

    handleRelay2: (relay, isStarting, setIsStarting, send) => {
        if (relay.r1 === 0) {
            alert("⚠️ Nyalakan Kunci Kontak (R1) terlebih dahulu!");
            return;
        }

        if (isStarting) {
            alert("⏳ Starter sedang berjalan...");
            return;
        }

        setIsStarting(true);
        send("R2_ON");
        console.log("🟢 Starter aktif selama 3 detik...");

        setTimeout(() => {
            send("R2_OFF");
            setIsStarting(false);
            console.log("🔴 Starter otomatis dimatikan");
        }, 3000);
    },

    handleRelay3: () => {
        alert("⚙️ Relay3 dikontrol otomatis oleh sistem (tidak manual).");
    },

    handleRelay4: (relay, send) => {
        const next = relay.r4 === 1 ? "R4_OFF" : "R4_ON";
        send(next);
    },

    handleSecurity: (security, send) => {
        const next = security ? "SEC_OFF" : "SEC_ON";
        send(next);
    },

    handleReset: (send, setRelay, setSecurity) => {
        if (!confirm("Yakin ingin reset semua ke setelan awal?")) return;

        console.log("🔄 Mengembalikan semua relay & security ke kondisi awal...");
        ["R1_OFF", "R2_OFF", "R3_OFF", "R4_OFF", "SEC_OFF"].forEach(send);

        setRelay({ r1: 0, r2: 0, r3: 0, r4: 0 });
        setSecurity(false);
    },
};

// =====================================================
// 🔁 LOGIKA OTOMATIS
// =====================================================
export function handleAutoRelay3({ data, relay, security, send }) {
    const rawVbat = data.sys?.vbat ?? data.sensor?.voltage_input ?? 0;
    const vbat = Number(rawVbat);
    const r1 = relay.r1;
    const r3 = relay.r3;

    console.log("[AUTO-R3] security:", security, "vbat:", vbat, "r1:", r1, "r3:", r3);

    if (security && vbat > 5 && r1 === 0 && r3 === 0) {
        console.log("⚡ Kondisi terpenuhi → Mengirim R3_ON");
        send("R3_ON");
        return;
    }

    if (!security && vbat > 0 && r1 === 0 && r3 === 1) {
        console.log("🔒 kondisi security off");
        send("R3_OFF");
        return;
    }

    if (security && vbat > 0 && r1 === 1 && r3 === 1) {
        console.log("🔒 Kondis Normal");
        send("R3_OFF");
        return;
    }
}

export function handleAutoRelay2Off({ relay, send }) {
    if (relay.r1 === 0 && relay.r2 === 1) {
        console.log("🔴 R1 OFF → Mematikan R2 otomatis");
        send("R2_OFF");
    }
}
