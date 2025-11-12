// app/api/mqtt/route.js
import mqtt from "mqtt";

let latestData = null;

const broker = "mqtt://broker.hivemq.com:1883";
const topic = "eefded87a3fd15f42b2b0b33de8fd422/data-gps";

const client = mqtt.connect(broker);

client.on("connect", () => {
    console.log("✅ Connected to MQTT broker (Node.js backend)");
    client.subscribe(topic);
});

client.on("message", (t, m) => {
    if (t === topic) latestData = JSON.parse(m.toString());
});

export async function GET() {
    return Response.json(latestData || { status: "no data yet" });
}
