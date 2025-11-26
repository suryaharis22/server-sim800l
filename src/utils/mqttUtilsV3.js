// utils/mqttUtilsV3.js
import mqtt from "mqtt";

/**
 * Init MQTT Client (Anti Error Next.js)
 * - Tidak akan throw error walaupun broker down
 * - UI tetap aman
 */
export function initMqttClient(
    brokerUrl,
    { onConnect, onMessage, onClose, onError } = {}
) {
    let client = null;

    try {
        const opts = {
            connectTimeout: 4000,
            reconnectPeriod: 3000,
            keepalive: 30,
            clean: true,
        };

        client = mqtt.connect(brokerUrl, opts);
    } catch (err) {
        console.warn("⚠️ MQTT init gagal (silent):", err?.message);
        return null; // aman untuk Next.js
    }

    // --- EVENT HANDLER ---
    client.on("connect", (connack) => {
        try {
            onConnect && onConnect(connack);
        } catch { }
        console.info("MQTT connected");
    });

    client.on("reconnect", () => {
        console.info("MQTT reconnecting...");
    });

    client.on("close", () => {
        try {
            onClose && onClose();
        } catch { }
        console.info("MQTT closed");
    });

    client.on("error", (err) => {
        // Jangan pernah lempar error ke Next.js
        console.warn("⚠️ MQTT error (ignored):", err?.message);
        try {
            onError && onError(err);
        } catch { }
    });

    client.on("message", (topic, msg) => {
        try {
            onMessage && onMessage(topic, msg.toString());
        } catch (err) {
            console.warn("⚠️ onMessage error:", err);
        }
    });

    return client;
}

/**
 * Publish command (anti crash)
 */
export function sendCmd(client, topic, payload, opts = {}) {
    if (!client || !client.connected) {
        console.warn("⚠️ Publish gagal — client belum connect:", payload);
        return false;
    }

    let out = "";
    if (typeof payload === "string") out = payload;
    else out = JSON.stringify(payload);

    try {
        client.publish(topic, out, {
            qos: opts.qos ?? 0,
            retain: opts.retain ?? false,
        });
        return true;
    } catch (err) {
        console.warn("⚠️ Publish error (ignored):", err?.message);
        return false;
    }
}
