// src/app/api/tracker/route.js
import { db, ref, push, get, child } from "@/lib/firebase";
import { NextResponse } from "next/server";

// Jalankan di Edge agar cepat
export const runtime = "edge";

// Header CORS (untuk ESP32 dan Browser)
const corsHeaders = {
    "Access-Control-Allow-Origin": "*", // bisa diganti IP ESP32 jika ingin spesifik
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

// Tangani preflight request dari browser
export async function OPTIONS() {
    return NextResponse.json({}, { status: 200, headers: corsHeaders });
}

// === POST ===
// Menerima data JSON dari ESP32 (SIM800L)
export async function POST(req) {
    try {
        const data = await req.json();

        // Validasi minimal
        if (!data.device_id) {
            return NextResponse.json(
                { status: "error", message: "device_id is required" },
                { status: 400, headers: corsHeaders }
            );
        }

        // Simpan ke Firebase Realtime Database
        await push(ref(db, "trackers"), {
            ...data,
            received_at: new Date().toISOString(),
        });

        console.log("✅ Data diterima dari:", data.device_id);

        return NextResponse.json(
            { status: "success", message: "Data saved to Firebase", data },
            { headers: corsHeaders }
        );
    } catch (error) {
        console.error("❌ Error:", error);
        return NextResponse.json(
            { status: "error", message: error.message },
            { status: 500, headers: corsHeaders }
        );
    }
}

// === GET ===
// Mengambil semua data dari Firebase untuk dashboard monitoring
export async function GET() {
    try {
        const snapshot = await get(child(ref(db), "trackers"));
        if (snapshot.exists()) {
            const data = snapshot.val();
            return NextResponse.json(Object.values(data), { headers: corsHeaders });
        } else {
            return NextResponse.json([], { headers: corsHeaders });
        }
    } catch (error) {
        console.error("❌ Error:", error);
        return NextResponse.json(
            { status: "error", message: error.message },
            { status: 500, headers: corsHeaders }
        );
    }
}
