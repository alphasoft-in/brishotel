import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import type { Room } from "../../../lib/db";
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
        const { id, status, price } = body;

        if (!id) {
            return new Response(JSON.stringify({ success: false, error: "ID de habitación requerido" }), { status: 400, headers: jsonHeaders });
        }

        let success = true;

        if (status) {
            const validStatuses = ['libre', 'ocupado', 'limpieza', 'reservado', 'mantenimiento'];
            if (!validStatuses.includes(status)) {
                return new Response(JSON.stringify({ success: false, error: "Estado no válido" }), { status: 400, headers: jsonHeaders });
            }
            success = db.updateRoomStatus(id, status as Room['status']) && success;
        }

        if (price !== undefined) {
            const numPrice = parseFloat(price);
            if (isNaN(numPrice) || numPrice < 0) {
                return new Response(JSON.stringify({ success: false, error: "Precio no válido" }), { status: 400, headers: jsonHeaders });
            }
            success = db.updateRoomPrice(id, numPrice) && success;
        }

        if (success) {
            return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders });
        } else {
            return new Response(JSON.stringify({ success: false, error: "Error al actualizar la habitación" }), { status: 404, headers: jsonHeaders });
        }

    } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: jsonHeaders });
    }
};
