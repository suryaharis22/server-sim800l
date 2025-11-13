// utils/mqttUtils.js
import mqtt from "mqtt";

export function initMqttClient(brokerUrl, topicSubData, setStatus, onMessage) {
    console.log("Connecting to MQTT:", brokerUrl);

    const client = mqtt.connect(brokerUrl, {
        reconnectPeriod: 5000,
        clean: true,
        connectTimeout: 10_000,
        clientId: "next_dashboard_" + Math.random().toString(16).slice(2, 8),
    });

    client.on("connect", () => {
        console.log("MQTT connected");
        setStatus("🟢 Connected");
        client.subscribe(topicSubData, (err) => {
            if (err) console.error("Subscribe error:", err);
            else console.log("Subscribed to", topicSubData);
        });
    });

    client.on("reconnect", () => setStatus("🟡 Reconnecting..."));
    client.on("close", () => setStatus("🔴 Disconnected"));
    client.on("error", (err) => {
        console.error("MQTT Error:", err);
        setStatus("⚠️ MQTT Error");
    });

    client.on("message", (topic, message) => {
        try {
            onMessage(topic, message);
        } catch (e) {
            console.error("onMessage handler error:", e);
        }
    });

    return client;
}

export function sendCmd(client, topic, cmd) {
    if (!client || !client.connected) {
        console.warn("MQTT not connected, cannot send:", cmd);
        return;
    }
    client.publish(topic, cmd, { qos: 0 }, (err) => {
        if (err) console.error("Publish error:", err);
        else console.log("Published:", cmd, "->", topic);
    });
}
