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

        // 🔐 Credenciales v4 Estándar
        const USER = import.meta.env.IZIPAY_USER;
        // Intentar usar producción si estamos en modo producción, si no test
        const isProd = import.meta.env.IZIPAY_MODE === "PRODUCTION";
        const PASSWORD = isProd ? import.meta.env.IZIPAY_PASSWORD_PROD : import.meta.env.IZIPAY_PASSWORD;

        const auth = Buffer.from(`${USER}:${PASSWORD}`).toString("base64");

        console.log(`🔍 Sincronizando estado para orden: ${orderId}`);

        // Consultar Izipay (Order/Get es el servicio para obtener detalles por orderId en v4)
        const izipayResponse = await fetch("https://api.micuentaweb.pe/api-payment/V4/Order/Get", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Basic ${auth}`,
            },
            body: JSON.stringify({ orderId: orderId }),
        });

        const data = await izipayResponse.json();
        console.log(`📥 Respuesta Sync Izipay (${orderId}):`, JSON.stringify(data));

        if (data.status === "SUCCESS" && data.answer) {
            const ans = data.answer;
            const orderStatus = ans.orderStatus; // PAID, PARTIALLY_PAID, RUNNING, UNPAID, CANCELLED
            const transactions = ans.transactions || [];

            let localStatus: 'PENDIENTE' | 'EXITOSO' | 'FALLIDO' | 'CANCELADO' = 'PENDIENTE';

            // Izipay v4 Status Codes
            // EXITOSO: Only terminal paid/captured states.
            const successCodes = ["PAID", "CAPTURED"];

            // ANULADO: Explicitly cancelled or refused.
            const cancelCodes = ["CANCELLED", "EXPIRED", "ABANDONED", "VOIDED", "REFUNDED", "UNPAID", "REFUSED", "CANCELADO", "ANULADO"];

            // PENDIENTE: Anything authorized but not captured, or currently processing.
            const pendingCodes = ["RUNNING", "WAITING_FOR_PAYMENT", "PENDING", "INITIAL", "AUTHORISED", "AUTHORIZED", "AUTORIZADO", "ESPERA", "WAITING_FOR_CAPTURE"];

            const failCodes = ["ERROR", "FAILED"];

            const txStatuses = (transactions || []).map((t: any) => t.status?.toUpperCase() || "");
            const hasSuccessTx = txStatuses.some((s: string) => successCodes.includes(s));
            const hasCancelTx = txStatuses.some((s: string) => cancelCodes.includes(s));
            const hasPendingTx = txStatuses.some((s: string) => pendingCodes.includes(s));
            const hasFailTx = txStatuses.some((s: string) => failCodes.includes(s));

            const orderStatusUpper = (orderStatus || "").toUpperCase();

            console.log(`[SYNC] ${orderId} | Order: ${orderStatusUpper} | Tx: ${txStatuses.join(", ")}`);

            // LOGIC PRIORITY: PENDING > SUCCESS > CANCEL/FAIL
            // IMPORTANT: If a transaction is AUTHORISED (Pending Capture), it must be PENDIENTE, 
            // even if some other flag suggests success.
            if (pendingCodes.includes(orderStatusUpper) || hasPendingTx) {
                localStatus = "PENDIENTE";
            }
            else if (successCodes.includes(orderStatusUpper) || hasSuccessTx) {
                localStatus = "EXITOSO";
            }
            else if (cancelCodes.includes(orderStatusUpper) || hasCancelTx) {
                localStatus = "CANCELADO";
            }
            else if (failCodes.includes(orderStatusUpper) || hasFailTx) {
                // Check fail last, as sometimes a failure is followed by a success/auth
                localStatus = "FALLIDO";
            } else {
                localStatus = "PENDIENTE";
            }

            console.log(`[SYNC] ${orderId} -> RESULT: ${localStatus}`);

            console.log(`[SYNC RESULT] Order: ${orderId} -> Result: ${localStatus}`);

            // Tomar el detalle más relevante (la primera transacción o el answer)
            const transDetail = transactions.length > 0 ? transactions[0] : ans;

            await db.updateTransactionStatus(orderId, localStatus, transDetail);

            return new Response(JSON.stringify({
                success: true,
                newStatus: localStatus,
                iziStatus: orderStatus || (transactions.length > 0 ? transactions[0].status : "UNKNOWN"),
                debug: {
                    orderStatus: orderStatus,
                    txStatuses: transactions.map((t: any) => t.status)
                }
            }), { status: 200, headers: jsonHeaders });

        } else {
            const errorMsg = data.answer?.errorMessage || data.webService || "Error en Izipay";
            const errorCode = data.answer?.errorCode || "No code";

            return new Response(JSON.stringify({
                success: false,
                error: `${errorMsg} (${errorCode})`,
                detail: data
            }), { status: 200, headers: jsonHeaders });
        }

    } catch (err: any) {
        console.error("❌ Sync Error:", err.message);
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: jsonHeaders });
    }
};
