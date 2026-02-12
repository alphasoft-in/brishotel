import type { APIRoute } from "astro";
import { db } from "../../lib/db";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    const jsonHeaders = { "Content-Type": "application/json" };

    try {
        const data = await request.json();
        const { room, price, firstName, lastName, email, dni, phone, checkin, checkout, nights } = data;

        const orderId = `QR-${Date.now()}`;

        // Registrar en la DB local con estado INICIADO o PENDIENTE
        const clientData = JSON.stringify({
            firstName,
            lastName,
            email,
            dni,
            phone,
            checkin,
            checkout,
            nights,
            paymentMethod: 'QR_DIRECTO'
        });

        await db.addTransaction({
            id: `tx-qr-${Date.now()}`,
            orderId: orderId,
            roomName: room,
            amount: Number(price),
            customer: clientData,
            status: 'INICIADO', // Aparecerá en el panel para confirmación manual
            timestamp: new Date().toISOString()
        });

        return new Response(JSON.stringify({
            success: true,
            orderId: orderId
        }), { status: 200, headers: jsonHeaders });

    } catch (err: any) {
        console.error("❌ QR API Error:", err);
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: jsonHeaders });
    }
};
