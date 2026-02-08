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
        const { id, status } = body;

        if (!id || !status) {
            return new Response(JSON.stringify({ success: false, error: "Faltan parámetros" }), { status: 400, headers: jsonHeaders });
        }

        const success = await db.updateComplaintStatus(id, status);

        if (success) {
            return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders });
        } else {
            return new Response(JSON.stringify({ success: false, error: "Error al actualizar la reclamación" }), { status: 404, headers: jsonHeaders });
        }

    } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: jsonHeaders });
    }
};
