import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import { verifySession } from "../../../lib/auth";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
    const jsonHeaders = { "Content-Type": "application/json" };

    // Protección de API
    const session = cookies.get("admin_session")?.value;
    if (!verifySession(session)) {
        return new Response(JSON.stringify({ success: false, error: "No autorizado" }), { status: 401, headers: jsonHeaders });
    }

    try {
        const body = await request.json();
        const { orderId } = body;

        if (!orderId) {
            return new Response(JSON.stringify({ success: false, error: "orderId requerido" }), { status: 400, headers: jsonHeaders });
        }

        console.log(`🗑️ Eliminando transacción: ${orderId}`);
        const success = await db.deleteTransaction(orderId);

        if (success) {
            return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders });
        } else {
            return new Response(JSON.stringify({ success: false, error: "Error al eliminar de la base de datos" }), { status: 500, headers: jsonHeaders });
        }

    } catch (err: any) {
        console.error("❌ Delete Transaction Error:", err.message);
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: jsonHeaders });
    }
};
