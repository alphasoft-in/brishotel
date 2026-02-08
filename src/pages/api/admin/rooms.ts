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
        const { id, category, fromStatus, toStatus, status, price, action } = body;

        let success = true;

        // 🏗️ Gestión de Cantidades (Añadir/Eliminar unidades físicas)
        if (category && action) {
            if (action === 'add_unit') {
                success = await db.addRoomUnit(category);
            } else if (action === 'remove_unit') {
                success = await db.removeRoomUnit(category);
            }
        }
        // 🔄 Transición de estados por categorías (Nuevo enfoque por cantidades)
        else if (category && fromStatus && toStatus) {
            success = await db.transitionRoomStatus(category, fromStatus, toStatus);
        }
        // 🔒 Enfoque anterior por ID (mantenido por compatibilidad)
        else if (id && status) {
            const validStatuses = ['libre', 'ocupado', 'limpieza', 'reservado', 'mantenimiento'];
            if (!validStatuses.includes(status)) {
                return new Response(JSON.stringify({ success: false, error: "Estado no válido" }), { status: 400, headers: jsonHeaders });
            }
            success = await db.updateRoomStatus(id, status as Room['status']);
        }

        // 💰 Actualizar Precios (Ahora aplica a toda la categoría si se pasa category)
        if (price !== undefined) {
            const numPrice = parseFloat(price);
            if (isNaN(numPrice) || numPrice < 0) {
                return new Response(JSON.stringify({ success: false, error: "Precio no válido" }), { status: 400, headers: jsonHeaders });
            }

            if (category) {
                // Actualizar todas las habitaciones de esta categoría usando la nueva función optimizada
                success = await db.updateRoomPrice(category, numPrice) && success;
            } else if (id) {
                // Si solo pasan ID, actualizamos solo esa (usamos el mismo método pero eq id en db.ts si fuera necesario, 
                // pero db.ts ahora recibe category. Vamos a asegurar que db.ts soporte id o ajustar aquí)
                // En db.ts definí updateRoomPrice(category: string, price: number)
                // Si pasan ID, asumimos que es un caso legacy y tratamos de buscar su categoría primero o actualizamos por ID.
                // Ajustaré db.ts para que updateRoomPrice sea más flexible si es necesario.
                // Por ahora, actualizamos por categoría si la tenemos.
                const allRooms = await db.getRooms();
                const targetRoom = allRooms.find(r => r.id === id);
                if (targetRoom) {
                    success = await db.updateRoomPrice(targetRoom.subtitle, numPrice) && success;
                }
            }
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
