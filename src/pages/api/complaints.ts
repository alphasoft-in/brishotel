import type { APIRoute } from "astro";
import { db } from "../../lib/db";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    const jsonHeaders = { "Content-Type": "application/json" };

    try {
        const body = await request.json();
        const { fullName, documentType, documentNumber, email, phone, address, type, description } = body;

        // Validación básica
        if (!fullName || !documentNumber || !email || !description) {
            return new Response(JSON.stringify({
                success: false,
                error: "Por favor complete todos los campos obligatorios."
            }), { status: 400, headers: jsonHeaders });
        }

        const complaintId = await db.saveComplaint({
            fullName,
            documentType,
            documentNumber,
            email,
            phone,
            address,
            type,
            description
        });

        if (complaintId) {
            return new Response(JSON.stringify({
                success: true,
                complaintId
            }), { status: 200, headers: jsonHeaders });
        } else {
            return new Response(JSON.stringify({
                success: false,
                error: "Error interno al guardar la reclamación."
            }), { status: 500, headers: jsonHeaders });
        }

    } catch (err: any) {
        return new Response(JSON.stringify({
            success: false,
            error: err.message
        }), { status: 500, headers: jsonHeaders });
    }
};
