import type { APIRoute } from "astro";
import crypto from "node:crypto";
import { db } from "../../lib/db";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    const jsonHeaders = { "Content-Type": "application/json" };
    const mode = import.meta.env.IZIPAY_MODE || "TEST";
    const HMAC_KEY = mode === "PRODUCTION"
        ? import.meta.env.IZIPAY_HMAC_SHA256_PROD
        : import.meta.env.IZIPAY_HMAC_SHA256;

    try {
        const formData = await request.formData();
        const krAnswer = formData.get("kr-answer") as string;
        const krHash = formData.get("kr-hash") as string;

        if (!krAnswer || !krHash) {
            return new Response(JSON.stringify({ error: "Datos faltantes" }), { status: 400, headers: jsonHeaders });
        }

        // 🔐 Validar Firma (Seguridad IPN)
        const calculatedHash = crypto
            .createHmac("sha256", HMAC_KEY)
            .update(krAnswer)
            .digest("hex");

        if (calculatedHash !== krHash) {
            console.error("⚠️ WEBHOOK: Firma Inválida");
            return new Response(JSON.stringify({ error: "Firma inválida" }), { status: 401, headers: jsonHeaders });
        }

        const answer = JSON.parse(krAnswer);
        const orderId = answer.orderDetails.orderId;
        const orderStatus = answer.orderStatus;

        console.log(`🔔 Webhook recibido para ${orderId}: ${orderStatus}`);

        // Actualizar DB
        const finalStatus = orderStatus === "PAID" ? "EXITOSO" : "FALLIDO";
        await db.updateTransactionStatus(orderId, finalStatus, answer);

        return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders });

    } catch (err: any) {
        console.error("❌ Webhook Error:", err.message);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: jsonHeaders });
    }
};
